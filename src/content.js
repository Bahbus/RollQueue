const resolveBrowserApi = () => {
  if (typeof globalThis.browser !== "undefined") {
    return globalThis.browser;
  }
  if (typeof globalThis.chrome !== "undefined") {
    return globalThis.chrome;
  }
  return undefined;
};

export const getBrowserApi = () => resolveBrowserApi();

export const MESSAGE_TYPES = {
  GET_STATE: "GET_STATE",
  STATE_UPDATED: "STATE_UPDATED",
  ADD_EPISODE: "ADD_EPISODE",
  ADD_EPISODE_AND_NEWER: "ADD_EPISODE_AND_NEWER",
  REMOVE_EPISODE: "REMOVE_EPISODE",
  REORDER_QUEUE: "REORDER_QUEUE",
  UPDATE_SETTINGS: "UPDATE_SETTINGS",
  SELECT_EPISODE: "SELECT_EPISODE",
  UPDATE_PLAYBACK_STATE: "UPDATE_PLAYBACK_STATE",
  CONTROL_PLAYBACK: "CONTROL_PLAYBACK",
  REQUEST_DEBUG_DUMP: "REQUEST_DEBUG_DUMP",
  SET_AUDIO_LANGUAGE: "SET_AUDIO_LANGUAGE",
  SET_QUEUE: "SET_QUEUE",
  APPLY_AUDIO_LANGUAGE: "APPLY_AUDIO_LANGUAGE"
};

export const PLAYBACK_STATES = {
  IDLE: "idle",
  PLAYING: "playing",
  PAUSED: "paused",
  ENDED: "ended"
};

export const MENU_ITEM_CLASS = "rollqueue-menu-item";
export const MENU_ITEM_ATTRIBUTE = "data-rollqueue-menu-item";
export const CARD_ATTRIBUTE = "data-rollqueue-episode-id";
export const ANNOTATED_FLAG = "data-rollqueue-annotated";

let trackedVideo = null;
let scheduleIntervalId = null;
let initialized = false;

export const resolveTrackedVideo = () => {
  if (trackedVideo && document.contains(trackedVideo)) {
    return trackedVideo;
  }
  const video = document.querySelector("video");
  if (video) {
    monitorVideoElement(video);
    return video;
  }
  return null;
};

export const computePlaybackState = (video) => {
  if (!video) {
    return PLAYBACK_STATES.IDLE;
  }
  if (video.ended) {
    return PLAYBACK_STATES.ENDED;
  }
  if (video.paused) {
    return PLAYBACK_STATES.PAUSED;
  }
  return PLAYBACK_STATES.PLAYING;
};

export const AUDIO_LANGUAGE_LABELS = {
  "ja-JP": "Japanese",
  "en-US": "English",
  "es-419": "Spanish (Latin America)",
  "es-ES": "Spanish (Spain)",
  "pt-BR": "Portuguese (Brazil)",
  "fr-FR": "French",
  "de-DE": "German",
  "it-IT": "Italian"
};

export const sendMessage = (message) =>
  new Promise((resolve) => {
    let settled = false;
    const finalize = (value) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(value);
    };

    const callback = (response) => {
      const lastError = getBrowserApi()?.runtime?.lastError;
      if (lastError) {
        finalize(undefined);
        return;
      }
      finalize(response);
    };

    try {
      const maybePromise = getBrowserApi()?.runtime?.sendMessage?.(message, callback);
      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise.then(finalize).catch(() => finalize(undefined));
      }
    } catch (error) {
      finalize(undefined);
    }
  });

export const parseEpisodeIdFromUrl = (url) => {
  try {
    const parsed = new URL(url, window.location.href);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const watchIndex = segments.indexOf("watch");
    if (watchIndex !== -1 && segments[watchIndex + 1]) {
      return segments[watchIndex + 1];
    }
    return parsed.href;
  } catch (error) {
    console.warn("RollQueue: Unable to parse episode id", url, error);
    return url;
  }
};

export const annotateEpisodeCards = () => {
  document.querySelectorAll('a[href*="/watch/"]').forEach((anchor) => {
    const card = anchor.closest('[data-testid="episode-card"], article, li, div');
    if (!card || card.hasAttribute(ANNOTATED_FLAG)) {
      return;
    }
    const id = parseEpisodeIdFromUrl(anchor.href);
    const titleEl = card.querySelector('[data-testid="media-card-title"], h3, .text--primary, .card-title');
    const subTitleEl = card.querySelector('[data-testid="media-card-subtitle"], .text--secondary');
    const thumbImg = card.querySelector("img");
    card.setAttribute(CARD_ATTRIBUTE, id);
    card.setAttribute("data-rollqueue-episode-url", anchor.href);
    card.setAttribute(
      "data-rollqueue-episode-title",
      (titleEl?.textContent || anchor.textContent || "").trim()
    );
    if (subTitleEl) {
      card.setAttribute("data-rollqueue-episode-subtitle", subTitleEl.textContent.trim());
    }
    if (thumbImg) {
      card.setAttribute("data-rollqueue-episode-thumbnail", thumbImg.currentSrc || thumbImg.src);
    }
    card.setAttribute(ANNOTATED_FLAG, "true");
  });
};

