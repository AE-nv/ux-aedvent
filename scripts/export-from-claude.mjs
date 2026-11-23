#!/usr/bin/env node
// Export scheduled posts that Claude Code read over the AE Workspace MCP (list_entries on the artifact's
// calendar list) to aedvent-day-NN.json files, the same format as the artifact's "Exporteer voor site" button.
//
// The MCP result never passes through a shell, so this reads it from the Claude Code session transcript
// (the newest *.jsonl under ~/.claude/projects, or --transcript <file>) and takes the most recent result.
//
//   node scripts/export-from-claude.mjs [--day N] [--out dir] [--transcript file]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pad, safeUrl } from "./lib.mjs";

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const fail = (m) => { console.error("✖ " + m); process.exit(1); };

function newestTranscript() {
  const base = path.join(os.homedir(), ".claude", "projects");
  let best = null;
  for (const d of fs.readdirSync(base)) {
    const dir = path.join(base, d);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".jsonl")) continue;
      const p = path.join(dir, f), t = fs.statSync(p).mtimeMs;
      if (!best || t > best.t) best = { p, t };
    }
  }
  return best?.p;
}

const transcript = opt("--transcript") || newestTranscript() || fail("No Claude Code transcript found.");
let result = null; // last list_entries result for a calendar list
for (const line of fs.readFileSync(transcript, "utf8").split("\n")) {
  if (!line.includes('\\"list\\":\\"calendar\\"') && !line.includes('"list":"calendar"')) continue;
  let rec; try { rec = JSON.parse(line); } catch { continue; }
  const walk = (v) => {
    if (typeof v === "string" && v.startsWith("{") && v.includes('"entries"')) {
      try { const o = JSON.parse(v); if (o.list === "calendar" && Array.isArray(o.entries)) result = o; } catch {}
    } else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(rec);
}
if (!result) fail(`No calendar list_entries result in ${transcript}. Ask Claude to read the calendar list first.`);

const only = opt("--day") ? Number(opt("--day")) : null;
const outDir = opt("--out") || ".";
fs.mkdirSync(outDir, { recursive: true });
let n = 0;
for (const e of result.entries) {
  const p = e.data;
  if (only && Number(p.day) !== only) continue;
  const out = { id: e.id, day: Number(p.day), title: p.title || "", authorName: p.authorName || "", blocks: p.blocks || [] };
  if (!out.blocks.length && p.body) out.body = p.body;
  if (/^data:image\/(webp|jpeg|png);base64,/.test(p.image || "")) { out.image = p.image; if (p.imageAlt) out.imageAlt = p.imageAlt; }
  if (safeUrl(p.link)) out.link = p.link;
  const file = path.join(outDir, `aedvent-day-${pad(out.day)}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(`✔ ${file}  (day ${out.day}: ${out.title}, read ${e.at ?? "?"})`);
  n++;
}
if (!n) fail(only ? `Day ${only} is not in the calendar list.` : "The calendar list is empty.");
