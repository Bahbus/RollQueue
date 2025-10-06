import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SETTINGS,
  MESSAGE_TYPES,
  PLAYBACK_STATES
} from "../../src/constants.js";
import {
  episodeFactory,
  resetEpisodeFactory
} from "../support/episodeFactory.js";

const getLastBroadcast = () => {
  const stateUpdates = browser.runtime.sendMessage.mock.calls
    .map(([message]) => message)
    .filter((message) => message?.type === MESSAGE_TYPES.STATE_UPDATED);
  return stateUpdates.at(-1);
};

describe("background integration flows", () => {
  let background;

  beforeEach(async () => {
    vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));
    resetEpisodeFactory();

    browser.tabs.__setQueryHandler(async (query) => {
      if (query.currentWindow) {
        return [
          { id: 101, active: true, url: "https://www.crunchyroll.com/watch/alpha" }
        ];
      }
      return [
        { id: 101, active: true, url: "https://www.crunchyroll.com/watch/alpha" },
        { id: 202, active: true, url: "https://www.crunchyroll.com/watch/beta" }
      ];
    });

    background = await import("../../src/background.js");

    await background.setQueue([]);
    await background.setCurrentEpisode(null);
    await background.setPlaybackState(PLAYBACK_STATES.IDLE);
    await background.updateSettings({ ...DEFAULT_SETTINGS });

    browser.runtime.sendMessage.mockClear();
    browser.tabs.sendMessage.mockClear();
    browser.tabs.query.mockClear();
  });

  it("processes queue, audio, and playback messages with auto-removal enabled", async () => {
    const firstEpisode = episodeFactory({ title: "Episode Alpha" });
    const secondEpisode = episodeFactory({ title: "Episode Beta" });
    const thirdEpisode = episodeFactory({ title: "Episode Gamma" });

    await background.handleMessage({
      type: MESSAGE_TYPES.ADD_EPISODE,
      payload: firstEpisode
    });

    await background.handleMessage({
      type: MESSAGE_TYPES.ADD_EPISODE_AND_NEWER,
      payload: [firstEpisode, secondEpisode, thirdEpisode]
    });

    await background.handleMessage({
      type: MESSAGE_TYPES.SET_AUDIO_LANGUAGE,
      payload: { id: secondEpisode.id, audioLanguage: "en-US" }
    });

    await background.handleMessage({
      type: MESSAGE_TYPES.SELECT_EPISODE,
      payload: { id: secondEpisode.id }
    });

    await background.handleMessage({
      type: MESSAGE_TYPES.CONTROL_PLAYBACK,
      payload: { action: "play" }
    });

    const finalState = await background.handleMessage({
      type: MESSAGE_TYPES.UPDATE_PLAYBACK_STATE,
      payload: { state: PLAYBACK_STATES.ENDED }
    });

    expect(finalState.queue.map((episode) => episode.id)).toEqual([
      firstEpisode.id,
      thirdEpisode.id
    ]);
    expect(finalState.currentEpisodeId).toBeNull();
    expect(finalState.playbackState).toBe(PLAYBACK_STATES.IDLE);

    const tabMessages = browser.tabs.sendMessage.mock.calls.map(([tabId, message]) => ({
      tabId,
      message
    }));

    expect(tabMessages).toEqual([
      {
        tabId: 101,
        message: {
          type: MESSAGE_TYPES.APPLY_AUDIO_LANGUAGE,
          payload: {
            audioLanguage: "en-US",
            label: "English"
          }
        }
      },
      {
        tabId: 202,
        message: {
          type: MESSAGE_TYPES.APPLY_AUDIO_LANGUAGE,
          payload: {
            audioLanguage: "en-US",
            label: "English"
          }
        }
      },
      {
        tabId: 101,
        message: {
          type: MESSAGE_TYPES.CONTROL_PLAYBACK,
          payload: {
            action: "play"
          }
        }
      }
    ]);

    expect(browser.tabs.query.mock.calls).toEqual([
      [
        {
          active: true,
          url: ["https://*.crunchyroll.com/*", "http://*.crunchyroll.com/*"]
        }
      ],
      [
        {
          active: true,
          currentWindow: true,
          url: ["https://*.crunchyroll.com/*", "http://*.crunchyroll.com/*"]
        }
      ]
    ]);

    expect(getLastBroadcast()).toMatchInlineSnapshot(`
      {
        "payload": {
          "currentEpisodeId": null,
          "lastUpdated": 1704067200000,
          "playbackState": "idle",
          "queue": [
            {
              "addedAt": 1704067200000,
              "audioLanguage": "ja-JP",
              "audioUrl": "https://example.com/audio-1.mp3",
              "description": "An example episode used for testing.",
              "duration": 1800,
              "guid": "episode-1",
              "id": 1,
              "publishedAt": "2024-01-01T00:00:00.000Z",
              "title": "Episode Alpha",
            },
            {
              "addedAt": 1704067200000,
              "audioLanguage": "ja-JP",
              "audioUrl": "https://example.com/audio-3.mp3",
              "description": "An example episode used for testing.",
              "duration": 1800,
              "guid": "episode-3",
              "id": 3,
              "publishedAt": "2024-01-01T00:00:00.000Z",
              "title": "Episode Gamma",
            },
          ],
          "settings": {
            "autoRemoveCompleted": true,
            "debugLogging": false,
            "defaultAudioLanguage": "ja-JP",
          },
        },
        "type": "STATE_UPDATED",
      }
    `);
  });

  it("toggles auto removal behaviour via settings messages", async () => {
    const episodes = [
      episodeFactory({ title: "Episode One" }),
      episodeFactory({ title: "Episode Two" }),
      episodeFactory({ title: "Episode Three" })
    ];

    await background.handleMessage({
      type: MESSAGE_TYPES.SET_QUEUE,
      payload: { queue: episodes }
    });

    await background.handleMessage({
      type: MESSAGE_TYPES.SELECT_EPISODE,
      payload: { id: episodes[0].id }
    });

    await background.handleMessage({
      type: MESSAGE_TYPES.UPDATE_SETTINGS,
      payload: { settings: { autoRemoveCompleted: false } }
    });

    const noRemovalState = await background.handleMessage({
      type: MESSAGE_TYPES.UPDATE_PLAYBACK_STATE,
      payload: { state: PLAYBACK_STATES.ENDED }
    });

    expect(noRemovalState.queue.map((episode) => episode.id)).toEqual(
      episodes.map((episode) => episode.id)
    );
    expect(noRemovalState.currentEpisodeId).toBe(episodes[0].id);
    expect(noRemovalState.playbackState).toBe(PLAYBACK_STATES.ENDED);

    await background.handleMessage({
      type: MESSAGE_TYPES.SELECT_EPISODE,
      payload: { id: episodes[1].id }
    });

    await background.handleMessage({
      type: MESSAGE_TYPES.UPDATE_SETTINGS,
      payload: { settings: { autoRemoveCompleted: true } }
    });

    const removalState = await background.handleMessage({
      type: MESSAGE_TYPES.UPDATE_PLAYBACK_STATE,
      payload: { state: PLAYBACK_STATES.ENDED }
    });

    expect(removalState.queue.map((episode) => episode.id)).toEqual([
      episodes[0].id,
      episodes[2].id
    ]);
    expect(removalState.currentEpisodeId).toBeNull();
    expect(removalState.playbackState).toBe(PLAYBACK_STATES.IDLE);
  });
});
