# Contributing

Bug reports, ideas and pull requests are welcome. For anything bigger than a small fix, open an issue first so we can
agree on the approach — the [roadmap issue](https://github.com/KrasimirKralev/contribution-invaders/issues/1) lists what
is planned before v1.

## Develop

```sh
npm ci
npm run typecheck
npm test
npm run demo      # renders docs/demo-light.svg and docs/demo-dark.svg from a made-up year
```

## Before you open a PR

- `npm run build` and commit the regenerated `dist/index.js` — CI fails when `dist/` is stale.
- Keep the SVG camo-safe: CSS animation only, no `<script>`, no external `href`. `test/camo-safety.test.ts` checks this.
- New sprites must be original pixel art.
