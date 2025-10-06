import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, MESSAGE_TYPES, PLAYBACK_STATES } from "../../src/constants.js";

const getState = async (background) => background.handleMessage({ type: MESSAGE_TYPES.GET_STATE });

describe("background queue mutations", () => {
  let background;

  beforeEach(async () => {
    background = await import("../../src/background.js");
    await background.setQueue([]);
    await background.setCurrentEpisode(null);
    await background.setPlaybackState(PLAYBACK_STATES.IDLE);
    await background.updateSettings({ ...DEFAULT_SETTINGS });
  });

  it("avoids adding duplicate episodes", async () => {
    const episode = { id: "episode-1", title: "Episode 1" };
    await background.addEpisodes([episode]);
    await background.addEpisodes([episode]);

    const state = await getState(background);
    expect(state.queue).toHaveLength(1);
    expect(state.queue[0].id).toBe("episode-1");
  });

  it("preserves order by appending unspecified episodes when reordering", async () => {
    await background.setQueue([
      { id: "episode-a", title: "Episode A" },
      { id: "episode-b", title: "Episode B" },
      { id: "episode-c", title: "Episode C" }
    ]);

    await background.reorderQueue(["episode-c", "episode-a"]);

    const state = await getState(background);
    expect(state.queue.map((episode) => episode.id)).toEqual([
      "episode-c",
      "episode-a",
      "episode-b"
    ]);
  });

  it("adds only new episodes when handling ADD_EPISODE_AND_NEWER", async () => {
    await background.setQueue([
      { id: "older", title: "Older Episode" },
      { id: "current", title: "Current Episode" }
    ]);
    await background.setCurrentEpisode("current");

    const resultState = await background.handleMessage({
      type: MESSAGE_TYPES.ADD_EPISODE_AND_NEWER,
      payload: [
        { id: "current", title: "Current Episode" },
        { id: "next-1", title: "Next Episode 1" },
        { id: "next-2", title: "Next Episode 2" }
      ]
    });

    expect(resultState.queue.map((episode) => episode.id)).toEqual([
      "older",
      "current",
      "next-1",
      "next-2"
    ]);
    expect(new Set(resultState.queue.map((episode) => episode.id)).size).toBe(4);
  });
});
