# Testing Implementation Task List

This document breaks down the previously defined test strategy into actionable tasks. Tasks are grouped by functional area so they can be split across contributors as needed. Use the checkboxes to track progress.

## Tooling & Harness Setup
- [ ] Add Vitest (or Jest in ESM mode) along with jsdom support to the project dev dependencies.
- [ ] Create a `tests/support` folder with helpers for episode fixtures, timer stubs, and common browser API mocks (`runtime`, `storage.local`, `tabs`).
- [ ] Provide a reusable mock for Crunchyroll tab messaging (`browser.tabs.query`/`sendMessage`).
- [ ] Configure coverage reporting and ensure it runs as part of the test command.

## Background Service Worker Tests
- [ ] Write unit tests covering queue mutations: `addEpisodes`, `removeEpisode`, `reorderQueue`, `setCurrentEpisode`, and `setQueue`, including duplicate handling and order preservation.
- [ ] Add fixtures and tests to verify the "current and newer" queueing path via `handleMessage`.
- [ ] Test playback transitions in `setPlaybackState`, confirming completed episodes are removed when configured.
- [ ] Cover `controlPlayback` behavior when tabs are missing or messaging fails.
- [ ] Test settings flows in `updateSettings`, including default language propagation and `broadcastState` triggering.
- [ ] Verify `setAudioLanguage` updates queue entries and notifies active Crunchyroll tabs.
- [ ] Exercise persistence helpers (`loadState`, `persistState`, `broadcastState`) against mocked `storage.local`.
- [ ] Ensure `handleMessage` dispatch has tests for every `MESSAGE_TYPES` entry, including logging for unexpected types.

## Content Script Tests
- [ ] Build jsdom fixtures to validate `annotateEpisodeCards` and `gatherEpisodesFromCard` capture episode metadata for single and "add newer" actions.
- [ ] Test `injectMenuItems` for idempotent menu injection and correct message dispatch for queueing actions.
- [ ] Cover playback monitoring utilities (`resolveTrackedVideo`, `monitorVideoElement`, `computePlaybackState`) across play/pause/end events.
- [ ] Test audio language helpers (`buildLanguageCandidates`, `setVideoAudioTrack`, `selectAudioTrackFromMenu`, `applyAudioLanguageDirective`) for both direct track selection and menu fallback flows.
- [ ] Ensure message listeners respond correctly to `APPLY_AUDIO_LANGUAGE` and `CONTROL_PLAYBACK`, including error handling paths.

## Popup UI Tests
- [ ] Use Testing Library with jsdom to render the popup and verify `renderQueue`, `setSelectedEpisode`, and `renderPlaybackStatus` reflect state updates.
- [ ] Simulate drag-and-drop events to cover `handleDragOver` and `handleDrop`, ensuring queue reorder messages are emitted.
- [ ] Test control bindings for play, pause, remove, and audio-language toggles, including behavior when no episode is selected.
- [ ] Confirm `applySettings` mirrors settings state even when no episode is selected.

## Options Page Tests
- [ ] Test `populateLanguages`, `renderState`, and `requestState` for correct control population and handling of `STATE_UPDATED` messages.
- [ ] Add tests for JSON import/export helpers (`downloadJson`, import validation) to confirm queue replacement and error reporting.

## Integration & Regression Coverage
- [ ] Create integration-style tests that instantiate the background module with mocked `browser` APIs to exercise key message flows (`ADD_EPISODE`, `ADD_EPISODE_AND_NEWER`, `SET_AUDIO_LANGUAGE`, playback commands).
- [ ] Add regression tests or snapshots for `MESSAGE_TYPES` and `AUDIO_LANGUAGES` to require explicit updates when new entries are introduced.

## Future/Planned Function Support
- [ ] Build reusable test templates (e.g., `describeMessageHandler`, `describeMenuAction`) so new message types automatically receive baseline coverage.
- [ ] Extend fixture builders to accept optional future metadata fields, ensuring forward compatibility for planned features.

## Test Template Usage

To streamline the scenarios above, reusable helpers now live in `tests/support/templates.js`.

- **`describeMessageHandler`** wraps a suite of message-routing assertions. Provide a `getHandler` callback that resolves to the function under test and list `scenarios` with `type`/`payload` or a full `message`, optional `setup`/`teardown`, and `expectedBrowserCalls` for automatic `browser.*` verification. Each scenario can supply an `assert` callback that receives `{ result, context, message }` for custom expectations.
- **`describeMenuAction`** standardizes DOM-driven menu checks by accepting `setup` and `act` callbacks. The helper will run each scenario within its own `it` block, apply any `expectedBrowserCalls`, and execute additional `assert` logic.

See `tests/background/settings.test.js` and `tests/content/menu.test.js` for end-to-end examples that demonstrate how future message types or menu actions can plug into these templates with minimal boilerplate.

The `episodeFactory` helper (`tests/support/episodeFactory.js`) now accepts deep metadata overrides while providing defaults (URL, subtitle, thumbnail, audio language, etc.) that mirror the expectations in `src/background.js`. Override only the fields you care about and the factory will merge the rest.
