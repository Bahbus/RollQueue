import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest';
import { fireEvent } from '@testing-library/dom';
import { loadPopupDom, cleanupDom } from './setup.js';
import { MESSAGE_TYPES, DEFAULT_SETTINGS, PLAYBACK_STATES } from '../../src/constants.js';

const createBrowserMock = () => {
  const sendMessage = vi.fn((message) => {
    if (message.type === MESSAGE_TYPES.REQUEST_DEBUG_DUMP) {
      return Promise.resolve({ ok: true });
    }
    return Promise.resolve();
  });
  const addListener = vi.fn();
  const tabsCreate = vi.fn().mockResolvedValue(undefined);
  const getURL = vi.fn((path) => path);
  global.browser = {
    runtime: {
      sendMessage,
      lastError: null,
      onMessage: { addListener },
      getURL,
    },
    tabs: {
      create: tabsCreate,
    },
  };
  return { sendMessage, addListener, tabsCreate, getURL };
};

describe('popup interactions', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    cleanupDom();
    vi.restoreAllMocks();
  });

  test('drag and drop reorders queue and notifies background', async () => {
    const { elements } = loadPopupDom();
    window.__ROLLQUEUE_NO_AUTO_INIT__ = true;
    const { sendMessage } = createBrowserMock();
    const { init, updateState, handleDragOver, handleDrop } = await import('../../src/popup.js');
    await init({ elements });
    sendMessage.mockClear();

    const state = {
      queue: [
        { id: 'episode-1', title: 'Episode One', subtitle: '', audioLanguage: 'en-US' },
        { id: 'episode-2', title: 'Episode Two', subtitle: '', audioLanguage: 'en-US' },
        { id: 'episode-3', title: 'Episode Three', subtitle: '', audioLanguage: 'en-US' },
      ],
      currentEpisodeId: null,
      playbackState: PLAYBACK_STATES.IDLE,
      settings: { ...DEFAULT_SETTINGS },
      lastUpdated: Date.now(),
    };

    updateState(state, elements);

    Array.from(elements.queueList.children).forEach((child, index) => {
      child.getBoundingClientRect = () => ({ top: index * 50, height: 50 });
    });

    const dragging = elements.queueList.querySelector('[data-id="episode-1"]');
    dragging.classList.add('dragging');

    const dragOverEvent = {
      preventDefault: vi.fn(),
      clientY: 175,
    };

    handleDragOver(dragOverEvent, elements);

    const ordered = Array.from(elements.queueList.children).map((child) => child.dataset.id);
    expect(ordered).toEqual(['episode-2', 'episode-3', 'episode-1']);

    const dropEvent = { preventDefault: vi.fn() };
    handleDrop(dropEvent, elements);

    expect(sendMessage.mock.calls[0][0]).toEqual({
      type: MESSAGE_TYPES.REORDER_QUEUE,
      payload: { ids: ['episode-2', 'episode-3', 'episode-1'] },
    });
  });

  test('control buttons and settings send the correct messages', async () => {
    const { elements } = loadPopupDom();
    window.__ROLLQUEUE_NO_AUTO_INIT__ = true;
    const { sendMessage, tabsCreate } = createBrowserMock();
    const { init, updateState, setSelectedEpisode } = await import('../../src/popup.js');
    await init({ elements });
    sendMessage.mockClear();

    const state = {
      queue: [
        { id: 'episode-1', title: 'Episode One', subtitle: '', audioLanguage: 'en-US', url: null },
        { id: 'episode-2', title: 'Episode Two', subtitle: '', audioLanguage: 'ja-JP', url: 'https://example.com/2' },
      ],
      currentEpisodeId: 'episode-1',
      playbackState: PLAYBACK_STATES.PAUSED,
      settings: {
        ...DEFAULT_SETTINGS,
        defaultAudioLanguage: 'en-US',
      },
      lastUpdated: Date.now(),
    };

    updateState(state, elements);

    setSelectedEpisode(null, elements);
    fireEvent.click(elements.playButton);
    let messages = sendMessage.mock.calls.map(([message]) => message);
    expect(messages).toContainEqual({
      type: MESSAGE_TYPES.CONTROL_PLAYBACK,
      payload: { action: 'play' },
    });

    sendMessage.mockClear();
    await Promise.resolve();

    setSelectedEpisode('episode-2', elements);
    fireEvent.click(elements.playButton);
    await Promise.resolve();
    expect(tabsCreate).toHaveBeenCalledWith({ url: 'https://example.com/2' });
    messages = sendMessage.mock.calls.map(([message]) => message);
    expect(messages).toContainEqual({
      type: MESSAGE_TYPES.SELECT_EPISODE,
      payload: { id: 'episode-2' },
    });
    expect(messages).toContainEqual({
      type: MESSAGE_TYPES.CONTROL_PLAYBACK,
      payload: { action: 'play' },
    });

    sendMessage.mockClear();

    fireEvent.click(elements.pauseButton);
    messages = sendMessage.mock.calls.map(([message]) => message);
    expect(messages).toContainEqual({
      type: MESSAGE_TYPES.CONTROL_PLAYBACK,
      payload: { action: 'pause' },
    });

    sendMessage.mockClear();

    fireEvent.click(elements.removeButton);
    messages = sendMessage.mock.calls.map(([message]) => message);
    expect(messages).toContainEqual({
      type: MESSAGE_TYPES.REMOVE_EPISODE,
      payload: { id: 'episode-2' },
    });

    sendMessage.mockClear();

    elements.audioLanguageSelect.value = 'fr-FR';
    fireEvent.change(elements.audioLanguageSelect);
    messages = sendMessage.mock.calls.map(([message]) => message);
    expect(messages).toContainEqual({
      type: MESSAGE_TYPES.UPDATE_SETTINGS,
      payload: { settings: { defaultAudioLanguage: 'fr-FR' } },
    });

    sendMessage.mockClear();

    setSelectedEpisode('episode-1', elements);
    elements.audioLanguageSelect.value = 'en-US';
    fireEvent.change(elements.audioLanguageSelect);
    messages = sendMessage.mock.calls.map(([message]) => message);
    expect(messages).toContainEqual({
      type: MESSAGE_TYPES.SET_AUDIO_LANGUAGE,
      payload: { id: 'episode-1', audioLanguage: 'en-US' },
    });

    sendMessage.mockClear();

    elements.autoRemoveCheckbox.checked = true;
    fireEvent.change(elements.autoRemoveCheckbox);
    messages = sendMessage.mock.calls.map(([message]) => message);
    expect(messages).toContainEqual({
      type: MESSAGE_TYPES.UPDATE_SETTINGS,
      payload: { settings: { autoRemoveCompleted: true } },
    });

    sendMessage.mockClear();

    elements.debugLoggingCheckbox.checked = true;
    fireEvent.change(elements.debugLoggingCheckbox);
    messages = sendMessage.mock.calls.map(([message]) => message);
    expect(messages).toContainEqual({
      type: MESSAGE_TYPES.UPDATE_SETTINGS,
      payload: { settings: { debugLogging: true } },
    });
  });

  test('debug dump respects clipboard availability', async () => {
    vi.useFakeTimers();
    const { elements } = loadPopupDom();
    window.__ROLLQUEUE_NO_AUTO_INIT__ = true;
    const { sendMessage } = createBrowserMock();
    const { init, updateState } = await import('../../src/popup.js');
    await init({ elements });
    sendMessage.mockClear();

    updateState(
      {
        queue: [],
        currentEpisodeId: null,
        playbackState: PLAYBACK_STATES.IDLE,
        settings: { ...DEFAULT_SETTINGS },
        lastUpdated: Date.now(),
      },
      elements
    );

    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    await fireEvent.click(elements.debugDumpButton);
    expect(sendMessage).toHaveBeenCalled();
    expect(sendMessage.mock.calls[0][0]).toEqual({ type: MESSAGE_TYPES.REQUEST_DEBUG_DUMP });

    sendMessage.mockClear();

    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    const previousText = elements.lastUpdatedEl.textContent;
    await fireEvent.click(elements.debugDumpButton);
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith(JSON.stringify({ ok: true }, null, 2));
    expect(elements.lastUpdatedEl.textContent).toBe('Debug info copied');

    vi.runAllTimers();
    expect(elements.lastUpdatedEl.textContent).toBe(previousText);

    vi.useRealTimers();
  });
});
