import {
  AUDIO_LANGUAGES,
  MESSAGE_TYPES,
  PLAYBACK_STATES,
  DEFAULT_SETTINGS
} from './constants.js';

const browserApi = typeof browser !== 'undefined' ? browser : chrome;

let appState = {
  queue: [],
  currentEpisodeId: null,
  playbackState: PLAYBACK_STATES.IDLE,
  settings: { ...DEFAULT_SETTINGS },
  lastUpdated: Date.now()
};

let selectedEpisodeId = null;

let domRefs = {};

const getDefaultDomRefs = () => ({
  queueList: document.getElementById('queue-list'),
  playbackStatus: document.getElementById('playback-status'),
  audioLanguageSelect: document.getElementById('audio-language'),
  autoRemoveCheckbox: document.getElementById('auto-remove'),
  debugLoggingCheckbox: document.getElementById('debug-logging'),
  lastUpdatedEl: document.getElementById('last-updated'),
  playButton: document.getElementById('play-button'),
  pauseButton: document.getElementById('pause-button'),
  removeButton: document.getElementById('remove-button'),
  debugDumpButton: document.getElementById('debug-dump'),
});

const setDomRefs = (overrides = {}) => {
  domRefs = { ...getDefaultDomRefs(), ...overrides };
  return domRefs;
};

const resolveDomRefs = (overrides) => {
  if (overrides) {
    domRefs = { ...domRefs, ...overrides };
    return overrides;
  }
  if (!domRefs.queueList) {
    setDomRefs();
  }
  return domRefs;
};

const sendMessage = (message) => {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finalize = (result, error) => {
      if (settled) {
        return;
      }
      settled = true;
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    };

    const callback = (response) => {
      const lastError = browserApi?.runtime?.lastError;
      if (lastError) {
        finalize(undefined, new Error(lastError.message));
        return;
      }
      finalize(response);
    };

    try {
      const maybePromise = browserApi.runtime.sendMessage(message, callback);
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.then(
          (value) => finalize(value),
          (error) => finalize(undefined, error)
        );
      }
    } catch (error) {
      finalize(undefined, error);
    }
  });
};

const formatTimestamp = (timestamp) => {
  return new Date(timestamp).toLocaleTimeString();
};

const renderPlaybackStatus = (elementsArg) => {
  const { playbackStatus } = resolveDomRefs(elementsArg);
  if (!playbackStatus) {
    return;
  }
  playbackStatus.textContent = appState.playbackState.replace(/^./, (char) => char.toUpperCase());
};

const setSelectedEpisode = (episodeId, elementsArg) => {
  const { queueList, audioLanguageSelect } = resolveDomRefs(elementsArg);
  if (!queueList) {
    selectedEpisodeId = episodeId;
    return;
  }
  selectedEpisodeId = episodeId;
  Array.from(queueList.children).forEach((child) => {
    child.classList.toggle('selected', child.dataset.id === selectedEpisodeId);
  });
  if (!audioLanguageSelect) {
    return;
  }
  if (!episodeId) {
    audioLanguageSelect.value = appState.settings.defaultAudioLanguage;
    return;
  }
  const episode = appState.queue.find((item) => item.id === episodeId);
  if (episode) {
    audioLanguageSelect.value = episode.audioLanguage || appState.settings.defaultAudioLanguage;
  }
};

