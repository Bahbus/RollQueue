import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  monitorVideoElement,
  resolveTrackedVideo,
  computePlaybackState,
  contentMessageListener,
  MESSAGE_TYPES,
  PLAYBACK_STATES,
  __testInternals
} from "../../src/content.js";
import { clearDom } from "./dom.fixtures.js";

describe("content playback helpers", () => {
  beforeEach(() => {
    clearDom();
    __testInternals.trackedVideo = null;
    globalThis.browser.runtime.sendMessage.mockClear();
  });

  it("monitors video playback events and updates state", async () => {
    const video = document.createElement("video");
    document.body.append(video);
    let endedState = false;
    Object.defineProperty(video, "ended", {
      configurable: true,
      get: () => endedState,
      set: (value) => {
        endedState = value;
      }
    });

    monitorVideoElement(video);

    const initialCall = globalThis.browser.runtime.sendMessage.mock.calls.at(-1);
    expect(initialCall[0]).toMatchObject({
      type: MESSAGE_TYPES.UPDATE_PLAYBACK_STATE,
      payload: { state: PLAYBACK_STATES.PAUSED }
    });

    video.dispatchEvent(new Event("play"));
    await Promise.resolve();
    const afterPlay = globalThis.browser.runtime.sendMessage.mock.calls.at(-1);
    expect(afterPlay[0]).toMatchObject({
      payload: { state: PLAYBACK_STATES.PLAYING }
    });

    video.ended = true;
    video.dispatchEvent(new Event("pause"));
    await Promise.resolve();
    const afterPause = globalThis.browser.runtime.sendMessage.mock.calls.at(-1);
    expect(afterPause[0]).toMatchObject({
      payload: { state: PLAYBACK_STATES.ENDED }
    });
  });

  it("resolves tracked videos when present or falls back to DOM lookup", () => {
    const video = document.createElement("video");
    document.body.append(video);
    monitorVideoElement(video);

    expect(resolveTrackedVideo()).toBe(video);

    video.remove();
    expect(resolveTrackedVideo()).toBeNull();
  });

  it("derives playback states from video properties", () => {
    expect(computePlaybackState(null)).toBe(PLAYBACK_STATES.IDLE);
    expect(computePlaybackState({ ended: true })).toBe(PLAYBACK_STATES.ENDED);
    expect(computePlaybackState({ paused: true })).toBe(PLAYBACK_STATES.PAUSED);
    expect(computePlaybackState({ paused: false, ended: false })).toBe(PLAYBACK_STATES.PLAYING);
  });

  it("handles CONTROL_PLAYBACK messages for play and pause", async () => {
    const video = document.createElement("video");
    document.body.append(video);
    let pausedState = true;
    Object.defineProperty(video, "paused", {
      configurable: true,
      get: () => pausedState,
      set: (value) => {
        pausedState = value;
      }
    });
    video.play = vi.fn(() => {
      video.paused = false;
      return Promise.resolve();
    });
    video.pause = vi.fn(() => {
      video.paused = true;
    });
    monitorVideoElement(video);

    const sendResponse = vi.fn();
    const result = contentMessageListener(
      { type: MESSAGE_TYPES.CONTROL_PLAYBACK, payload: { action: "play" } },
      {},
      sendResponse
    );
    expect(result).toBe(true);

    await Promise.resolve();
    await Promise.resolve();

    expect(sendResponse).toHaveBeenCalledWith({ success: true, state: PLAYBACK_STATES.PLAYING });
    expect(video.play).toHaveBeenCalled();

    const pauseResponse = vi.fn();
    const pauseResult = contentMessageListener(
      { type: MESSAGE_TYPES.CONTROL_PLAYBACK, payload: { action: "pause" } },
      {},
      pauseResponse
    );
    expect(pauseResult).toBe(false);
    expect(video.pause).toHaveBeenCalled();
    expect(pauseResponse).toHaveBeenCalledWith({ success: true, state: PLAYBACK_STATES.PAUSED });
  });

  it("responds with failure when playback control cannot locate a video", () => {
    const sendResponse = vi.fn();
    __testInternals.trackedVideo = null;

    const result = contentMessageListener(
      { type: MESSAGE_TYPES.CONTROL_PLAYBACK, payload: { action: "play" } },
      {},
      sendResponse
    );

    expect(result).toBe(false);
    expect(sendResponse).toHaveBeenCalledWith({ success: false });
  });
});

