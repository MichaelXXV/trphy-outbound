// Download, render and clean one logo candidate with sharp. Nothing here draws or redraws a logo:
// the only change ever made to the pixels is making a flat background transparent.
//
// Background removal (Michael, 2026-10-06): flat colour backgrounds only, flood fill from the four
// corners. Anything harder (photo, gradient, corners that disagree) is left as is and the logo is
// needs_cleanup at best, for a person.

import { createHash } from "crypto";
import sharp, { type Metadata, type Sharp } from "sharp";
import type { Candidate } from "@/lib/logo-candidates";

export type Background = "transparent" | "removed" | "complex";

export interface LogoImage {
  candidate: Candidate;
  format: "svg" | "png" | "jpeg" | "webp" | "gif";
  longSide: number | null;  // the original's long side in pixels; null for SVG, which has no size limit
  transparent: boolean;     // the original already had real transparency
  background: Background;
  png: Buffer;              // cleaned and trimmed, what goes in the logos bucket
  width: number;
  height: number;
  preview: Buffer;          // the cleaned logo on mid grey, for grading, so leftover white shows
  hash: string;
}

const MAX_BYTES = 5 * 1024 * 1024;
const WORK_SIDE = 1200;  // render and clean at this long side at most
const PREVIEW_SIDE = 768;
const TOLERANCE = 40;    // per channel, for "same colour as the background"

async function download(c: Candidate): Promise<Buffer | null> {
  if (c.inlineSvg) {
    let svg = c.inlineSvg;
    if (!/xmlns=/.test(svg)) svg = svg.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
    return Buffer.from(svg);
  }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(c.url, { signal: ctrl.signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; TRPHY logo check)" }, cache: "no-store" });
    clearTimeout(t);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > MAX_BYTES ? null : buf;
  } catch {
    return null;
  }
}

export async function loadCandidate(c: Candidate): Promise<LogoImage | null> {
  const buf = await download(c);
  if (!buf || buf.length < 100) return null;

  let meta: Metadata;
  try {
    meta = await sharp(buf).metadata();
  } catch {
    return null; // .ico and anything else sharp cannot read
  }
  const format = meta.format;
  if (format !== "svg" && format !== "png" && format !== "jpeg" && format !== "webp" && format !== "gif") return null;
  if (!meta.width || !meta.height) return null;

  // SVG renders at whatever size we ask; rasters are never scaled up.
  let img: Sharp;
  if (format === "svg") {
    const density = Math.min(2400, Math.max(72, (72 * WORK_SIDE) / Math.max(meta.width, meta.height)));
    img = sharp(buf, { density });
  } else {
    img = sharp(buf, { animated: false });
  }
  img = img.resize(WORK_SIDE, WORK_SIDE, { fit: "inside", withoutEnlargement: true }).ensureAlpha();

  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const transparent = hasTransparency(data);
  let background: Background = "transparent";
  if (!transparent) background = floodFromCorners(data, info.width, info.height) ? "removed" : "complex";

  let png = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  try {
    png = await sharp(png).trim({ threshold: 10 }).png().toBuffer();
  } catch {
    // nothing to trim
  }
  const out = await sharp(png).metadata();
  const preview = await sharp(png)
    .resize(PREVIEW_SIDE, PREVIEW_SIDE, { fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#808080" })
    .png()
    .toBuffer();

  return {
    candidate: c,
    format,
    longSide: format === "svg" ? null : Math.max(meta.width, meta.height),
    transparent,
    background,
    png,
    width: out.width ?? info.width,
    height: out.height ?? info.height,
    preview,
    hash: createHash("sha1").update(png).digest("hex"),
  };
}

// Real transparency: a meaningful share of pixels below full opacity.
function hasTransparency(rgba: Buffer): boolean {
  let clear = 0;
  const total = rgba.length / 4;
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] < 250) clear++;
  return clear / total > 0.02;
}

// Makes a flat background transparent in place. Returns false, and changes nothing, when the four
// corners are not one colour.
function floodFromCorners(rgba: Buffer, w: number, h: number): boolean {
  const corners = [0, w - 1, (h - 1) * w, h * w - 1];
  const at = (p: number) => [rgba[p * 4], rgba[p * 4 + 1], rgba[p * 4 + 2]];
  const bg = at(corners[0]);
  const near = (p: number) => {
    const c = at(p);
    return Math.abs(c[0] - bg[0]) <= TOLERANCE && Math.abs(c[1] - bg[1]) <= TOLERANCE && Math.abs(c[2] - bg[2]) <= TOLERANCE;
  };
  if (!corners.every(near)) return false;

  const seen = new Uint8Array(w * h);
  const stack = [...corners];
  for (const c of corners) seen[c] = 1;
  while (stack.length) {
    const p = stack.pop()!;
    rgba[p * 4 + 3] = 0;
    const x = p % w;
    const y = (p - x) / w;
    const next = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
    for (const q of next) {
      if (q < 0 || seen[q]) continue;
      seen[q] = 1;
      if (near(q)) stack.push(q);
    }
  }
  return true;
}

// Michael's preference within a source: SVG, then PNG with transparency, then other rasters, JPG
// last; larger first.
export function formatRank(l: LogoImage): number {
  if (l.format === "svg") return 0;
  if (l.transparent) return 1;
  if (l.format === "png" || l.format === "webp") return 2;
  return 3;
}
