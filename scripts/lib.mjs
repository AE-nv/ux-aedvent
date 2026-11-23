// Shared helpers for the UX AEdvent static site: rendering, hashing, dates.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, "site.config.json"), "utf8"));
export const DAYS = 24;
export const pad = (n) => String(n).padStart(2, "0");

// ---- Dates (campaign runs on Europe/Brussels time) ----------------------------------------------
export function brusselsToday() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return parts; // YYYY-MM-DD
}
export const releaseDate = (day) => `${CONFIG.year}-12-${pad(day)}`;
export const isReleased = (day) => brusselsToday() >= releaseDate(day);

// ---- Text ---------------------------------------------------------------------------------------
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// **bold**, *italic* and ++underline++, parsed exactly like the authoring artifact's runs() (single pass,
// no nesting), so the site shows what the author saw. Every run is escaped.
const MARKS = /\*\*([^*]+)\*\*|\*([^*]+)\*|\+\+([^+]+)\+\+/g;
export function inline(text) {
  return String(text ?? "").replace(MARKS, "\0$&\0").split("\0").map((part) => {
    const m = /^(?:\*\*([^*]+)\*\*|\*([^*]+)\*|\+\+([^+]+)\+\+)$/.exec(part);
    if (!m) return esc(part);
    if (m[1] !== undefined) return `<strong>${esc(m[1])}</strong>`;
    if (m[2] !== undefined) return `<em>${esc(m[2])}</em>`;
    return `<u>${esc(m[3])}</u>`;
  }).join("");
}
export const plain = (text) => String(text ?? "").replace(MARKS, (_, b, i, u) => b ?? i ?? u);

export function blocksOf(entry) {
  if (Array.isArray(entry.blocks) && entry.blocks.length) return entry.blocks;
  return String(entry.body || "").split(/\n\s*\n/).filter((t) => t.trim()).map((text, i) => ({ id: "b" + i, type: "p", text: text.trim() }));
}

export function renderBlocks(blocks) {
  const out = [];
  let list = null;
  for (const b of blocks) {
    if (b.type === "li") { (list ??= []).push(`<li>${inline(b.text)}</li>`); continue; }
    if (list) { out.push(`<ul>${list.join("")}</ul>`); list = null; }
    if (b.type === "heading") out.push(`<h2>${inline(b.text)}</h2>`);
    else if (b.type === "quote") out.push(`<blockquote>${inline(b.text)}</blockquote>`);
    else out.push(`<p>${inline(b.text)}</p>`);
  }
  if (list) out.push(`<ul>${list.join("")}</ul>`);
  return out.join("\n      ");
}

export const safeUrl = (u) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : null; } catch { return null; } };

// ---- Images -------------------------------------------------------------------------------------
const MIME_EXT = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };
export function decodeImage(dataUri) {
  const m = /^data:(image\/(?:webp|jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUri || ""));
  if (!m) return null;
  const bytes = Buffer.from(m[2], "base64");
  const ok = m[1] === "image/webp" ? bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP"
    : m[1] === "image/png" ? bytes[0] === 0x89 && bytes.subarray(1, 4).toString() === "PNG"
    : bytes[0] === 0xff && bytes[1] === 0xd8;
  if (!ok) throw new Error(`Cover image does not look like ${m[1]}.`);
  return { mime: m[1], ext: MIME_EXT[m[1]], bytes };
}

// ---- Hashing ------------------------------------------------------------------------------------
export const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
export function hashDir(dir) {
  const files = fs.readdirSync(dir).sort();
  const h = crypto.createHash("sha256");
  for (const f of files) { h.update(f + "\0"); h.update(fs.readFileSync(path.join(dir, f))); h.update("\0"); }
  return h.digest("hex");
}

export const readManifest = () => {
  const p = path.join(ROOT, "manifest.json");
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : {};
};
export const writeManifest = (m) => fs.writeFileSync(path.join(ROOT, "manifest.json"), JSON.stringify(m, null, 2) + "\n");

// ---- Index: 24 doors, only published days carry content -----------------------------------------
export function writeIndex(manifest) {
  const doors = [];
  for (let d = 1; d <= DAYS; d++) {
    const m = manifest[d];
    doors.push(m
      ? `      <a class="door open" href="day/${pad(d)}/"><span class="n">${d}</span><span class="t">${esc(m.title)}</span></a>`
      : `      <div class="door" aria-label="${d} december, nog dicht"><span class="n">${d}</span></div>`);
  }
  fs.writeFileSync(path.join(ROOT, "index.html"), page({
    title: "UX AEdvent",
    description: "Elke dag van 1 tot 24 december een UX-post van collega's bij AE.",
    urlPath: "",
    rel: "",
    body: `  <main class="home">
    <h1>UX AEdvent</h1>
    <p class="lede">Elke dag van 1 tot 24 december ${CONFIG.year} een nieuwe UX-post, geschreven door collega's bij AE.</p>
    <nav class="grid" aria-label="Kalender">
${doors.join("\n")}
    </nav>
  </main>`,
  }));
}

// ---- Page shell ---------------------------------------------------------------------------------
export function page({ title, description, urlPath, image, imageAlt, rel, body }) {
  const abs = (p) => CONFIG.siteUrl.replace(/\/?$/, "/") + p;
  return `<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${esc(abs(urlPath))}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="UX AEdvent">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${esc(abs(urlPath))}">
${image ? `  <meta property="og:image" content="${esc(abs(image))}">
  <meta property="og:image:alt" content="${esc(imageAlt || title)}">
  <meta name="twitter:card" content="summary_large_image">
` : ""}  <link rel="stylesheet" href="${rel}assets/site.css">
</head>
<body>
${body}
  <footer class="foot"><a href="${rel}">Alle dagen</a> · <a href="${rel}privacy.html">Privacy</a> · Een adventskalender van UX-collega's bij AE</footer>
</body>
</html>
`;
}
