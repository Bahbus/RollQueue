import { describe, expect, it } from "vitest";
import { AUDIO_LANGUAGES, MESSAGE_TYPES } from "../../src/constants.js";

describe("constants regression", () => {
  it("locks the supported message types", () => {
    expect(MESSAGE_TYPES).toMatchInlineSnapshot(`
      {
        "ADD_EPISODE": "ADD_EPISODE",
        "ADD_EPISODE_AND_NEWER": "ADD_EPISODE_AND_NEWER",
        "APPLY_AUDIO_LANGUAGE": "APPLY_AUDIO_LANGUAGE",
        "CONTROL_PLAYBACK": "CONTROL_PLAYBACK",
        "GET_STATE": "GET_STATE",
        "REMOVE_EPISODE": "REMOVE_EPISODE",
        "REORDER_QUEUE": "REORDER_QUEUE",
        "REQUEST_DEBUG_DUMP": "REQUEST_DEBUG_DUMP",
        "SELECT_EPISODE": "SELECT_EPISODE",
        "SET_AUDIO_LANGUAGE": "SET_AUDIO_LANGUAGE",
        "SET_QUEUE": "SET_QUEUE",
        "STATE_UPDATED": "STATE_UPDATED",
        "UPDATE_PLAYBACK_STATE": "UPDATE_PLAYBACK_STATE",
        "UPDATE_SETTINGS": "UPDATE_SETTINGS",
      }
    `);
  });

  it("locks the audio language options", () => {
    expect(AUDIO_LANGUAGES).toMatchInlineSnapshot(`
      [
        {
          "code": "ja-JP",
          "label": "Japanese",
        },
        {
          "code": "en-US",
          "label": "English",
        },
        {
          "code": "es-419",
          "label": "Spanish (Latin America)",
        },
        {
          "code": "es-ES",
          "label": "Spanish (Spain)",
        },
        {
          "code": "pt-BR",
          "label": "Portuguese (Brazil)",
        },
        {
          "code": "fr-FR",
          "label": "French",
        },
        {
          "code": "de-DE",
          "label": "German",
        },
        {
          "code": "it-IT",
          "label": "Italian",
        },
      ]
    `);
  });
});
