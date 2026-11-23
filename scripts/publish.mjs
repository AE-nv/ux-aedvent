#!/usr/bin/env node
// Publish one UX AEdvent day from an entry exported by the authoring artifact.
//
//   node scripts/publish.mjs --entry day-05.json            render + commit locally, print preview path
//   node scripts/publish.mjs --entry day-05.json --push     ... and push (GitHub Pages deploys)
//   --rehearsal   allow a day before its date; recorded in manifest.json so the guard accepts it
//
// The entry is the JSON the artifact's Planning tab downloads ("Exporteer voor site").
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT, CONFIG, DAYS, pad, esc, plain, blocksOf, renderBlocks, safeUrl, decodeImage, hashDir,
  readManifest, writeManifest, writeIndex, isReleased, releaseDate, brusselsToday, page } from "./lib.mjs";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const fail = (msg) => { console.error("✖ " + msg); process.exit(1); };
const git = (...a) => execFileSync("git", a, { cwd: ROOT, encoding: "utf8" }).trim();

const entryPath = opt("--entry") || fail("Missing --entry <file>.");
const entry = JSON.parse(fs.readFileSync(entryPath, "utf8"));
const day = Number(opt("--day") ?? entry.day);
const rehearsal = flag("--rehearsal");

// ---- Refusals -----------------------------------------------------------------------------------
if (!Number.isInteger(day) || day < 1 || day > DAYS) fail(`Day must be 1..${DAYS}, got ${opt("--day") ?? entry.day}.`);
if (entry.day !== undefined && Number(entry.day) !== day) fail(`--day ${day} does not match the entry's day ${entry.day}.`);
if (!entry.title || !entry.authorName) fail("Entry needs a title and an authorName.");
const manifest = readManifest();
if (manifest[day]) fail(`Day ${day} is already published (${manifest[day].publishedAt}). Published days never change.`);
if (!isReleased(day) && !rehearsal) fail(`Day ${day} opens on ${releaseDate(day)}; today in Brussels is ${brusselsToday()}. Use --rehearsal only for a test run.`);
if (git("status", "--porcelain")) fail("Working tree is not clean; commit or discard changes first.");

// ---- Render the day -----------------------------------------------------------------------------
const dir = path.join(ROOT, "day", pad(day));
fs.mkdirSync(dir, { recursive: true });
const blocks = blocksOf(entry);
const cover = decodeImage(entry.image);
const coverFile = cover ? `cover.${cover.ext}` : null;
if (cover) fs.writeFileSync(path.join(dir, coverFile), cover.bytes);
const firstText = plain(blocks.find((b) => b.type === "p")?.text || "");
const description = (firstText.length > 180 ? firstText.slice(0, 177).trimEnd() + "…" : firstText) || `Dag ${day} van de UX AEdvent.`;
const link = safeUrl(entry.link);

fs.writeFileSync(path.join(dir, "index.html"), page({
  title: `${plain(entry.title)} · UX AEdvent dag ${day}`,
  description,
  urlPath: `day/${pad(day)}/`,
  image: coverFile ? `day/${pad(day)}/${coverFile}` : null,
  imageAlt: entry.imageAlt,
  rel: "../../",
  body: `  <main class="post">
    <p class="kicker"><a href="../../">UX AEdvent</a> · ${day} december ${CONFIG.year}</p>
    <h1>${esc(plain(entry.title))}</h1>
    <p class="byline">door ${esc(entry.authorName)}</p>
${cover ? `    <img class="cover" src="${coverFile}" alt="${esc(entry.imageAlt || "")}">\n` : ""}    <article class="body">
      ${renderBlocks(blocks)}
    </article>
${link ? `    <p class="more"><a href="${esc(link)}" rel="noopener">Lees verder ↗</a></p>\n` : ""}  </main>`,
}));

manifest[day] = {
  title: plain(entry.title),
  authorName: entry.authorName,
  cover: coverFile,
  sha256: hashDir(dir),
  publishedAt: new Date().toISOString(),
  ...(entry.id ? { entryId: entry.id } : {}),
  ...(rehearsal ? { rehearsal: true } : {}),
};
writeManifest(Object.fromEntries(Object.entries(manifest).sort((a, b) => a[0] - b[0])));

writeIndex(readManifest());

// ---- Commit, push, print the LinkedIn link -----------------------------------------------------
git("add", "day/" + pad(day), "index.html", "manifest.json");
git("commit", "-m", `publish day ${day}${rehearsal ? " (rehearsal)" : ""}`);
const url = `${CONFIG.siteUrl}day/${pad(day)}/`;
console.log(`✔ Day ${day} rendered and committed.`);
console.log(`  Preview: ${path.join(dir, "index.html")}`);
if (flag("--push")) {
  git("push", "origin", "HEAD");
  console.log("✔ Pushed. Pages deploys in a minute or two.");
} else {
  console.log("  Not pushed. Check the preview, then run: git push");
}
console.log(`  URL:      ${url}`);
console.log(`  LinkedIn: ${url}?utm_source=linkedin&utm_medium=social&utm_campaign=aedvent&utm_content=day${pad(day)}`);