const renderQueue = (elementsArg) => {
  const { queueList } = resolveDomRefs(elementsArg);
  if (!queueList) {
    return;
  }
  queueList.innerHTML = '';
  appState.queue.forEach((episode) => {
    const item = document.createElement('li');
    item.className = 'queue-item';
    item.draggable = true;
    item.dataset.id = episode.id;

    const thumb = document.createElement('img');
    thumb.src = episode.thumbnail || browserApi.runtime.getURL('assets/icon-48.svg');
    thumb.alt = '';

    const metadata = document.createElement('div');
    metadata.className = 'metadata';

    const title = document.createElement('span');
    title.className = 'title';
    title.textContent = episode.title || 'Untitled episode';

    const subtitle = document.createElement('span');
    subtitle.className = 'subtitle';
    subtitle.textContent = episode.subtitle || '';

    const language = document.createElement('span');
    language.className = 'language';
    language.textContent = episode.audioLanguage || appState.settings.defaultAudioLanguage;

    metadata.append(title, subtitle, language);

    const openButton = document.createElement('button');
    openButton.type = 'button';
    openButton.textContent = 'Open';
    openButton.addEventListener('click', (event) => {
      event.stopPropagation();
      if (episode.url) {
        browserApi.tabs.create({ url: episode.url });
      }
    });

    item.append(thumb, metadata, openButton);

    item.addEventListener('click', () => setSelectedEpisode(episode.id));
    item.addEventListener('dragstart', (event) => {
      item.classList.add('dragging');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', episode.id);
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
    });

    queueList.appendChild(item);
  });
  setSelectedEpisode(selectedEpisodeId, elementsArg);
};

const ensureLanguageOptions = (elementsArg) => {
  const { audioLanguageSelect } = resolveDomRefs(elementsArg);
  if (!audioLanguageSelect || audioLanguageSelect.childElementCount) {
    return;
  }
  AUDIO_LANGUAGES.forEach((language) => {
    const option = document.createElement('option');
    option.value = language.code;
    option.textContent = `${language.label} (${language.code})`;
    audioLanguageSelect.appendChild(option);
  });
};

const handleDragOver = (event, elementsArg) => {
  const { queueList } = resolveDomRefs(elementsArg);
  if (!queueList) {
    return;
  }
  event.preventDefault();
  const dragging = queueList.querySelector('.dragging');
  if (!dragging) {
    return;
  }
  const afterElement = Array.from(queueList.children)
    .filter((child) => child !== dragging)
    .reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = event.clientY - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      }
      return closest;
    }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
  if (afterElement == null) {
    queueList.appendChild(dragging);
  } else {
    queueList.insertBefore(dragging, afterElement);
  }
};

const handleDrop = (event, elementsArg) => {
  const { queueList } = resolveDomRefs(elementsArg);
  if (!queueList) {
    return;
  }
  event.preventDefault();
  const orderedIds = Array.from(queueList.children).map((child) => child.dataset.id);
  sendMessage({
    type: MESSAGE_TYPES.REORDER_QUEUE,
    payload: { ids: orderedIds }
  });
};

