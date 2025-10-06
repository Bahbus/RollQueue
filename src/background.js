import {
  AUDIO_LANGUAGES,
  DEFAULT_SETTINGS,
  MESSAGE_TYPES,
  PLAYBACK_STATES,
  STORAGE_KEYS
} from './constants.js';

const browserApi = typeof browser !== 'undefined' ? browser : chrome;

let state = {
  queue: [],
  currentEpisodeId: null,
  playbackState: PLAYBACK_STATES.IDLE,
  settings: { ...DEFAULT_SETTINGS },
  lastUpdated: Date.now()
};

const persistState = async () => {
  await browserApi.storage.local.set({
    [STORAGE_KEYS.STATE]: state
  });
};

const loadState = async () => {
  const stored = await browserApi.storage.local.get(STORAGE_KEYS.STATE);
  if (stored && stored[STORAGE_KEYS.STATE]) {
    const storedState = stored[STORAGE_KEYS.STATE];
    state = {
      queue: storedState.queue ?? [],
      currentEpisodeId: storedState.currentEpisodeId ?? null,
      playbackState: storedState.playbackState ?? PLAYBACK_STATES.IDLE,
      settings: { ...DEFAULT_SETTINGS, ...(storedState.settings || {}) },
      lastUpdated: storedState.lastUpdated ?? Date.now()
    };
  } else {
    await persistState();
  }
};

const debugLog = (...args) => {
  if (state.settings.debugLogging) {
    console.debug('[RollQueue]', ...args);
  }
};

const broadcastState = async () => {
  state.lastUpdated = Date.now();
  await persistState();
  debugLog('Broadcasting state', state);
  browserApi.runtime.sendMessage({
    type: MESSAGE_TYPES.STATE_UPDATED,
    payload: state
  }).catch(() => {
    // No active listeners.
  });
};

const findEpisodeIndex = (episodeId) => state.queue.findIndex((item) => item.id === episodeId);

const ensureAudioLanguage = (episode) => ({
  ...episode,
  audioLanguage: episode.audioLanguage || state.settings.defaultAudioLanguage
});

const addEpisodes = async (episodes) => {
  let added = false;
  episodes.forEach((rawEpisode) => {
    const episode = ensureAudioLanguage(rawEpisode);
    if (findEpisodeIndex(episode.id) === -1) {
      state.queue.push({ ...episode, addedAt: Date.now() });
      added = true;
    }
  });
  if (added) {
    await broadcastState();
  }
  return added;
};

const removeEpisode = async (episodeId) => {
  const index = findEpisodeIndex(episodeId);
  if (index !== -1) {
    const [removed] = state.queue.splice(index, 1);
    debugLog('Removed episode', removed);
    if (state.currentEpisodeId === episodeId) {
      state.currentEpisodeId = null;
      state.playbackState = PLAYBACK_STATES.IDLE;
    }
    await broadcastState();
  }
};

const reorderQueue = async (orderedIds) => {
  const newQueue = [];
  orderedIds.forEach((id) => {
    const item = state.queue.find((episode) => episode.id === id);
    if (item) {
      newQueue.push(item);
    }
  });
  // Append any episodes that weren't included to preserve queue.
  state.queue.forEach((episode) => {
    if (!orderedIds.includes(episode.id)) {
      newQueue.push(episode);
    }
  });
  state.queue = newQueue;
  await broadcastState();
};

const setCurrentEpisode = async (episodeId) => {
  if (episodeId && findEpisodeIndex(episodeId) === -1) {
    debugLog('Attempted to select unknown episode', episodeId);
    return;
  }
  state.currentEpisodeId = episodeId;
  await broadcastState();
};

const setPlaybackState = async (playbackState) => {
  state.playbackState = playbackState;
  if (
    playbackState === PLAYBACK_STATES.ENDED &&
    state.settings.autoRemoveCompleted &&
    state.currentEpisodeId
  ) {
    await removeEpisode(state.currentEpisodeId);
  } else {
    await broadcastState();
  }
};

const updateSettings = async (settingsUpdate) => {
  state.settings = {
    ...state.settings,
    ...settingsUpdate
  };
  if (settingsUpdate.defaultAudioLanguage) {
    state.queue = state.queue.map((episode) => ({
      ...episode,
      audioLanguage: episode.audioLanguage || state.settings.defaultAudioLanguage
    }));
  }
  await broadcastState();
};

const setAudioLanguage = async (episodeId, audioLanguage) => {
  const index = findEpisodeIndex(episodeId);
  if (index !== -1) {
    state.queue[index] = {
      ...state.queue[index],
      audioLanguage
    };
    await broadcastState();
  }
};

const setQueue = async (episodes) => {
  state.queue = episodes.map((episode) => ensureAudioLanguage(episode));
  await broadcastState();
};

const handleMessage = async (message) => {
  switch (message.type) {
    case MESSAGE_TYPES.GET_STATE:
      return state;
    case MESSAGE_TYPES.ADD_EPISODE:
      await addEpisodes([message.payload]);
      return state;
    case MESSAGE_TYPES.ADD_EPISODE_AND_NEWER:
      await addEpisodes(message.payload);
      return state;
    case MESSAGE_TYPES.REMOVE_EPISODE:
      await removeEpisode(message.payload.id);
      return state;
    case MESSAGE_TYPES.REORDER_QUEUE:
      await reorderQueue(message.payload.ids);
      return state;
    case MESSAGE_TYPES.SELECT_EPISODE:
      await setCurrentEpisode(message.payload.id);
      return state;
    case MESSAGE_TYPES.UPDATE_PLAYBACK_STATE:
      await setPlaybackState(message.payload.state);
      return state;
    case MESSAGE_TYPES.UPDATE_SETTINGS:
      await updateSettings(message.payload.settings);
      return state;
    case MESSAGE_TYPES.SET_AUDIO_LANGUAGE:
      await setAudioLanguage(message.payload.id, message.payload.audioLanguage);
      return state;
    case MESSAGE_TYPES.SET_QUEUE:
      await setQueue(message.payload.queue);
      return state;
    case MESSAGE_TYPES.REQUEST_DEBUG_DUMP:
      return {
        timestamp: new Date().toISOString(),
        audioLanguages: AUDIO_LANGUAGES,
        state
      };
    default:
      debugLog('Unknown message', message);
  }
  return state;
};

browserApi.runtime.onMessage.addListener((message, sender) => {
  debugLog('Received message', message, sender?.tab?.id);
  return handleMessage(message);
});

browserApi.runtime.onInstalled.addListener(async () => {
  await loadState();
  await broadcastState();
});

loadState().then(broadcastState);