export const gatherEpisodesFromCard = (card, includeNewer = false) => {
  if (!card) {
    return [];
  }
  const container = card.parentElement;
  const cards = container ? Array.from(container.querySelectorAll(`[${CARD_ATTRIBUTE}]`)) : [card];
  const startIndex = cards.indexOf(card);
  const selected = includeNewer && startIndex !== -1 ? cards.slice(startIndex) : [card];
  return selected.map((episodeCard) => ({
    id: episodeCard.getAttribute(CARD_ATTRIBUTE),
    url: episodeCard.getAttribute("data-rollqueue-episode-url"),
    title: episodeCard.getAttribute("data-rollqueue-episode-title"),
    subtitle: episodeCard.getAttribute("data-rollqueue-episode-subtitle"),
    thumbnail: episodeCard.getAttribute("data-rollqueue-episode-thumbnail")
  }));
};

export const createMenuItem = (label, onSelect) => {
  const item = document.createElement("li");
  item.setAttribute(MENU_ITEM_ATTRIBUTE, "true");
  item.classList.add(MENU_ITEM_CLASS);
  item.setAttribute("role", "menuitem");
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.className = "rollqueue-menu-button";
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onSelect();
    const menu = item.closest('[role="menu"], ul, ol');
    if (menu) {
      menu.dispatchEvent(new Event("rollqueue:close-menu", { bubbles: true }));
    }
  });
  item.appendChild(button);
  return item;
};

export const injectMenuItems = (menu) => {
  if (!(menu instanceof Element)) {
    return;
  }
  if (menu.querySelector(`[${MENU_ITEM_ATTRIBUTE}]`)) {
    return;
  }
  const card = menu.closest(`[${CARD_ATTRIBUTE}]`);
  if (!card) {
    return;
  }
  const addSingle = createMenuItem("Add to queue…", () => {
    const episodes = gatherEpisodesFromCard(card, false);
    if (episodes.length) {
      sendMessage({
        type: MESSAGE_TYPES.ADD_EPISODE,
        payload: episodes[0]
      });
    }
  });

  const addSeries = createMenuItem("Add this and newer…", () => {
    const episodes = gatherEpisodesFromCard(card, true);
    if (episodes.length) {
      sendMessage({
        type: MESSAGE_TYPES.ADD_EPISODE_AND_NEWER,
        payload: episodes
      });
    }
  });

  if (menu.firstChild) {
    menu.insertBefore(addSeries, menu.firstChild);
    menu.insertBefore(addSingle, menu.firstChild);
  } else {
    menu.appendChild(addSingle);
    menu.appendChild(addSeries);
  }
};

export const menuObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (!(node instanceof Element)) {
        return;
      }
      if (node.matches?.('[role="menu"], ul, ol')) {
        injectMenuItems(node);
      }
      node.querySelectorAll?.('[role="menu"], ul, ol').forEach((child) => {
        injectMenuItems(child);
      });
    });
  });
});

export const setupMenuInjection = () => {
  annotateEpisodeCards();
  document.querySelectorAll('[role="menu"], ul, ol').forEach((menu) => {
    injectMenuItems(menu);
  });
  if (document.body) {
    menuObserver.observe(document.body, { childList: true, subtree: true });
  }
};

export const updatePlaybackStatus = (state) => {
  sendMessage({
    type: MESSAGE_TYPES.UPDATE_PLAYBACK_STATE,
    payload: { state }
  });
};

export const normalizeLanguageValue = (value) => (value || "").toLowerCase();

export const buildLanguageCandidates = (code, label) => {
  const candidates = new Set();
  if (code) {
    candidates.add(code);
    const shortCode = code.split("-")[0];
    candidates.add(shortCode);
    const mapped = AUDIO_LANGUAGE_LABELS[code];
    if (mapped) {
      candidates.add(mapped);
      const simplifiedMapped = mapped.replace(/\(.*?\)/g, "").trim();
      if (simplifiedMapped) {
        candidates.add(simplifiedMapped);
      }
    }
  }
  if (label) {
    candidates.add(label);
    const simplifiedLabel = label.replace(/\(.*?\)/g, "").trim();
    if (simplifiedLabel) {
      candidates.add(simplifiedLabel);
    }
  }
  return Array.from(candidates)
    .map((candidate) => normalizeLanguageValue(candidate))
    .filter(Boolean);
};

