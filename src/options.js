import {
  AUDIO_LANGUAGES,
  MESSAGE_TYPES,
  DEFAULT_SETTINGS
} from './constants.js';

const browserApi = typeof browser !== 'undefined' ? browser : chrome;

let state = {
  queue: [],
  currentEpisodeId: null,
  playbackState: 'idle',
  settings: { ...DEFAULT_SETTINGS },
  lastUpdated: Date.now()
};

const autoRemoveCheckbox = document.getElementById('auto-remove');
const debugLoggingCheckbox = document.getElementById('debug-logging');
const audioLanguageSelect = document.getElementById('audio-language');
const clearQueueButton = document.getElementById('clear-queue');
const exportQueueButton = document.getElementById('export-queue');
const importQueueButton = document.getElementById('import-queue');
const queueFileInput = document.getElementById('queue-file');
const stateDumpEl = document.getElementById('state-dump');

const sendMessage = (message) => browserApi.runtime.sendMessage(message);

const populateLanguages = () => {
  AUDIO_LANGUAGES.forEach((language) => {
    const option = document.createElement('option');
    option.value = language.code;
    option.textContent = `${language.label} (${language.code})`;
    audioLanguageSelect.appendChild(option);
  });
};

const renderState = () => {
  autoRemoveCheckbox.checked = state.settings.autoRemoveCompleted;
  debugLoggingCheckbox.checked = state.settings.debugLogging;
  audioLanguageSelect.value = state.settings.defaultAudioLanguage;
  stateDumpEl.textContent = JSON.stringify(state, null, 2);
};

const requestState = async () => {
  const newState = await sendMessage({ type: MESSAGE_TYPES.GET_STATE });
  if (newState) {
    state = newState;
    renderState();
  }
};

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

audioLanguageSelect.addEventListener('change', () => {
  sendMessage({
    type: MESSAGE_TYPES.UPDATE_SETTINGS,
    payload: { settings: { defaultAudioLanguage: audioLanguageSelect.value } }
  });
});

clearQueueButton.addEventListener('click', () => {
  if (confirm('Clear the entire queue?')) {
    sendMessage({
      type: MESSAGE_TYPES.SET_QUEUE,
      payload: { queue: [] }
    });
  }
});

const downloadJson = (filename, data) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

exportQueueButton.addEventListener('click', async () => {
  const currentState = await sendMessage({ type: MESSAGE_TYPES.GET_STATE });
  if (currentState) {
    downloadJson(`rollqueue-export-${Date.now()}.json`, currentState.queue);
  }
});

importQueueButton.addEventListener('click', () => {
  queueFileInput.click();
});

queueFileInput.addEventListener('change', async () => {
  const [file] = queueFileInput.files;
  if (!file) {
    return;
  }
  const text = await file.text();
  try {
    const data = JSON.parse(text);
    if (!Array.isArray(data)) {
      throw new Error('Invalid queue format');
    }
    await sendMessage({
      type: MESSAGE_TYPES.SET_QUEUE,
      payload: { queue: data }
    });
    alert('Queue imported successfully');
  } catch (error) {
    console.error('Failed to import queue', error);
    alert('Failed to import queue. Please make sure the file is valid.');
  } finally {
    queueFileInput.value = '';
  }
});

browserApi.runtime.onMessage.addListener((message) => {
  if (message.type === MESSAGE_TYPES.STATE_UPDATED) {
    state = message.payload;
    renderState();
  }
});

populateLanguages();
requestState();
