#!/usr/bin/env node
// Guard for the public site. Runs in CI on every push and PR, and locally with `node scripts/guard.mjs [base-ref]`.
// Fails when:
//  - a day page under day/NN/ does not match its manifest hash, or a day dir is missing from the manifest;
//  - a day is published before its date (Europe/Brussels), unless the manifest marks it as a rehearsal;
//  - compared to the base ref, a published day was changed or removed. Exceptions: a commit titled
//    "correction day N" may change day N, and a rehearsal day may be removed.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT, pad, hashDir, readManifest, isReleased, releaseDate } from "./lib.mjs";

const errors = [];
const manifest = readManifest();
const git = (...a) => execFileSync("git", a, { cwd: ROOT, encoding: "utf8" }).trim();

// 1. Files match the manifest, and dates are respected.
const dayRoot = path.join(ROOT, "day");
const dirs = fs.existsSync(dayRoot) ? fs.readdirSync(dayRoot) : [];
for (const d of dirs) if (!manifest[Number(d)]) errors.push(`day/${d}/ is not in manifest.json`);
for (const [day, m] of Object.entries(manifest)) {
  const dir = path.join(dayRoot, pad(day));
  if (!fs.existsSync(dir)) { errors.push(`manifest lists day ${day} but day/${pad(day)}/ is missing`); continue; }
  if (hashDir(dir) !== m.sha256) errors.push(`day ${day}: files do not match the manifest hash`);
  if (!isReleased(Number(day)) && !m.rehearsal) errors.push(`day ${day} is published before ${releaseDate(Number(day))}`);
}

// 2. Published days are immutable compared to the base.
const base = process.argv[2];
if (base && !/^0+$/.test(base)) {
  let baseManifest = {};
  try { baseManifest = JSON.parse(git("show", `${base}:manifest.json`)); } catch { /* first publish */ }
  const titles = git("log", "--format=%s", `${base}..HEAD`).split("\n");
  for (const [day, m] of Object.entries(baseManifest)) {
    const now = manifest[day];
    if (!now) { if (!m.rehearsal) errors.push(`day ${day} was removed`); continue; }
    if (now.sha256 !== m.sha256 && !titles.some((t) => new RegExp(`^correction day ${day}\\b`, "i").test(t)))
      errors.push(`day ${day} changed; published days only change through a commit titled "correction day ${day}"`);
  }
}

if (errors.length) { console.error("Guard failed:\n - " + errors.join("\n - ")); process.exit(1); }
console.log(`Guard OK: ${Object.keys(manifest).length} published day(s).`);
