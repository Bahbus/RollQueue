# RollQueue

RollQueue is a Firefox WebExtension that builds a performant queueing and playback companion for Crunchyroll. It keeps track of episodes you want to watch next, offers quick language and playback controls, and injects queue actions directly onto Crunchyroll episode cards.

## Features

- **Queue management** – add single episodes or whole upcoming runs from the Crunchyroll UI, drag & drop to reorder, and open items directly from the popup.
- **Playback awareness** – content scripts monitor the Crunchyroll player and keep the extension aware of whether the current episode is playing, paused, or finished.
- **Audio language control** – choose between the most common Crunchyroll audio language tracks for the queue or individual episodes.
- **Smart cleanup** – optionally remove items from the queue once the episode ends.
- **Debug friendly** – surface queue state, export/import helpers, and a one-click debug info dump for troubleshooting.

## Getting started

1. Run `npm install` if you plan to add tooling (none is required for the vanilla extension bundle).
2. Open `about:debugging` in Firefox and choose **This Firefox**.
3. Click **Load Temporary Add-on…** and select the repository's `manifest.json`.
4. Navigate to a Crunchyroll episode list to try the injected menu items, or open the extension popup to manage your queue.

## Testing

This project uses [Vitest](https://vitest.dev/) for unit testing. After installing dependencies you can use the following npm scripts:

- `npm test` – run the complete test suite once in a Node environment configured with JSDOM.
- `npm run test:watch` – start Vitest in watch mode for rapid feedback during development.
- `npm run test:coverage` – execute the suite with V8 coverage reporting enabled. HTML, text, and LCOV reports are written to the default Vitest output directory.

To run an individual suite, append the test file path to the command. For example, `npm test -- tests/example.test.js` executes only the specified file. All CLI flags supported by Vitest are also available, such as `npm test -- --runInBand` for serial execution.

Integration suites under `tests/integration` exercise the background service worker end-to-end with the browser mock, while regression suites in `tests/regression` snapshot shared constants. Both categories run automatically as part of `npm test`, ensuring state transitions and cross-module contracts stay in sync during continuous integration.

## Project structure

```
manifest.json          # Extension manifest
src/
  background.js        # Service worker managing queue state
  content.js           # Injects menu items and monitors playback
  content.css          # Menu styling to match Crunchyroll UI
  popup.html/css/js    # Queue UI, drag & drop, playback controls
  options.html/css/js  # Advanced settings and queue import/export
  constants.js         # Shared enums and defaults
assets/                # Extension icons
```

## Development tips

- Background, popup, and options scripts share constants via ES modules.
- Content scripts dynamically annotate Crunchyroll episode cards to ensure menu actions receive rich metadata.
- Debug logging can be toggled from the popup or options page if you need to inspect state transitions.
