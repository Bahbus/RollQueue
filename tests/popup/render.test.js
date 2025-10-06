import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest';
import { within } from '@testing-library/dom';
import { loadPopupDom, cleanupDom } from './setup.js';
import { PLAYBACK_STATES, DEFAULT_SETTINGS } from '../../src/constants.js';

const createBrowserMock = () => {
  const sendMessage = vi.fn().mockResolvedValue(null);
  const addListener = vi.fn();
  const getURL = vi.fn((path) => path);
  global.browser = {
    runtime: {
      sendMessage,
      lastError: null,
      onMessage: { addListener },
      getURL,
    },
    tabs: {
      create: vi.fn().mockResolvedValue(undefined),
    },
  };
  return { sendMessage, addListener, getURL };
};

describe('popup rendering helpers', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    cleanupDom();
    vi.restoreAllMocks();
  });

  test('updateState renders queue items, playback status, and timestamps', async () => {
    const { dom, elements } = loadPopupDom();
    window.__ROLLQUEUE_NO_AUTO_INIT__ = true;
    const { sendMessage } = createBrowserMock();
    const { updateState, init } = await import('../../src/popup.js');
    await init({ elements });
    sendMessage.mockClear();

    const toLocaleSpy = vi
      .spyOn(Date.prototype, 'toLocaleTimeString')
      .mockReturnValue('10:00:00 AM');

    const state = {
      queue: [
        {
          id: 'episode-1',
          title: 'Episode One',
          subtitle: 'First adventure',
          audioLanguage: 'ja-JP',
          url: 'https://example.com/1',
        },
        {
          id: 'episode-2',
          title: 'Episode Two',
          subtitle: 'Second adventure',
          audioLanguage: 'fr-FR',
          url: 'https://example.com/2',
        },
      ],
      currentEpisodeId: 'episode-2',
      playbackState: PLAYBACK_STATES.PLAYING,
      settings: {
        ...DEFAULT_SETTINGS,
        defaultAudioLanguage: 'en-US',
        autoRemoveCompleted: true,
        debugLogging: true,
      },
      lastUpdated: Date.now(),
    };

    updateState(state, elements);

    expect(within(elements.queueList).getByText('Episode One').textContent).toBe('Episode One');
    expect(within(elements.queueList).getByText('Second adventure').textContent).toBe('Second adventure');
    expect(elements.playbackStatus.textContent).toBe('Playing');
    expect(elements.lastUpdatedEl.textContent).toBe('Updated 10:00:00 AM');
    expect(elements.audioLanguageSelect.value).toBe('fr-FR');
    expect(elements.autoRemoveCheckbox.checked).toBe(true);
    expect(elements.debugLoggingCheckbox.checked).toBe(true);

    toLocaleSpy.mockRestore();
    dom.window.close();
  });

  test('setSelectedEpisode applies selection styling and falls back to defaults', async () => {
    const { dom, elements } = loadPopupDom();
    window.__ROLLQUEUE_NO_AUTO_INIT__ = true;
    createBrowserMock();
    const { init, updateState, setSelectedEpisode } = await import('../../src/popup.js');
    await init({ elements });

    const state = {
      queue: [
        { id: 'episode-1', title: 'Episode One', subtitle: '', audioLanguage: null },
        { id: 'episode-2', title: 'Episode Two', subtitle: '', audioLanguage: 'ja-JP' },
      ],
      currentEpisodeId: null,
      playbackState: PLAYBACK_STATES.IDLE,
      settings: {
        ...DEFAULT_SETTINGS,
        defaultAudioLanguage: 'en-US',
      },
      lastUpdated: Date.now(),
    };

    updateState(state, elements);

    setSelectedEpisode('episode-2', elements);
    const secondItem = elements.queueList.querySelector('[data-id="episode-2"]');
    expect(secondItem.classList.contains('selected')).toBe(true);
    expect(elements.audioLanguageSelect.value).toBe('ja-JP');

    setSelectedEpisode('episode-1', elements);
    const firstItem = elements.queueList.querySelector('[data-id="episode-1"]');
    expect(firstItem.classList.contains('selected')).toBe(true);
    expect(elements.audioLanguageSelect.value).toBe('en-US');

    setSelectedEpisode(null, elements);
    expect(elements.audioLanguageSelect.value).toBe('en-US');

    dom.window.close();
  });
});
