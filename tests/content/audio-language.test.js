import { beforeEach, describe, expect, it, vi } from "vitest";
import * as content from "../../src/content.js";
import { renderAudioMenu, clearDom } from "./dom.fixtures.js";

const {
  buildLanguageCandidates,
  setVideoAudioTrack,
  applyAudioLanguageDirective,
  contentMessageListener,
  MESSAGE_TYPES,
  PLAYBACK_STATES,
  __testInternals
} = content;

describe("content audio language helpers", () => {
  beforeEach(() => {
    clearDom();
    __testInternals.trackedVideo = null;
    globalThis.browser.runtime.sendMessage.mockClear();
  });

  it("builds normalized language candidates", () => {
    const candidates = buildLanguageCandidates("en-US", "English (US)");
    expect(candidates).toEqual(
      expect.arrayContaining(["en-us", "en", "english", "english (us)"])
    );
  });

  it("enables audio tracks directly when available", () => {
    const audioTracks = [
      { language: "ja-JP", label: "Japanese", enabled: true },
      { language: "en-US", label: "English", enabled: false }
    ];
    const video = { audioTracks };

    const switched = setVideoAudioTrack(video, "en-US", "English");

    expect(switched).toBe(true);
    expect(audioTracks[0].enabled).toBe(false);
    expect(audioTracks[1].enabled).toBe(true);
  });

  it("falls back to selecting audio tracks from the menu", async () => {
    const video = document.createElement("video");
    document.body.append(video);
    Object.defineProperty(video, "audioTracks", {
      configurable: true,
      get() {
        return undefined;
      }
    });

    const { toggle } = renderAudioMenu();

    const switched = await applyAudioLanguageDirective({ audioLanguage: "en-US" });

    expect(switched).toBe(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    const lastMessage = globalThis.browser.runtime.sendMessage.mock.calls.at(-1);
    expect(lastMessage[0]).toMatchObject({
      type: MESSAGE_TYPES.UPDATE_PLAYBACK_STATE,
      payload: { state: PLAYBACK_STATES.PAUSED }
    });
  });

  it("responds to APPLY_AUDIO_LANGUAGE messages with success and failure", async () => {
    const video = document.createElement("video");
    document.body.append(video);
    Object.defineProperty(video, "audioTracks", {
      configurable: true,
      get() {
        return undefined;
      }
    });
    renderAudioMenu();

    const sendResponseSuccess = vi.fn();
    const result = contentMessageListener(
      { type: MESSAGE_TYPES.APPLY_AUDIO_LANGUAGE, payload: { audioLanguage: "en-US" } },
      {},
      sendResponseSuccess
    );

    expect(result).toBe(true);
    await Promise.resolve();
    await vi.runAllTimersAsync();
    await Promise.resolve();
    expect(sendResponseSuccess).toHaveBeenCalledWith({ success: true });

    clearDom();
    const sendResponseFailure = vi.fn();
    const failureResult = contentMessageListener(
      { type: MESSAGE_TYPES.APPLY_AUDIO_LANGUAGE, payload: { audioLanguage: "de-DE" } },
      {},
      sendResponseFailure
    );

    expect(failureResult).toBe(true);
    await Promise.resolve();
    await vi.runAllTimersAsync();
    await Promise.resolve();
    expect(sendResponseFailure).toHaveBeenCalledWith({ success: false });
  });
});

