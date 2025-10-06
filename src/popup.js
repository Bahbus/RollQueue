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

const queueList = document.getElementById('queue-list');
const playbackStatus = document.getElementById('playback-status');
const audioLanguageSelect = document.getElementById('audio-language');
const autoRemoveCheckbox = document.getElementById('auto-remove');
const debugLoggingCheckbox = document.getElementById('debug-logging');
const lastUpdatedEl = document.getElementById('last-updated');

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

const renderPlaybackStatus = () => {
  playbackStatus.textContent = appState.playbackState.replace(/^./, (char) => char.toUpperCase());
};

const setSelectedEpisode = (episodeId) => {
  selectedEpisodeId = episodeId;
  Array.from(queueList.children).forEach((child) => {
    child.classList.toggle('selected', child.dataset.id === selectedEpisodeId);
  });
  if (!episodeId) {
    audioLanguageSelect.value = appState.settings.defaultAudioLanguage;
    return;
  }
  const episode = appState.queue.find((item) => item.id === episodeId);
  if (episode) {
    audioLanguageSelect.value = episode.audioLanguage || appState.settings.defaultAudioLanguage;
  }
};

const renderQueue = () => {
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
  setSelectedEpisode(selectedEpisodeId);
};

const ensureLanguageOptions = () => {
  if (audioLanguageSelect.childElementCount) {
    return;
  }
  AUDIO_LANGUAGES.forEach((language) => {
    const option = document.createElement('option');
    option.value = language.code;
    option.textContent = `${language.label} (${language.code})`;
    audioLanguageSelect.appendChild(option);
  });
};

const handleDragOver = (event) => {
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

const handleDrop = (event) => {
  event.preventDefault();
  const orderedIds = Array.from(queueList.children).map((child) => child.dataset.id);
  sendMessage({
    type: MESSAGE_TYPES.REORDER_QUEUE,
    payload: { ids: orderedIds }
  });
};

queueList.addEventListener('dragover', handleDragOver);
queueList.addEventListener('drop', handleDrop);

const bindControls = () => {
  document.getElementById('play-button').addEventListener('click', async () => {
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

  document.getElementById('pause-button').addEventListener('click', () => {
    sendMessage({
      type: MESSAGE_TYPES.CONTROL_PLAYBACK,
      payload: { action: 'pause' }
    });
  });

  document.getElementById('remove-button').addEventListener('click', () => {
    if (!selectedEpisodeId) {
      return;
    }
    sendMessage({
      type: MESSAGE_TYPES.REMOVE_EPISODE,
      payload: { id: selectedEpisodeId }
    });
    setSelectedEpisode(null);
  });

  audioLanguageSelect.addEventListener('change', () => {
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

  autoRemoveCheckbox.addEventListener('change', () => {
    sendMessage({
      type: MESSAGE_TYPES.UPDATE_SETTINGS,
      payload: { settings: { autoRemoveCompleted: autoRemoveCheckbox.checked } }
    });
  });

  debugLoggingCheckbox.addEventListener('change', () => {
    sendMessage({
      type: MESSAGE_TYPES.UPDATE_SETTINGS,
      payload: { settings: { debugLogging: debugLoggingCheckbox.checked } }
    });
  });

  document.getElementById('debug-dump').addEventListener('click', async () => {
    try {
      const dump = await sendMessage({ type: MESSAGE_TYPES.REQUEST_DEBUG_DUMP });
      if (dump) {
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

const applySettings = () => {
  autoRemoveCheckbox.checked = appState.settings.autoRemoveCompleted;
  debugLoggingCheckbox.checked = appState.settings.debugLogging;
  if (!selectedEpisodeId) {
    audioLanguageSelect.value = appState.settings.defaultAudioLanguage;
  }
};

const updateState = (newState) => {
  appState = newState;
  renderPlaybackStatus();
  renderQueue();
  applySettings();
  lastUpdatedEl.textContent = `Updated ${formatTimestamp(appState.lastUpdated)}`;
  if (!selectedEpisodeId && appState.currentEpisodeId) {
    setSelectedEpisode(appState.currentEpisodeId);
  }
};

const init = async () => {
  ensureLanguageOptions();
  bindControls();
  const currentState = await sendMessage({ type: MESSAGE_TYPES.GET_STATE });
  if (currentState) {
    updateState(currentState);
  }
};

browserApi.runtime.onMessage.addListener((message) => {
  if (message.type === MESSAGE_TYPES.STATE_UPDATED) {
    updateState(message.payload);
  }
});

init();
