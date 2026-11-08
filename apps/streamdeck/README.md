# Nxt Stream Deck plugin

The Elgato Stream Deck plugin (`dev.zedsoftworks.nxt`) that runs a Community's
Queue from a **Paired deck** (see `CONTEXT.md`, ADR-0006 and spec #20).

- `src/controller.ts`: the deck controller. All key behaviour, no SDK types.
- `src/pairing.ts`: the pairing flow (start, show the code and link, poll).
- `src/keyImage.ts`: draws a key's appearance as an SVG data URL.
- `src/plugin.ts`: the thin SDK adapter that wires these to `@elgato/streamdeck`.
- `dev.zedsoftworks.nxt.sdPlugin/`: the plugin folder: manifest, images and
  the Property Inspector (`ui/key.html`). `bin/` is build output.

The deck secret is kept only in the plugin's global settings. Never log it,
and never set the SDK log level to `trace`.

## Configuration

An installed plugin has no `.env`, so the build bakes two values in from the
repo's `.env` (or the shell):

| Variable | Used for | Default |
|---|---|---|
| `CONVEX_URL`, else `NEXT_PUBLIC_CONVEX_URL` | the Convex deployment | none: the plugin stays offline |
| `DASHBOARD_URL` | the pairing link's origin | `http://localhost:3000` |

An empty value counts as unset. `build` warns about a missing value;
`package` fails, so a release can't ship offline or with localhost pairing
links. For a Marketplace build, set both to production:

```sh
CONVEX_URL=https://<prod>.convex.cloud DASHBOARD_URL=https://nxtbot.app pnpm --filter @nxt/streamdeck package
```

## Scripts

- `pnpm build`: bundle `src/plugin.ts` into `*.sdPlugin/bin/plugin.js` (rollup).
- `pnpm watch`: rebuild on change and restart the plugin in Stream Deck.
- `pnpm package`: build, then `streamdeck pack` into
  `dist/dev.zedsoftworks.nxt.streamDeckPlugin`. `pack` validates the manifest
  first.
- `pnpm validate:plugin`: validate the plugin folder only.
- `pnpm images`: regenerate the manifest's icons and default key images from
  `src/keyImage.ts`. The plugin icon PNGs need `rsvg-convert` (librsvg).
- `pnpm test`, `pnpm typecheck`.

`build`, `package` and `validate:plugin` run anywhere. `streamdeck link`,
`restart` and `dev` need the Stream Deck app (macOS or Windows).

## Trying it on a Stream Deck

```sh
pnpm --filter @nxt/streamdeck build
pnpm --filter @nxt/streamdeck exec streamdeck dev      # once: developer mode
pnpm --filter @nxt/streamdeck exec streamdeck link dev.zedsoftworks.nxt.sdPlugin
```

Drag an Nxt key onto the deck and open its settings: the Property Inspector
shows a pairing code. Approve it on the dashboard (the button opens the link).
One pairing covers every key and every device in that Stream Deck app.

## Publishing

Upload `dist/dev.zedsoftworks.nxt.streamDeckPlugin` in Elgato's Maker Console
(maker.elgato.com). Bump `Version` in `manifest.json` (four parts, e.g.
`0.2.0.0`) or pass `--version` to `streamdeck pack`. Never change the plugin
or action UUIDs once published. The icons are placeholders.