export const setVideoAudioTrack = (video, code, label) => {
  if (!video) {
    return false;
  }
  let audioTracks;
  try {
    audioTracks = video.audioTracks;
  } catch (error) {
    return false;
  }
  if (!audioTracks || typeof audioTracks.length !== "number") {
    return false;
  }
  const candidates = buildLanguageCandidates(code, label);
  let matchedIndex = -1;
  for (let index = 0; index < audioTracks.length; index += 1) {
    const track = audioTracks[index];
    const language = normalizeLanguageValue(track.language);
    const trackLabel = normalizeLanguageValue(track.label);
    const matches = candidates.some((candidate) => {
      if (language && (language === candidate || language.startsWith(candidate))) {
        return true;
      }
      if (trackLabel && (trackLabel === candidate || trackLabel.includes(candidate))) {
        return true;
      }
      return false;
    });
    if (matches) {
      matchedIndex = index;
      break;
    }
  }
  if (matchedIndex === -1) {
    return false;
  }
  for (let index = 0; index < audioTracks.length; index += 1) {
    const track = audioTracks[index];
    const shouldEnable = index === matchedIndex;
    if (track.enabled !== shouldEnable) {
      try {
        track.enabled = shouldEnable;
      } catch (error) {
        // Ignore assignment issues and continue.
      }
    }
  }
  return true;
};

export const findAudioMenuToggle = () =>
  document.querySelector(
    'button[aria-label*="audio" i], button[data-testid="audio-menu-button"], button[data-testid="audio-selector"], button[aria-label*="dub" i]'
  );

export const collectAudioMenuOptions = () => {
  const selectors = [
    '[role="menu"] [role="menuitem"]',
    '[role="menu"] [role="menuitemradio"]',
    '[data-testid="audio-menu-option"]',
    '[data-testid="audio-language-option"]'
  ];
  const results = new Set();
  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((element) => {
      const withinMenu = element.closest('[role="menu"], [data-testid="audio-menu"]');
      if (!withinMenu) {
        return;
      }
      const isHidden =
        element.getAttribute("aria-hidden") === "true" || element.hidden || element.style?.display === "none";
      if (!isHidden) {
        results.add(element);
      }
    });
  });
  return Array.from(results);
};

export const waitForMenuOption = (matcher, timeout = 2000) =>
  new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      const option = collectAudioMenuOptions().find((element) => matcher(element));
      if (option) {
        resolve(option);
        return;
      }
      if (Date.now() - start >= timeout) {
        resolve(null);
        return;
      }
      if (typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(check);
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });

export const selectAudioTrackFromMenu = async (code, label) => {
  const toggle = findAudioMenuToggle();
  if (!toggle) {
    return false;
  }
  const wasExpanded = toggle.getAttribute("aria-expanded") === "true";
  if (!wasExpanded) {
    toggle.click();
  }
  const candidates = buildLanguageCandidates(code, label);
  const option = await waitForMenuOption((element) => {
    const text = normalizeLanguageValue(element.textContent?.trim());
    if (!text) {
      return false;
    }
    return candidates.some((candidate) => text.includes(candidate));
  });
  if (!option) {
    if (!wasExpanded && toggle.getAttribute("aria-expanded") === "true") {
      toggle.click();
    }
    return false;
  }
  option.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  if (!wasExpanded && toggle.getAttribute("aria-expanded") === "true") {
    toggle.click();
  }
  return true;
};

export const applyAudioLanguageDirective = async ({ audioLanguage, label } = {}) => {
  if (!audioLanguage) {
    return false;
  }
  const video = document.querySelector("video");
  let switched = false;
  if (video) {
    switched = setVideoAudioTrack(video, audioLanguage, label);
  }
  if (!switched) {
    switched = await selectAudioTrackFromMenu(audioLanguage, label);
  }
  if (switched) {
    if (video) {
      const state = video.ended
        ? PLAYBACK_STATES.ENDED
        : video.paused
          ? PLAYBACK_STATES.PAUSED
          : PLAYBACK_STATES.PLAYING;
      updatePlaybackStatus(state);
    } else {
      updatePlaybackStatus(PLAYBACK_STATES.IDLE);
    }
  }
  return switched;
};

