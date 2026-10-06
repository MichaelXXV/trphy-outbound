// The PVC patch, built with sharp from the company's real logo file. No generative model touches it:
// the logo pixels are only reduced to solid colours, scaled, and layered for depth.
//
// Michael's build, 2026-10-06:
// - the cleaned logo flattened to at most eight solid colours
// - a 3:2 rounded rectangle in the darkest saved logo colour (black if none)
// - a raised rim about 1.5mm wide in the lightest saved colour
// - the logo fitted inside with 12% padding
// - bevel: a lighter copy up-left and a darker copy down-right, a couple of pixels
// - a soft white highlight at low opacity across the top third
// - the drop shadow is added where the patch meets the hat (shadow.ts), not here

import sharp, { type OverlayOptions } from "sharp";
import { PATCH_IN } from "@/lib/mockup/placements";

const PADDING = 0.12;
const MAX_COLOURS = 8;

interface Rgb { r: number; g: number; b: number }

function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.replace("#", ""), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
const lum = (c: Rgb) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
const css = (c: Rgb) => `rgb(${c.r},${c.g},${c.b})`;

export function patchSize(width: number) {
  const w = Math.round(width);
  const h = Math.round((w * PATCH_IN.h) / PATCH_IN.w);
  const k = w / PATCH_IN.w; // px per inch
  return { w, h, radius: PATCH_IN.radius * k, rim: Math.max(2, PATCH_IN.rim * k), bevel: Math.max(2, Math.round(w / 300)) };
}

export function patchColours(saved: string[] | null): { base: Rgb; rim: Rgb } {
  const cols = (saved ?? []).filter((c) => /^#[0-9a-f]{6}$/i.test(c)).map(hexToRgb);
  if (cols.length === 0) return { base: { r: 0, g: 0, b: 0 }, rim: { r: 255, g: 255, b: 255 } };
  const sorted = [...cols].sort((a, b) => lum(a) - lum(b));
  return { base: sorted[0], rim: sorted[sorted.length - 1] };
}

// At most eight solid colours, and alpha made hard: a moulded patch has no half-transparent edges.
async function flattenLogo(png: Buffer): Promise<Buffer> {
  const quantised = await sharp(png).ensureAlpha().png({ palette: true, colours: MAX_COLOURS, dither: 0 }).toBuffer();
  const { data, info } = await sharp(quantised).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 3; i < data.length; i += 4) data[i] = data[i] >= 128 ? 255 : 0;
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

// A layer's alpha as plain bytes, scaled by `opacity`. Done by hand because sharp reorders
// extractChannel and linear inside one pipeline.
export async function alphaOf(layer: Buffer, opacity = 1): Promise<{ data: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(layer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height);
  for (let i = 0; i < out.length; i++) out[i] = Math.round(data[i * 4 + 3] * opacity);
  return { data: out, width: info.width, height: info.height };
}

// A copy of a layer's shape filled with one colour at some opacity, for the bevel.
async function tint(layer: Buffer, colour: string, opacity: number): Promise<Buffer> {
  const a = await alphaOf(layer, opacity);
  const alpha = await sharp(a.data, { raw: { width: a.width, height: a.height, channels: 1 } }).png().toBuffer();
  return sharp({ create: { width: a.width, height: a.height, channels: 3, background: colour } })
    .joinChannel(alpha)
    .png()
    .toBuffer();
}

// A layer placed on a transparent w x h canvas at (left, top), clipped to the canvas. Lets the bevel
// copies shift past the edge without sharp refusing the composite.
async function place(layer: Buffer, w: number, h: number, left: number, top: number): Promise<Buffer> {
  const m = await sharp(layer).metadata();
  const extended = await sharp(layer)
    .ensureAlpha()
    .extend({
      left: Math.max(0, left), top: Math.max(0, top),
      right: Math.max(0, w - left - m.width!), bottom: Math.max(0, h - top - m.height!),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  return sharp(extended).extract({ left: Math.max(0, -left), top: Math.max(0, -top), width: w, height: h }).png().toBuffer();
}

// Lighter copy up-left, darker copy down-right, the layer itself on top.
async function bevelled(layer: Buffer, w: number, h: number, left: number, top: number, d: number): Promise<OverlayOptions[]> {
  const [light, dark] = await Promise.all([tint(layer, "#ffffff", 0.45), tint(layer, "#000000", 0.55)]);
  const placed = await Promise.all([place(dark, w, h, left + d, top + d), place(light, w, h, left - d, top - d), place(layer, w, h, left, top)]);
  return placed.map((input) => ({ input, left: 0, top: 0 }));
}

const roundRect = (w: number, h: number, inset: number, r: number, attrs: string) =>
  `<rect x="${inset}" y="${inset}" width="${w - inset * 2}" height="${h - inset * 2}" rx="${Math.max(0, r - inset)}" ${attrs}/>`;

// Company logo patch, transparent outside the die-cut shape, `width` px wide.
export async function buildLogoPatch(logoPng: Buffer, savedColours: string[] | null, width: number): Promise<Buffer> {
  const { w, h, radius, rim, bevel } = patchSize(width);
  const { base, rim: rimColour } = patchColours(savedColours);
  const svg = (body: string) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`);

  const baseLayer = await sharp(svg(roundRect(w, h, 0, radius, `fill="${css(base)}"`))).png().toBuffer();
  const rimLayer = await sharp(svg(roundRect(w, h, rim / 2 + bevel, radius, `fill="none" stroke="${css(rimColour)}" stroke-width="${rim}"`))).png().toBuffer();

  const flat = await flattenLogo(logoPng);
  const innerW = Math.round(w * (1 - PADDING * 2));
  const innerH = Math.round(h * (1 - PADDING * 2));
  const logo = await sharp(flat).resize(innerW, innerH, { fit: "inside", kernel: "nearest" }).png().toBuffer();
  const lm = await sharp(logo).metadata();
  const left = Math.round((w - lm.width!) / 2);
  const top = Math.round((h - lm.height!) / 2);

  const highlight = svg(
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="#fff" stop-opacity="0.16"/><stop offset="0.33" stop-color="#fff" stop-opacity="0"/>` +
      `</linearGradient><clipPath id="c">${roundRect(w, h, 0, radius, "")}</clipPath></defs>` +
      `<rect width="${w}" height="${h}" fill="url(#g)" clip-path="url(#c)"/>`,
  );

  const layers: OverlayOptions[] = [
    ...(await bevelled(rimLayer, w, h, 0, 0, bevel)),
    ...(await bevelled(logo, w, h, left, top, bevel)),
    { input: highlight, left: 0, top: 0 },
  ];
  // Nothing may spill past the die-cut edge.
  const m = await alphaOf(await sharp(svg(roundRect(w, h, 0, radius, 'fill="#fff"'))).png().toBuffer());
  const mask = await sharp(m.data, { raw: { width: w, height: h, channels: 1 } }).png().toBuffer();
  const composed = await sharp(baseLayer).composite(layers).removeAlpha().toBuffer();
  return sharp(composed).joinChannel(mask).png().toBuffer();
}

// House patch artwork is already the finished patch: fitted to the 3:2 footprint, nothing added.
export async function buildHousePatch(file: Buffer, width: number): Promise<Buffer> {
  const { w, h } = patchSize(width);
  const trimmed = await sharp(file).trim({ threshold: 5 }).png().toBuffer().catch(() => file);
  return sharp(trimmed).resize(w, h, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
}
