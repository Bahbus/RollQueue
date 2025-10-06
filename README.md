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
