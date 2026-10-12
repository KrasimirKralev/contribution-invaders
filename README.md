# Contribution Invaders

<a href="https://github.com/KrasimirKralev/contribution-invaders">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/KrasimirKralev/contribution-invaders/main/docs/demo-dark.svg">
    <img alt="A made-up contribution year played as an arcade game: a ship shoots down one invader per active day" src="https://raw.githubusercontent.com/KrasimirKralev/contribution-invaders/main/docs/demo-light.svg">
  </picture>
</a>

A GitHub Action that turns your contribution graph into a self-playing arcade game for your profile README.

> **Pre-release:** inputs and art may change before v1. Pin a version (`@v0.1.0`), not a branch.

Every day you contributed becomes an invader, coloured by how busy the day was. A ship clears the whole year: the formation marches and speeds up as it thins out, invaders drop bombs back, a mystery saucer flies over, and the round ends with your stats. It is one SVG with CSS animation only, regenerated every day, in a light and a dark version.

## Quick start

1. Add `.github/workflows/invaders.yml` to your profile repository (the one named after your username):

   ```yaml
   name: Contribution Invaders

   on:
     schedule:
       - cron: '0 6 * * *' # every day at 06:00 UTC
     workflow_dispatch:

   permissions:
     contents: write

   jobs:
     invaders:
       runs-on: ubuntu-latest
       steps:
         - uses: KrasimirKralev/contribution-invaders@v0.1.0

         - name: Push the SVGs to the output branch
           env:
             GITHUB_TOKEN: ${{ github.token }}
           run: |
             cd dist
             git init -q -b output
             git config user.name 'github-actions[bot]'
             git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
             git add invaders.svg invaders-dark.svg
             git commit -q -m 'chore: refresh contribution invaders'
             git push -f -q "https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" output
   ```

2. Run it once: **Actions → Contribution Invaders → Run workflow**. It creates an `output` branch with the two SVGs.

3. Paste this into your `README.md` and replace `USERNAME` with your login:

   ```html
   <a href="https://github.com/KrasimirKralev/contribution-invaders">
     <picture>
       <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/USERNAME/USERNAME/output/invaders-dark.svg">
       <img alt="My contribution graph as an arcade game" src="https://raw.githubusercontent.com/USERNAME/USERNAME/output/invaders.svg">
     </picture>
   </a>

   <sub>Made with <a href="https://github.com/KrasimirKralev/contribution-invaders">Contribution Invaders</a></sub>
   ```

   Links inside a README image do not work, so the credit line under it is the only way visitors can find where the game came from. Keeping it is appreciated.

## Inputs

| Input | Default | What it does |
|---|---|---|
| `github_user_name` | the repository owner | Whose contribution graph to draw. |
| `github_token` | `${{ github.token }}` | Token for the GraphQL contributions query. The default sees public contributions. |
| `outputs` | `dist/invaders.svg`<br>`dist/invaders-dark.svg?palette=dark` | Files to write, one per line, relative to the workspace. Add `?palette=dark` for the dark theme; the default is light. |
| `title` | `@<login>` | Header text, drawn in the pixel font. Letters, digits and common punctuation; anything else shows as `?`. |
| `seed` | `daily` | `daily` plays a different game every day, `fixed` the same one every day, or a whole number picks one. |

The action sets one output, `files`: the paths it wrote, one per line.

## Live

This repository runs the action on its owner's graph every day ([`self-run.yml`](.github/workflows/self-run.yml)):

<a href="https://github.com/KrasimirKralev/contribution-invaders/blob/output/invaders.svg">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/KrasimirKralev/contribution-invaders/output/invaders-dark.svg">
    <img alt="@KrasimirKralev's contribution graph as an arcade game, rebuilt daily" src="https://raw.githubusercontent.com/KrasimirKralev/contribution-invaders/output/invaders.svg">
  </picture>
</a>

## FAQ

**My private contributions are missing.** The default workflow token only sees public contributions. Turn on *Include private contributions on my profile* in your profile settings, create a personal access token with the `read:user` scope, save it as a repository secret (for example `CONTRIB_TOKEN`) and pass it as `github_token: ${{ secrets.CONTRIB_TOKEN }}`.

**I ran the workflow but my README still shows the old picture.** GitHub caches README images for a few minutes. Wait, then reload.

**Is the SVG safe to embed?** Yes. It has no scripts and loads nothing from anywhere; everything moves with CSS keyframes. That is also why GitHub's image proxy shows it.

**Why is the file so big for a busy year?** Every invader has its own animation, so a year with an active day almost every day comes to about 580 KB. A lighter mode is planned for v1.1.

**Which version should I use?** `@v0.1.0` for now. There is no `v1` tag until the inputs and the art are final.

## Development

```sh
npm ci
npm test            # unit, fixture and camo-safety tests
npm run typecheck
npm run build       # bundles src/ into dist/index.js (commit it)
npm run demo        # re-renders docs/demo-*.svg from a made-up year
npm run size        # SVG size for each fixture year
```

The fixture years in `test/fixtures/` and the demo year are synthetic; no real account's data is checked in.

## How it was built

Contribution Invaders started as the animated header of the author's own profile README and was extracted into this action. It is TypeScript, bundled with esbuild and tested with Vitest; the SVG is written as plain markup and animated with CSS keyframes only, so it needs no JavaScript to play. The code was written with the help of an AI coding assistant (Claude Code). The design choices: one invader per real day, a seed per day so each day plays differently, its own sprites and pixel font, and a pre-release until the art is final.

## Credits

- Inspired by [Platane/snk](https://github.com/Platane/snk), the contribution-graph snake, and by the arcade classic.
- The sprites and the 5x7 pixel font were drawn for this project.

## Licence

[MIT](LICENSE) © 2026 Krasimir Kralev

More from [@KrasimirKralev](https://github.com/KrasimirKralev): [Harvest Hollow](https://github.com/KrasimirKralev/harvest-hollow), a cozy co-op farming game you play in the browser.
