# Releasing RollQueue

## Firefox builds

A GitHub Actions workflow builds the Firefox package so that rasterized icons stay out of the repository.

1. Trigger the **Build Firefox Package** workflow manually from the *Actions* tab or wait for it to run when a release is published.
2. The workflow runs on Ubuntu with Node.js 20, executes `npm ci`, runs the Firefox build script to generate the PNG icons and manifest, and zips `dist/firefox/` into `dist/firefox.zip`.
3. Download the `firefox-extension` artifact from the workflow run. The ZIP inside the artifact is what you upload to [addons.mozilla.org](https://addons.mozilla.org/).

Because the PNG binaries are generated during the workflow, they never need to be committed to the repository.
