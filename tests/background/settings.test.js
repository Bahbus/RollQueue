import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUDIO_LANGUAGES,
  DEFAULT_SETTINGS,
  MESSAGE_TYPES,
  PLAYBACK_STATES,
  STORAGE_KEYS
} from "../../src/constants.js";
import { describeMessageHandler } from "../support/templates.js";
import { episodeFactory } from "../support/episodeFactory.js";

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

  describeMessageHandler({
    name: "background message routing",
    getHandler: () => background.handleMessage,
    beforeEach: () => {
      globalThis.browser.runtime.sendMessage.mockClear();
    },
    afterEach: () => {
      globalThis.browser.runtime.sendMessage.mockClear();
    },
    scenarios: [
      {
        description: "adds new episodes when ADD_EPISODE is received",
        type: MESSAGE_TYPES.ADD_EPISODE,
        payload: episodeFactory({ id: "msg-1", title: "Message Episode" }),
        assert: async ({ result }) => {
          expect(result.queue.some((episode) => episode.id === "msg-1")).toBe(true);
        },
        expectedBrowserCalls: [
          {
            api: "runtime.sendMessage",
            matcher: ({ callArgs }) => {
              expect(callArgs[0]).toMatchObject({ type: MESSAGE_TYPES.STATE_UPDATED });
            }
          }
        ]
      },
      {
        description: "appends newer episodes without duplicating existing entries",
        setup: async () => {
          const older = episodeFactory({ id: "older" });
          const current = episodeFactory({ id: "current" });
          await background.setQueue([older, current]);
          await background.setCurrentEpisode("current");
          return { older, current };
        },
        type: MESSAGE_TYPES.ADD_EPISODE_AND_NEWER,
        payload: [
          episodeFactory({ id: "current" }),
          episodeFactory({ id: "new-1" }),
          episodeFactory({ id: "new-2" })
        ],
        assert: async ({ result }) => {
          expect(result.queue.map((episode) => episode.id)).toEqual([
            "older",
            "current",
            "new-1",
            "new-2"
          ]);
        }
      },
      {
        description: "removes episodes when REMOVE_EPISODE is handled",
        setup: async () => {
          const removable = episodeFactory({ id: "remove-me" });
          await background.setQueue([removable]);
          return { removable };
        },
        type: MESSAGE_TYPES.REMOVE_EPISODE,
        payload: { id: "remove-me" },
        assert: async ({ result }) => {
          expect(result.queue.find((episode) => episode.id === "remove-me")).toBeUndefined();
        }
      },
      {
        description: "updates settings and applies queue defaults",
        setup: async () => {
          const state = await background.handleMessage({ type: MESSAGE_TYPES.GET_STATE });
          state.queue = [
            { id: "existing", title: "Existing", audioLanguage: null },
            { id: "another", title: "Another", audioLanguage: undefined }
          ];
        },
        type: MESSAGE_TYPES.UPDATE_SETTINGS,
        payload: { settings: { defaultAudioLanguage: AUDIO_LANGUAGES[1].code } },
        assert: async ({ result }) => {
          expect(result.settings.defaultAudioLanguage).toBe(AUDIO_LANGUAGES[1].code);
          expect(result.queue.every((episode) => episode.audioLanguage === AUDIO_LANGUAGES[1].code)).toBe(true);
        }
      },
      {
        description: "returns diagnostic information for REQUEST_DEBUG_DUMP",
        type: MESSAGE_TYPES.REQUEST_DEBUG_DUMP,
        assert: async ({ result }) => {
          expect(result).toMatchObject({
            timestamp: expect.any(String),
            audioLanguages: AUDIO_LANGUAGES,
            state: expect.any(Object)
          });
        }
      },
      {
        description: "logs unknown messages when debug logging is enabled",
        setup: async () => {
          await background.updateSettings({ debugLogging: true });
          globalThis.browser.runtime.sendMessage.mockClear();
          const consoleSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
          return { consoleSpy };
        },
        message: { type: "UNKNOWN_TYPE" },
        assert: async ({ context }) => {
          expect(context.consoleSpy).toHaveBeenCalledWith(
            "[RollQueue]",
            "Unknown message",
            { type: "UNKNOWN_TYPE" }
          );
        },
        teardown: async ({ context }) => {
          context.consoleSpy.mockRestore();
        }
      }
    ]
  });
});