const bindControls = (elementsArg) => {
  const {
    queueList,
    playButton,
    pauseButton,
    removeButton,
    audioLanguageSelect,
    autoRemoveCheckbox,
    debugLoggingCheckbox,
    debugDumpButton,
    lastUpdatedEl,
  } = resolveDomRefs(elementsArg);

  if (queueList) {
    queueList.addEventListener('dragover', (event) => handleDragOver(event, elementsArg));
    queueList.addEventListener('drop', (event) => handleDrop(event, elementsArg));
  }

  playButton?.addEventListener('click', async () => {
    if (!selectedEpisodeId) {
      sendMessage({
        type: MESSAGE_TYPES.CONTROL_PLAYBACK,
        payload: { action: 'play' }
      });
      return;
    }
    const episode = appState.queue.find((item) => item.id === selectedEpisodeId);
    if (episode?.url) {
      await browserApi.tabs.create({ url: episode.url });
      sendMessage({
        type: MESSAGE_TYPES.SELECT_EPISODE,
        payload: { id: selectedEpisodeId }
      });
    }
    sendMessage({
      type: MESSAGE_TYPES.CONTROL_PLAYBACK,
      payload: { action: 'play' }
    });
  });

  pauseButton?.addEventListener('click', () => {
    sendMessage({
      type: MESSAGE_TYPES.CONTROL_PLAYBACK,
      payload: { action: 'pause' }
    });
  });

  removeButton?.addEventListener('click', () => {
    if (!selectedEpisodeId) {
      return;
    }
    sendMessage({
      type: MESSAGE_TYPES.REMOVE_EPISODE,
      payload: { id: selectedEpisodeId }
    });
    setSelectedEpisode(null, elementsArg);
  });

  audioLanguageSelect?.addEventListener('change', () => {
    const value = audioLanguageSelect.value;
    if (selectedEpisodeId) {
      sendMessage({
        type: MESSAGE_TYPES.SET_AUDIO_LANGUAGE,
        payload: { id: selectedEpisodeId, audioLanguage: value }
      });
    } else {
      sendMessage({
        type: MESSAGE_TYPES.UPDATE_SETTINGS,
        payload: { settings: { defaultAudioLanguage: value } }
      });
    }
  });

  autoRemoveCheckbox?.addEventListener('change', () => {
    sendMessage({
      type: MESSAGE_TYPES.UPDATE_SETTINGS,
      payload: { settings: { autoRemoveCompleted: autoRemoveCheckbox.checked } }
    });
  });

  debugLoggingCheckbox?.addEventListener('change', () => {
    sendMessage({
      type: MESSAGE_TYPES.UPDATE_SETTINGS,
      payload: { settings: { debugLogging: debugLoggingCheckbox.checked } }
    });
  });

  debugDumpButton?.addEventListener('click', async () => {
    try {
      const dump = await sendMessage({ type: MESSAGE_TYPES.REQUEST_DEBUG_DUMP });
      if (dump && navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(JSON.stringify(dump, null, 2));
        const previous = lastUpdatedEl.textContent;
        lastUpdatedEl.textContent = 'Debug info copied';
        setTimeout(() => {
          lastUpdatedEl.textContent = previous;
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to copy debug info', error);
    }
  });
};

const applySettings = (elementsArg) => {
  const { autoRemoveCheckbox, debugLoggingCheckbox, audioLanguageSelect } = resolveDomRefs(elementsArg);
  if (autoRemoveCheckbox) {
    autoRemoveCheckbox.checked = appState.settings.autoRemoveCompleted;
  }
  if (debugLoggingCheckbox) {
    debugLoggingCheckbox.checked = appState.settings.debugLogging;
  }
  if (!selectedEpisodeId && audioLanguageSelect) {
    audioLanguageSelect.value = appState.settings.defaultAudioLanguage;
  }
};

const updateState = (newState, elementsArg) => {
  const { lastUpdatedEl } = resolveDomRefs(elementsArg);
  appState = newState;
  renderPlaybackStatus(elementsArg);
  renderQueue(elementsArg);
  applySettings(elementsArg);
  if (lastUpdatedEl) {
    lastUpdatedEl.textContent = `Updated ${formatTimestamp(appState.lastUpdated)}`;
  }
  if (!selectedEpisodeId && appState.currentEpisodeId) {
    setSelectedEpisode(appState.currentEpisodeId, elementsArg);
  }
};

const init = async ({ elements } = {}) => {
  const refs = setDomRefs(elements ?? {});
  ensureLanguageOptions(refs);
  bindControls(refs);
  const currentState = await sendMessage({ type: MESSAGE_TYPES.GET_STATE });
  if (currentState) {
    updateState(currentState, refs);
  }
  return currentState ?? null;
};

browserApi.runtime.onMessage.addListener((message) => {
  if (message.type === MESSAGE_TYPES.STATE_UPDATED) {
    updateState(message.payload);
  }
});

if (typeof window !== 'undefined' && !window.__ROLLQUEUE_NO_AUTO_INIT__) {
  init();
}

export {
  renderQueue,
  setSelectedEpisode,
  renderPlaybackStatus,
  applySettings,
  bindControls,
  updateState,
  init,
  handleDragOver,
  handleDrop,
  formatTimestamp,
};
