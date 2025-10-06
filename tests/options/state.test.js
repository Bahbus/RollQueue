import { beforeEach, describe, expect, it } from 'vitest';
import { setupOptionsDom } from './setup.js';
import { AUDIO_LANGUAGES, DEFAULT_SETTINGS, MESSAGE_TYPES } from '../../src/constants.js';

describe('options state rendering', () => {
  let document;
  let elements;
  let initOptions;
  let renderState;
  let populateLanguages;
  let runtimeListeners;

  beforeEach(async () => {
    ({ document, elements } = setupOptionsDom());
    runtimeListeners = [];
    browser.runtime.onMessage.addListener.mockImplementation((callback) => {
      runtimeListeners.push(callback);
    });
    browser.runtime.sendMessage.__setHandler(async (message) => {
      if (message.type === MESSAGE_TYPES.GET_STATE) {
        return {
          queue: [],
          currentEpisodeId: null,
          playbackState: 'idle',
          settings: { ...DEFAULT_SETTINGS },
          lastUpdated: Date.now()
        };
      }
      return undefined;
    });

    const module = await import('../../src/options.js');
    initOptions = module.initOptions;
    renderState = module.renderState;
    populateLanguages = module.populateLanguages;
  });

  it('populates audio language options during initialization', async () => {
    await initOptions({ document });

    const optionValues = Array.from(elements.audioLanguageSelect.options).map((option) => option.value);
    const optionLabels = Array.from(elements.audioLanguageSelect.options).map((option) => option.textContent);

    expect(optionValues).toEqual(AUDIO_LANGUAGES.map((language) => language.code));
    expect(optionLabels).toEqual(
      AUDIO_LANGUAGES.map((language) => `${language.label} (${language.code})`)
    );
  });

  it('mirrors state values to controls and dump output', async () => {
    await initOptions({ document });

    const updatedState = {
      queue: [{ id: 'episode-1' }],
      currentEpisodeId: 'episode-1',
      playbackState: 'playing',
      settings: {
        ...DEFAULT_SETTINGS,
        autoRemoveCompleted: true,
        debugLogging: true,
        defaultAudioLanguage: AUDIO_LANGUAGES[1].code
      },
      lastUpdated: 123456789
    };

    renderState(updatedState);

    expect(elements.autoRemoveCheckbox.checked).toBe(true);
    expect(elements.debugLoggingCheckbox.checked).toBe(true);
    expect(elements.audioLanguageSelect.value).toBe(updatedState.settings.defaultAudioLanguage);
    expect(JSON.parse(elements.stateDumpEl.textContent)).toEqual(updatedState);
  });

  it('updates rendered state when receiving STATE_UPDATED runtime messages', async () => {
    await initOptions({ document });

    expect(runtimeListeners).toHaveLength(1);
    const [listener] = runtimeListeners;

    const broadcastState = {
      queue: [{ id: 'ep-2' }],
      currentEpisodeId: 'ep-2',
      playbackState: 'paused',
      settings: {
        ...DEFAULT_SETTINGS,
        autoRemoveCompleted: false,
        debugLogging: true,
        defaultAudioLanguage: AUDIO_LANGUAGES[2].code
      },
      lastUpdated: 987654321
    };

    listener({ type: MESSAGE_TYPES.STATE_UPDATED, payload: broadcastState });

    expect(elements.debugLoggingCheckbox.checked).toBe(true);
    expect(elements.autoRemoveCheckbox.checked).toBe(false);
    expect(elements.audioLanguageSelect.value).toBe(broadcastState.settings.defaultAudioLanguage);
    expect(JSON.parse(elements.stateDumpEl.textContent)).toEqual(broadcastState);
  });

  it('clears and repopulates languages when populateLanguages is called manually', async () => {
    await initOptions({ document });

    const select = elements.audioLanguageSelect;
    select.appendChild(document.createElement('option')).value = 'extra';

    populateLanguages();

    expect(Array.from(select.options).map((option) => option.value)).toEqual(
      AUDIO_LANGUAGES.map((language) => language.code)
    );
  });
});
