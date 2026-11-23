#!/usr/bin/env node
// Remove a REHEARSAL day (never a real one; the guard would refuse that anyway).
//   node scripts/unpublish.mjs --day 1 [--push]
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT, pad, readManifest, writeManifest, writeIndex } from "./lib.mjs";

const args = process.argv.slice(2);
const i = args.indexOf("--day");
const day = Number(i >= 0 ? args[i + 1] : NaN);
const fail = (msg) => { console.error("✖ " + msg); process.exit(1); };
const git = (...a) => execFileSync("git", a, { cwd: ROOT, encoding: "utf8" }).trim();

const manifest = readManifest();
if (!manifest[day]) fail(`Day ${day} is not published.`);
if (!manifest[day].rehearsal) fail(`Day ${day} is a real publication; published days are never removed.`);
if (git("status", "--porcelain")) fail("Working tree is not clean; commit or discard changes first.");

fs.rmSync(path.join(ROOT, "day", pad(day)), { recursive: true, force: true });
delete manifest[day];
writeManifest(manifest);
writeIndex(manifest);
git("add", "-A", "day", "index.html", "manifest.json");
git("commit", "-m", `remove rehearsal day ${day}`);
console.log(`✔ Rehearsal day ${day} removed and committed.`);
if (args.includes("--push")) { git("push", "origin", "HEAD"); console.log("✔ Pushed."); }
