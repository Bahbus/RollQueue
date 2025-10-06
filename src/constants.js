export const AUDIO_LANGUAGES = [
  { code: 'ja-JP', label: 'Japanese' },
  { code: 'en-US', label: 'English' },
  { code: 'es-419', label: 'Spanish (Latin America)' },
  { code: 'es-ES', label: 'Spanish (Spain)' },
  { code: 'pt-BR', label: 'Portuguese (Brazil)' },
  { code: 'fr-FR', label: 'French' },
  { code: 'de-DE', label: 'German' },
  { code: 'it-IT', label: 'Italian' }
];

export const DEFAULT_SETTINGS = {
  autoRemoveCompleted: true,
  debugLogging: false,
  defaultAudioLanguage: AUDIO_LANGUAGES[0].code
};

export const PLAYBACK_STATES = {
  IDLE: 'idle',
  PLAYING: 'playing',
  PAUSED: 'paused',
  ENDED: 'ended'
};

export const MESSAGE_TYPES = {
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
  SET_QUEUE: 'SET_QUEUE',
  APPLY_AUDIO_LANGUAGE: 'APPLY_AUDIO_LANGUAGE'
};

export const STORAGE_KEYS = {
  STATE: 'rollQueueState'
};
