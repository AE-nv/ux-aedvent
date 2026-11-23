# UX AEdvent

Public site for the UX AEdvent: one UX post a day from 1 to 24 December 2026, written by AE colleagues.
Live at <https://ae-nv.github.io/ux-aedvent/>.

This repo holds only days that are already out. Posts are written and scheduled in the internal authoring
artifact on artifacts.ae.be; once a day is published here it never changes.

## Publishing a day

1. In the authoring artifact, open **Planning** and click **Exporteer voor site** next to the day. This downloads
   `aedvent-day-NN.json`.
   Or from Claude Code with the AE Workspace connector: ask Claude to read the artifact's `calendar` list, then
   `node scripts/export-from-claude.mjs --day 5` writes the same file from that result.
2. From this repo, with a clean working tree:

   ```sh
   node scripts/publish.mjs --entry ~/Downloads/aedvent-day-05.json          # render + commit, print preview path
   git push                                                                     # after checking the preview
   # or in one go:
   node scripts/publish.mjs --entry ~/Downloads/aedvent-day-05.json --push
   ```

3. The workflow runs the guard and deploys to Pages. Check the page, check the card in LinkedIn's
   [Post Inspector](https://www.linkedin.com/post-inspector/), then post the UTM link the script printed.

The script refuses a day before its date (Brussels time), a day that is already published, and a dirty working tree.
`--rehearsal` allows an early day for a test run; it is marked in `manifest.json` and is removed again with
`node scripts/unpublish.mjs --day N --push` (rehearsal days only). **Day 1 is currently a rehearsal: remove it before 1 December.**

## Guard

`scripts/guard.mjs` runs on every push and pull request, before deploying. It fails when a day's files do not match
`manifest.json`, when a day appears before its date (except rehearsals), or when a published day changes or disappears.
A correction goes in a commit titled `correction day N`, after which you update that day's hash in the manifest.

## Layout

```
index.html          24 doors; only published days link anywhere
day/NN/             index.html + cover image of a published day
manifest.json       per day: title, author, cover, sha256, publishedAt
assets/site.css
privacy.html
scripts/            publish.mjs, guard.mjs, lib.mjs (no dependencies, Node 20+)
site.config.json    siteUrl (absolute, used for og: tags) and year
```
