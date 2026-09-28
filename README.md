# APM Desktop

The desktop app for [APM](https://github.com/aaravmaloo/apm). It is a native window around the same vault engine the `pm` CLI uses, so the app and the CLI always read and write the same vault file, history and audit log.

## How it works

The app has three layers:

1. **Backend.** `pm desktop`, a hidden subcommand of the `pm` CLI. It owns everything that touches the vault: encryption, saving, history, audit, sessions, recovery, sync, AI access and the browser extension bridge on `127.0.0.1:41417`.
2. **Shell.** Electron (`electron/`). It starts `pm desktop --vault <path>` as a child process and speaks line delimited JSON with it over stdin and stdout. It also owns the window, the menu, the clipboard (with auto clear), file dialogs and sleep or screen lock notifications.
3. **Renderer.** The React app in `renderer/`, bundled with rolldown into `dist/`. It only talks to `window.apm`, which the preload script and `renderer/web-shim.js` provide.

The vault password never leaves the backend process. The renderer runs sandboxed with context isolation and a strict content security policy.

## Develop

This repo builds on its own. You need Node 20.19 or 22.12 or newer, Go 1.25 or newer, and git.

```sh
npm install
npm run build:backend   # go build the pm binary into bin/pm
npm run build           # bundle the renderer into dist/
npm start               # open the app
npm run dev             # all three steps in one go
npm run build:watch     # rebuild the renderer on every change
npm test                # shell tests (node --test)
```

### Where the backend comes from

`npm run build:backend` compiles `pm` from the first source it finds:

1. `APM_SRC=<path>` or `--src <path>`.
2. A `CLI` folder next to this one.
3. Otherwise it clones the CLI (`APM_CLI_REPO`, default https://github.com/aaravmaloo/apm.git, at `APM_CLI_REF`, default `master`) into `.cache/cli` and builds that.

It then checks that the binary has the `desktop` command and stops with a clear message if the source is too old. Without Go, it keeps an existing `bin/pm`, `APM_PM_PATH` or a `pm` on your PATH, and says which one the app will use.

### The design system

The app builds from a copy of the design system in `vendor/design-system` (tokens, themes, the component bundle, types and fonts), so a fresh clone needs nothing else. The design system itself lives in its own folder or repo. After changing it, run `npm run ds:sync` here (with the design system next to this folder, or `APM_DESIGN_SYSTEM=<path>`), then commit `vendor/design-system`. `npm run build` prints a note when the design system next to it has changes that were not synced.

### Web bridge

`npm run web` builds the renderer and serves it on http://127.0.0.1:4417 with the real backend behind it, so the whole app can be driven from any browser or a headless one. By default it keeps its vault, `HOME` and `TMPDIR` in a fresh temporary folder, so it never touches your real vault. Useful flags: `--port`, `--dir` (sandbox folder), `--vault` (vault file), `--inherit-home` (use your own `HOME`). Extra test endpoints: `GET /clipboard`, `GET /state`, `POST /test/menu`, `POST /test/power`.

## Where data lives

- **Vault file.** Chosen in this order: the path saved in Settings, `APM_VAULT_PATH`, `vault.dat` next to the `pm` found on your `PATH` (where the CLI keeps it), `~/Desktop/apm/vault.dat` when it exists, then `~/.apm/vault.dat`.
- **APM data** (audit log, history snapshots, sessions, AI tokens, the extension bridge token). The same folder the CLI uses: `~/Library/Application Support/apm` on macOS.
- **App preferences** (window, saved vault path). `~/Library/Application Support/APM Desktop/config.json`.

## Which pm binary runs

`APM_PM_PATH` when set, the copy bundled inside the app, `bin/pm` in this folder, then `pm` on your `PATH`.

## Release

`npm run dist` builds the backend, the renderer and an unpacked app for this machine into `release/`. `node scripts/release.mjs --all` builds `release/arm64/APM.app` and `release/amd64/APM.app`. Tags starting with `v` run the same build in CI and publish zipped bundles.
