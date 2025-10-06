const browserApi = typeof browser !== 'undefined' ? browser : chrome;

const MESSAGE_TYPES = {
  GET_STATE: 'GET_STATE',
  STATE_UPDATED: 'STATE_UPDATED',
  ADD_EPISODE: 'ADD_EPISODE',
  ADD_EPISODE_AND_NEWER: 'ADD_EPISODE_AND_NEWER',
  REMOVE_EPISODE: 'REMOVE_EPISODE',
  REORDER_QUEUE: 'REORDER_QUEUE',
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',
  SELECT_EPISODE: 'SELECT_EPISODE',
  UPDATE_PLAYBACK_STATE: 'UPDATE_PLAYBACK_STATE',
  REQUEST_DEBUG_DUMP: 'REQUEST_DEBUG_DUMP',
  SET_AUDIO_LANGUAGE: 'SET_AUDIO_LANGUAGE',
  SET_QUEUE: 'SET_QUEUE'
};

const PLAYBACK_STATES = {
  IDLE: 'idle',
  PLAYING: 'playing',
  PAUSED: 'paused',
  ENDED: 'ended'
};

const MENU_ITEM_CLASS = 'rollqueue-menu-item';
const MENU_ITEM_ATTRIBUTE = 'data-rollqueue-menu-item';
const CARD_ATTRIBUTE = 'data-rollqueue-episode-id';
const ANNOTATED_FLAG = 'data-rollqueue-annotated';

const sendMessage = (message) => {
  return browserApi.runtime.sendMessage(message).catch(() => undefined);
};

const parseEpisodeIdFromUrl = (url) => {
  try {
    const parsed = new URL(url, window.location.href);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const watchIndex = segments.indexOf('watch');
    if (watchIndex !== -1 && segments[watchIndex + 1]) {
      return segments[watchIndex + 1];
    }
    return parsed.href;
  } catch (error) {
    console.warn('RollQueue: Unable to parse episode id', url, error);
    return url;
  }
};

const annotateEpisodeCards = () => {
  document.querySelectorAll('a[href*="/watch/"]').forEach((anchor) => {
    const card = anchor.closest('[data-testid="episode-card"], article, li, div');
    if (!card || card.hasAttribute(ANNOTATED_FLAG)) {
      return;
    }
    const id = parseEpisodeIdFromUrl(anchor.href);
    const titleEl = card.querySelector('[data-testid="media-card-title"], h3, .text--primary, .card-title');
    const subTitleEl = card.querySelector('[data-testid="media-card-subtitle"], .text--secondary');
    const thumbImg = card.querySelector('img');
    card.setAttribute(CARD_ATTRIBUTE, id);
    card.setAttribute('data-rollqueue-episode-url', anchor.href);
    card.setAttribute('data-rollqueue-episode-title', (titleEl?.textContent || anchor.textContent || '').trim());
    if (subTitleEl) {
      card.setAttribute('data-rollqueue-episode-subtitle', subTitleEl.textContent.trim());
    }
    if (thumbImg) {
      card.setAttribute('data-rollqueue-episode-thumbnail', thumbImg.currentSrc || thumbImg.src);
    }
    card.setAttribute(ANNOTATED_FLAG, 'true');
  });
};

const gatherEpisodesFromCard = (card, includeNewer = false) => {
  if (!card) {
    return [];
  }
  const container = card.parentElement;
  const cards = container ? Array.from(container.querySelectorAll(`[${CARD_ATTRIBUTE}]`)) : [card];
  const startIndex = cards.indexOf(card);
  const selected = includeNewer && startIndex !== -1 ? cards.slice(startIndex) : [card];
  return selected.map((episodeCard) => ({
    id: episodeCard.getAttribute(CARD_ATTRIBUTE),
    url: episodeCard.getAttribute('data-rollqueue-episode-url'),
    title: episodeCard.getAttribute('data-rollqueue-episode-title'),
    subtitle: episodeCard.getAttribute('data-rollqueue-episode-subtitle'),
    thumbnail: episodeCard.getAttribute('data-rollqueue-episode-thumbnail')
  }));
};

const createMenuItem = (label, onSelect) => {
  const item = document.createElement('li');
  item.setAttribute(MENU_ITEM_ATTRIBUTE, 'true');
  item.classList.add(MENU_ITEM_CLASS);
  item.setAttribute('role', 'menuitem');
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.className = 'rollqueue-menu-button';
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    onSelect();
    const menu = item.closest('[role="menu"], ul, ol');
    if (menu) {
      menu.dispatchEvent(new Event('rollqueue:close-menu', { bubbles: true }));
    }
  });
  item.appendChild(button);
  return item;
};

const injectMenuItems = (menu) => {
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
  const addSingle = createMenuItem('Add to queue…', () => {
    const episodes = gatherEpisodesFromCard(card, false);
    if (episodes.length) {
      sendMessage({
        type: MESSAGE_TYPES.ADD_EPISODE,
        payload: episodes[0]
      });
    }
  });

  const addSeries = createMenuItem('Add this and newer…', () => {
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

const menuObserver = new MutationObserver((mutations) => {
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

const setupMenuInjection = () => {
  annotateEpisodeCards();
  document.querySelectorAll('[role="menu"], ul, ol').forEach((menu) => {
    injectMenuItems(menu);
  });
  menuObserver.observe(document.body, { childList: true, subtree: true });
};

const updatePlaybackStatus = (state) => {
  sendMessage({
    type: MESSAGE_TYPES.UPDATE_PLAYBACK_STATE,
    payload: { state }
  });
};

const selectCurrentEpisode = (episodeId) => {
  if (!episodeId) {
    return;
  }
  sendMessage({
    type: MESSAGE_TYPES.SELECT_EPISODE,
    payload: { id: episodeId }
  });
};

const monitorVideoElement = (video) => {
  if (!video || video.dataset.rollqueueBound === 'true') {
    return;
  }
  video.dataset.rollqueueBound = 'true';
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
  video.addEventListener('play', handlePlay);
  video.addEventListener('pause', handlePause);
  video.addEventListener('ended', handleEnded);
  video.addEventListener('loadeddata', handleLoaded);
};

const locateAndMonitorVideo = () => {
  const video = document.querySelector('video');
  if (video) {
    monitorVideoElement(video);
  }
};

const initCurrentEpisodeSelection = () => {
  if (!window.location.pathname.includes('/watch/')) {
    return;
  }
  const id = parseEpisodeIdFromUrl(window.location.href);
  selectCurrentEpisode(id);
};

const scheduleTasks = () => {
  annotateEpisodeCards();
  locateAndMonitorVideo();
  initCurrentEpisodeSelection();
};

scheduleTasks();
setupMenuInjection();

setInterval(scheduleTasks, 2000);
