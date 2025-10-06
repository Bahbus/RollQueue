import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setupOptionsDom } from './setup.js';
import { AUDIO_LANGUAGES, DEFAULT_SETTINGS, MESSAGE_TYPES } from '../../src/constants.js';

describe('options control interactions', () => {
  let document;
  let elements;
  let initOptions;
  let sendMessageStub;

  beforeEach(async () => {
    ({ document, elements } = setupOptionsDom());

    browser.runtime.sendMessage.mockReset();
    sendMessageStub = vi.fn((message, callback) => {
      let response;
      if (message.type === MESSAGE_TYPES.GET_STATE) {
        response = {
          queue: [],
          currentEpisodeId: null,
          playbackState: 'idle',
          settings: { ...DEFAULT_SETTINGS },
          lastUpdated: Date.now()
        };
      }
      if (typeof callback === 'function') {
        callback(response);
      }
      return Promise.resolve(response);
    });

    browser.runtime.sendMessage.mockImplementation(sendMessageStub);

    const module = await import('../../src/options.js');
    initOptions = module.initOptions;

    await initOptions({ document });

    sendMessageStub.mockClear();
    globalThis.confirm.mockReset();
    globalThis.confirm.mockImplementation(() => true);
  });

  it('dispatches auto-remove updates when toggled', () => {
    elements.autoRemoveCheckbox.checked = true;
    elements.autoRemoveCheckbox.dispatchEvent(new Event('change', { bubbles: true }));

    expect(sendMessageStub).toHaveBeenCalledTimes(1);
    expect(sendMessageStub).toHaveBeenCalledWith(
      {
        type: MESSAGE_TYPES.UPDATE_SETTINGS,
        payload: { settings: { autoRemoveCompleted: true } }
      },
      expect.any(Function)
    );
  });

  it('dispatches debug logging updates when toggled', () => {
    elements.debugLoggingCheckbox.checked = true;
    elements.debugLoggingCheckbox.dispatchEvent(new Event('change', { bubbles: true }));

    expect(sendMessageStub).toHaveBeenCalledTimes(1);
    expect(sendMessageStub).toHaveBeenCalledWith(
      {
        type: MESSAGE_TYPES.UPDATE_SETTINGS,
        payload: { settings: { debugLogging: true } }
      },
      expect.any(Function)
    );
  });

  it('dispatches audio language updates when selection changes', () => {
    const targetLanguage = AUDIO_LANGUAGES[1]?.code ?? AUDIO_LANGUAGES[0].code;
    elements.audioLanguageSelect.value = targetLanguage;
    elements.audioLanguageSelect.dispatchEvent(new Event('change', { bubbles: true }));

    expect(sendMessageStub).toHaveBeenCalledTimes(1);
    expect(sendMessageStub).toHaveBeenCalledWith(
      {
        type: MESSAGE_TYPES.UPDATE_SETTINGS,
        payload: { settings: { defaultAudioLanguage: targetLanguage } }
      },
      expect.any(Function)
    );
  });

  it('clears queue when confirmation succeeds', () => {
    globalThis.confirm.mockImplementation(() => true);

    elements.clearQueueButton.click();

    expect(globalThis.confirm).toHaveBeenCalledWith('Clear the entire queue?');
    expect(sendMessageStub).toHaveBeenCalledWith(
      {
        type: MESSAGE_TYPES.SET_QUEUE,
        payload: { queue: [] }
      },
      expect.any(Function)
    );
  });

  it('does not clear queue when confirmation is cancelled', () => {
    globalThis.confirm.mockImplementation(() => false);

    elements.clearQueueButton.click();

    expect(globalThis.confirm).toHaveBeenCalledWith('Clear the entire queue?');
    expect(sendMessageStub).not.toHaveBeenCalled();
  });
});
