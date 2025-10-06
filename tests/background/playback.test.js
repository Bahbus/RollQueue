import { beforeEach, describe, expect, it } from "vitest";
import {
  AUDIO_LANGUAGES,
  DEFAULT_SETTINGS,
  MESSAGE_TYPES,
  PLAYBACK_STATES
} from "../../src/constants.js";

const getState = async (background) => background.handleMessage({ type: MESSAGE_TYPES.GET_STATE });

describe("background playback controls", () => {
  let background;

  beforeEach(async () => {
    background = await import("../../src/background.js");
    await background.setQueue([]);
    await background.setCurrentEpisode(null);
    await background.setPlaybackState(PLAYBACK_STATES.IDLE);
    await background.updateSettings({ ...DEFAULT_SETTINGS });
    globalThis.browser.tabs.query.mockClear();
    globalThis.browser.tabs.sendMessage.mockClear();
  });

  it("removes the current episode when playback ends and auto-remove is enabled", async () => {
    await background.setQueue([
      { id: "ep-1", title: "Episode 1" },
      { id: "ep-2", title: "Episode 2" }
    ]);
    await background.setCurrentEpisode("ep-1");

    await background.setPlaybackState(PLAYBACK_STATES.ENDED);

    const state = await getState(background);
    expect(state.queue.map((episode) => episode.id)).toEqual(["ep-2"]);
    expect(state.currentEpisodeId).toBeNull();
    expect(state.playbackState).toBe(PLAYBACK_STATES.IDLE);
  });

  it("returns a failure result when no Crunchyroll tab can be controlled", async () => {
    const result = await background.controlPlayback("play");

    expect(result).toEqual({ success: false });
    expect(globalThis.browser.tabs.query).toHaveBeenCalledTimes(1);
    expect(globalThis.browser.tabs.sendMessage).not.toHaveBeenCalled();
  });

  it("delegates playback control to the active Crunchyroll tab when available", async () => {
    const browser = globalThis.browser;
    browser.tabs.__setQueryHandler(async () => [
      { id: 42, active: true, url: "https://www.crunchyroll.com/watch/episode" }
    ]);
    browser.tabs.__setSendMessageHandler(async () => ({ success: true }));

    const response = await background.controlPlayback("pause");

    expect(response).toEqual({ success: true });
    expect(browser.tabs.query).toHaveBeenCalledTimes(1);
    expect(browser.tabs.sendMessage).toHaveBeenCalledTimes(1);
    const [tabId, message] = browser.tabs.sendMessage.mock.calls[0];
    expect(tabId).toBe(42);
    expect(message).toEqual({
      type: MESSAGE_TYPES.CONTROL_PLAYBACK,
      payload: { action: "pause" }
    });
  });

  it("broadcasts audio language updates to all active Crunchyroll tabs", async () => {
    await background.setQueue([
      { id: "episode-a", title: "Episode A" }
    ]);

    const browser = globalThis.browser;
    browser.tabs.__setQueryHandler(async () => [
      { id: 1, active: true, url: "https://www.crunchyroll.com/series" },
      { id: 2, active: true, url: "https://www.crunchyroll.com/watch" }
    ]);
    browser.tabs.sendMessage.mockClear();

    await background.setAudioLanguage("episode-a", AUDIO_LANGUAGES[1].code);

    const state = await getState(background);
    expect(state.queue[0].audioLanguage).toBe(AUDIO_LANGUAGES[1].code);
    expect(browser.tabs.sendMessage).toHaveBeenCalledTimes(2);
    const payloads = browser.tabs.sendMessage.mock.calls.map(([, payload]) => payload);
    payloads.forEach((payload) => {
      expect(payload).toEqual({
        type: MESSAGE_TYPES.APPLY_AUDIO_LANGUAGE,
        payload: {
          audioLanguage: AUDIO_LANGUAGES[1].code,
          label: AUDIO_LANGUAGES[1].label
        }
      });
    });
  });
});