export const selectCurrentEpisode = (episodeId) => {
  if (!episodeId) {
    return;
  }
  sendMessage({
    type: MESSAGE_TYPES.SELECT_EPISODE,
    payload: { id: episodeId }
  });
};

export const monitorVideoElement = (video) => {
  if (!video) {
    return;
  }
  trackedVideo = video;
  if (video.dataset.rollqueueBound === "true") {
    return;
  }
  video.dataset.rollqueueBound = "true";
  updatePlaybackStatus(video.paused ? PLAYBACK_STATES.PAUSED : PLAYBACK_STATES.PLAYING);
  const handlePlay = () => updatePlaybackStatus(PLAYBACK_STATES.PLAYING);
  const handlePause = () => {
    if (video.ended) {
      updatePlaybackStatus(PLAYBACK_STATES.ENDED);
    } else {
      updatePlaybackStatus(PLAYBACK_STATES.PAUSED);
    }
  };
  const handleEnded = () => updatePlaybackStatus(PLAYBACK_STATES.ENDED);
  const handleLoaded = () => updatePlaybackStatus(PLAYBACK_STATES.IDLE);
  video.addEventListener("play", handlePlay);
  video.addEventListener("pause", handlePause);
  video.addEventListener("ended", handleEnded);
  video.addEventListener("loadeddata", handleLoaded);
};

export const locateAndMonitorVideo = () => {
  if (trackedVideo && !document.contains(trackedVideo)) {
    trackedVideo = null;
  }
  const video = trackedVideo && document.contains(trackedVideo) ? trackedVideo : document.querySelector("video");
  if (video) {
    monitorVideoElement(video);
  }
};

export const initCurrentEpisodeSelection = () => {
  if (!window.location.pathname.includes("/watch/")) {
    return;
  }
  const id = parseEpisodeIdFromUrl(window.location.href);
  selectCurrentEpisode(id);
};

export const scheduleTasks = () => {
  annotateEpisodeCards();
  locateAndMonitorVideo();
  initCurrentEpisodeSelection();
};

export const teardownContent = () => {
  if (scheduleIntervalId) {
    clearInterval(scheduleIntervalId);
    scheduleIntervalId = null;
  }
  const api = getBrowserApi();
  if (api?.runtime?.onMessage?.hasListener?.(contentMessageListener)) {
    api.runtime.onMessage.removeListener(contentMessageListener);
  }
  if (menuObserver) {
    try {
      menuObserver.disconnect();
    } catch (error) {
      // ignore
    }
  }
  initialized = false;
};

export const contentMessageListener = (message, sender, sendResponse) => {
  if (message?.type === MESSAGE_TYPES.APPLY_AUDIO_LANGUAGE) {
    Promise.resolve(applyAudioLanguageDirective(message.payload)).then((success) => {
      try {
        sendResponse?.({ success });
      } catch (error) {
        // Ignore response errors (listener may be gone).
      }
    });
    return true;
  }
  if (message?.type === MESSAGE_TYPES.CONTROL_PLAYBACK) {
    const action = message?.payload?.action;
    const video = resolveTrackedVideo();
    if (!video || !action) {
      try {
        sendResponse?.({ success: false });
      } catch (error) {
        // Ignore response errors (listener may be gone).
      }
      return false;
    }

    const finalize = (success) => {
      const state = computePlaybackState(video);
      updatePlaybackStatus(state);
      try {
        sendResponse?.({ success, state });
      } catch (error) {
        // Ignore response errors (listener may be gone).
      }
    };

    if (action === "play") {
      try {
        const result = video.play?.();
        if (result && typeof result.then === "function") {
          result
            .then(() => finalize(true))
            .catch(() => finalize(false));
          return true;
        }
        finalize(true);
      } catch (error) {
        finalize(false);
      }
      return false;
    }

    if (action === "pause") {
      try {
        video.pause?.();
        finalize(true);
      } catch (error) {
        finalize(false);
      }
      return false;
    }

    finalize(false);
    return false;
  }
  return undefined;
};

export const initContent = () => {
  if (initialized || typeof document === "undefined" || typeof window === "undefined") {
    return;
  }
  initialized = true;
  scheduleTasks();
  setupMenuInjection();
  scheduleIntervalId = window.setInterval(scheduleTasks, 2000);
  getBrowserApi()?.runtime?.onMessage?.addListener?.(contentMessageListener);
};

if (typeof window !== "undefined" && getBrowserApi()?.runtime?.id) {
  initContent();
}

export const __testInternals = {
  get trackedVideo() {
    return trackedVideo;
  },
  set trackedVideo(value) {
    trackedVideo = value;
  }
};

