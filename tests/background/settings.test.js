import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUDIO_LANGUAGES,
  DEFAULT_SETTINGS,
  MESSAGE_TYPES,
  PLAYBACK_STATES,
  STORAGE_KEYS
} from "../../src/constants.js";

const getState = async (background) => background.handleMessage({ type: MESSAGE_TYPES.GET_STATE });

describe("background settings and persistence", () => {
  let background;

  beforeEach(async () => {
    background = await import("../../src/background.js");
    await background.setQueue([]);
    await background.setCurrentEpisode(null);
    await background.setPlaybackState(PLAYBACK_STATES.IDLE);
    await background.updateSettings({ ...DEFAULT_SETTINGS });
    globalThis.browser.storage.local.get.mockClear();
    globalThis.browser.storage.local.set.mockClear();
    globalThis.browser.runtime.sendMessage.mockClear();
  });

  it("merges updated settings and applies the default audio language to existing episodes", async () => {
    const state = await getState(background);
    state.queue = [
      { id: "existing", title: "Existing Episode", audioLanguage: null },
      { id: "another", title: "Another Episode", audioLanguage: undefined }
    ];

    await background.updateSettings({
      defaultAudioLanguage: AUDIO_LANGUAGES[1].code,
      autoRemoveCompleted: false
    });

    expect(state.settings.defaultAudioLanguage).toBe(AUDIO_LANGUAGES[1].code);
    expect(state.settings.autoRemoveCompleted).toBe(false);
    expect(state.queue.every((episode) => episode.audioLanguage === AUDIO_LANGUAGES[1].code)).toBe(true);
  });

  it("persists the current state into extension storage", async () => {
    const state = await getState(background);
    state.queue = [{ id: "persist", title: "Persisted" }];
    state.currentEpisodeId = "persist";
    state.playbackState = PLAYBACK_STATES.PLAYING;

    await background.persistState();

    expect(globalThis.browser.storage.local.set).toHaveBeenCalledWith({
      [STORAGE_KEYS.STATE]: state
    });
  });

  it("loads stored state and merges defaults", async () => {
    const storedState = {
      queue: [{ id: "stored", title: "Stored Episode", audioLanguage: "es-ES" }],
      currentEpisodeId: "stored",
      playbackState: PLAYBACK_STATES.PAUSED,
      settings: {
        defaultAudioLanguage: "es-ES",
        debugLogging: true
      },
      lastUpdated: 12345
    };
    globalThis.browser.__storageStore.set(STORAGE_KEYS.STATE, storedState);

    await background.loadState();

    const state = await getState(background);
    expect(state.queue.map((episode) => episode.id)).toEqual(["stored"]);
    expect(state.currentEpisodeId).toBe("stored");
    expect(state.playbackState).toBe(PLAYBACK_STATES.PAUSED);
    expect(state.settings).toEqual({
      ...DEFAULT_SETTINGS,
      ...storedState.settings
    });
    expect(state.lastUpdated).toBe(12345);
  });

  it("updates timestamps, persists state, and notifies listeners when broadcasting", async () => {
    const originalState = await getState(background);
    const initialTimestamp = originalState.lastUpdated;
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));

    await background.broadcastState();

    const state = await getState(background);
    expect(state.lastUpdated).toBe(new Date("2024-01-01T00:00:00Z").getTime());
    expect(globalThis.browser.storage.local.set).toHaveBeenCalled();
    expect(globalThis.browser.runtime.sendMessage).toHaveBeenCalledWith({
      type: MESSAGE_TYPES.STATE_UPDATED,
      payload: state
    });
    expect(state.lastUpdated).not.toBe(initialTimestamp);
  });

  it("dispatches all supported messages and logs unknown requests", async () => {
    const consoleSpy = vi.spyOn(console, "debug").mockImplementation(() => {});

    await background.handleMessage({
      type: MESSAGE_TYPES.ADD_EPISODE,
      payload: { id: "msg-1", title: "Message Episode" }
    });
    await background.handleMessage({
      type: MESSAGE_TYPES.ADD_EPISODE_AND_NEWER,
      payload: [
        { id: "msg-1", title: "Message Episode" },
        { id: "msg-2", title: "Second" }
      ]
    });
    await background.handleMessage({
      type: MESSAGE_TYPES.REMOVE_EPISODE,
      payload: { id: "msg-1" }
    });
    await background.handleMessage({
      type: MESSAGE_TYPES.REORDER_QUEUE,
      payload: { ids: ["msg-2"] }
    });
    await background.handleMessage({
      type: MESSAGE_TYPES.SELECT_EPISODE,
      payload: { id: "msg-2" }
    });
    await background.handleMessage({
      type: MESSAGE_TYPES.UPDATE_PLAYBACK_STATE,
      payload: { state: PLAYBACK_STATES.PLAYING }
    });
    await background.handleMessage({
      type: MESSAGE_TYPES.CONTROL_PLAYBACK,
      payload: { action: "play" }
    });
    await background.handleMessage({
      type: MESSAGE_TYPES.UPDATE_SETTINGS,
      payload: { settings: { debugLogging: true } }
    });
    await background.handleMessage({
      type: MESSAGE_TYPES.SET_AUDIO_LANGUAGE,
      payload: { id: "msg-2", audioLanguage: AUDIO_LANGUAGES[0].code }
    });
    await background.handleMessage({
      type: MESSAGE_TYPES.SET_QUEUE,
      payload: { queue: [{ id: "msg-3", title: "Another" }] }
    });
    const debugDump = await background.handleMessage({
      type: MESSAGE_TYPES.REQUEST_DEBUG_DUMP
    });
    expect(debugDump).toMatchObject({
      timestamp: expect.any(String),
      audioLanguages: AUDIO_LANGUAGES
    });

    await background.handleMessage({ type: "UNKNOWN_TYPE" });

    expect(consoleSpy).toHaveBeenCalledWith(
      "[RollQueue]",
      "Unknown message",
      { type: "UNKNOWN_TYPE" }
    );
    consoleSpy.mockRestore();
  });
});
