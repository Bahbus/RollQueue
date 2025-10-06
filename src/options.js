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

let activeDocument = typeof document !== 'undefined' ? document : null;

const elements = {
  autoRemoveCheckbox: null,
  debugLoggingCheckbox: null,
  audioLanguageSelect: null,
  clearQueueButton: null,
  exportQueueButton: null,
  importQueueButton: null,
  queueFileInput: null,
  stateDumpEl: null
};

let messageSender = null;
let confirmImpl = null;
let alertImpl = null;

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

const ensureDocument = () => {
  if (!activeDocument) {
    throw new Error('Document is not available. Did you forget to call initOptions?');
  }
  return activeDocument;
};

const getMessageSender = () => messageSender ?? sendMessage;

const getConfirm = () => {
  if (confirmImpl) {
    return confirmImpl;
  }
  const globalConfirm = typeof globalThis.confirm === 'function' ? globalThis.confirm : null;
  return globalConfirm ?? (() => true);
};

const getAlert = () => {
  if (alertImpl) {
    return alertImpl;
  }
  const globalAlert = typeof globalThis.alert === 'function' ? globalThis.alert : null;
  return globalAlert ?? (() => undefined);
};

export const populateLanguages = (
  languages = AUDIO_LANGUAGES,
  select = elements.audioLanguageSelect
) => {
  if (!select) {
    throw new Error('Audio language select element is not available');
  }
  select.innerHTML = '';
  languages.forEach((language) => {
    const option = ensureDocument().createElement('option');
    option.value = language.code;
    option.textContent = `${language.label} (${language.code})`;
    select.appendChild(option);
  });
  return select;
};

export const renderState = (nextState = state) => {
  state = nextState;
  if (elements.autoRemoveCheckbox) {
    elements.autoRemoveCheckbox.checked = Boolean(state.settings.autoRemoveCompleted);
  }
  if (elements.debugLoggingCheckbox) {
    elements.debugLoggingCheckbox.checked = Boolean(state.settings.debugLogging);
  }
  if (elements.audioLanguageSelect) {
    elements.audioLanguageSelect.value = state.settings.defaultAudioLanguage;
  }
  if (elements.stateDumpEl) {
    elements.stateDumpEl.textContent = JSON.stringify(state, null, 2);
  }
  return state;
};

export const requestState = async (sender = getMessageSender()) => {
  const newState = await sender({ type: MESSAGE_TYPES.GET_STATE });
  if (newState) {
    renderState(newState);
  }
  return newState;
};

export const downloadJson = (filename, data, doc = ensureDocument()) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = doc.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  doc.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return anchor;
};

const handleAutoRemoveChange = () => {
  const checkbox = elements.autoRemoveCheckbox;
  if (!checkbox) {
    return;
  }
  getMessageSender()({
    type: MESSAGE_TYPES.UPDATE_SETTINGS,
    payload: { settings: { autoRemoveCompleted: checkbox.checked } }
  });
};

const handleDebugLoggingChange = () => {
  const checkbox = elements.debugLoggingCheckbox;
  if (!checkbox) {
    return;
  }
  getMessageSender()({
    type: MESSAGE_TYPES.UPDATE_SETTINGS,
    payload: { settings: { debugLogging: checkbox.checked } }
  });
};

const handleAudioLanguageChange = () => {
  const select = elements.audioLanguageSelect;
  if (!select) {
    return;
  }
  getMessageSender()({
    type: MESSAGE_TYPES.UPDATE_SETTINGS,
    payload: { settings: { defaultAudioLanguage: select.value } }
  });
};

const handleClearQueue = () => {
  if (getConfirm()('Clear the entire queue?')) {
    getMessageSender()({
      type: MESSAGE_TYPES.SET_QUEUE,
      payload: { queue: [] }
    });
  }
};

const handleExportQueue = async () => {
  const currentState = await getMessageSender()({ type: MESSAGE_TYPES.GET_STATE });
  if (currentState) {
    downloadJson(`rollqueue-export-${Date.now()}.json`, currentState.queue);
  }
};

const handleImportQueue = async () => {
  const input = elements.queueFileInput;
  if (!input) {
    return;
  }
  const [file] = input.files || [];
  if (!file) {
    return;
  }
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!Array.isArray(data)) {
      throw new Error('Invalid queue format');
    }
    await getMessageSender()({
      type: MESSAGE_TYPES.SET_QUEUE,
      payload: { queue: data }
    });
    getAlert()('Queue imported successfully');
  } catch (error) {
    console.error('Failed to import queue', error);
    getAlert()('Failed to import queue. Please make sure the file is valid.');
  } finally {
    input.value = '';
  }
};

const handleImportClick = () => {
  const input = elements.queueFileInput;
  if (input) {
    input.click();
  }
};

const handleRuntimeMessage = (message) => {
  if (message?.type === MESSAGE_TYPES.STATE_UPDATED) {
    renderState(message.payload);
  }
};

const assignElements = (doc) => {
  elements.autoRemoveCheckbox = doc.getElementById('auto-remove');
  elements.debugLoggingCheckbox = doc.getElementById('debug-logging');
  elements.audioLanguageSelect = doc.getElementById('audio-language');
  elements.clearQueueButton = doc.getElementById('clear-queue');
  elements.exportQueueButton = doc.getElementById('export-queue');
  elements.importQueueButton = doc.getElementById('import-queue');
  elements.queueFileInput = doc.getElementById('queue-file');
  elements.stateDumpEl = doc.getElementById('state-dump');
};

let isInitialized = false;

export const initOptions = ({
  document: doc = typeof document !== 'undefined' ? document : null,
  messageSender: customSender,
  confirm: customConfirm,
  alert: customAlert
} = {}) => {
  if (!doc) {
    throw new Error('A document instance is required to initialize options');
  }
  activeDocument = doc;
  assignElements(doc);
  messageSender = customSender ?? sendMessage;
  confirmImpl = customConfirm ?? null;
  alertImpl = customAlert ?? null;

  if (!isInitialized) {
    elements.autoRemoveCheckbox?.addEventListener('change', handleAutoRemoveChange);
    elements.debugLoggingCheckbox?.addEventListener('change', handleDebugLoggingChange);
    elements.audioLanguageSelect?.addEventListener('change', handleAudioLanguageChange);
    elements.clearQueueButton?.addEventListener('click', handleClearQueue);
    elements.exportQueueButton?.addEventListener('click', handleExportQueue);
    elements.importQueueButton?.addEventListener('click', handleImportClick);
    elements.queueFileInput?.addEventListener('change', handleImportQueue);

    if (browserApi?.runtime?.onMessage?.addListener) {
      browserApi.runtime.onMessage.addListener(handleRuntimeMessage);
    }

    isInitialized = true;
  }

  populateLanguages();
  renderState(state);
  return requestState();
};

export const __getInternalState = () => state;
