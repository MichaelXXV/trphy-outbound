// Puts patches on hats and lays out the mockup set. Every output is a 1600px square JPG with an
// 800px copy for email.

import { readFile } from "fs/promises";
import path from "path";
import sharp, { type OverlayOptions } from "sharp";
import { alphaOf, buildHousePatch, buildLogoPatch, patchSize } from "@/lib/mockup/patch";
import { HATS, HOUSE_PATCHES, PATCH, type HousePatch } from "@/lib/mockup/placements";

export type MockupKind = "hero" | "graphite" | "white" | "house_patch" | "options_grid" | "patch";

export interface MockupImage {
  kind: MockupKind;
  colorway: string | null;
  full: Buffer;  // 1600px JPG
  email: Buffer; // 800px JPG
}

const OUT = 1600;
const EMAIL = 800;
const LIGHT_GREY = "#e9e9e7";

const publicFile = (...p: string[]) => readFile(path.join(process.cwd(), "public", ...p));

// A soft shadow under the patch: its own shape in black, blurred, nudged down.
async function shadowFor(patch: Buffer, strength = 0.5): Promise<{ input: Buffer; dx: number; dy: number; pad: number }> {
  const a = await alphaOf(patch, strength);
  const blur = Math.max(2, a.width / 70);
  const pad = Math.ceil(blur * 3);
  const W = a.width + pad * 2;
  const H = a.height + pad * 2;
  const padded = Buffer.alloc(W * H);
  for (let y = 0; y < a.height; y++) a.data.copy(padded, (y + pad) * W + pad, y * a.width, (y + 1) * a.width);
  const alpha = await sharp(await sharp(padded, { raw: { width: W, height: H, channels: 1 } }).png().toBuffer()).blur(blur).png().toBuffer();
  const input = await sharp({ create: { width: W, height: H, channels: 3, background: "#000" } })
    .joinChannel(alpha)
    .png()
    .toBuffer();
  return { input, dx: Math.round(a.width * 0.004), dy: Math.round(a.width * 0.012), pad };
}

// A patch and its shadow at (left, top) on some base.
async function withShadow(patch: Buffer, left: number, top: number, strength?: number): Promise<OverlayOptions[]> {
  const s = await shadowFor(patch, strength);
  return [
    { input: s.input, left: left - s.pad + s.dx, top: top - s.pad + s.dy },
    { input: patch, left, top },
  ];
}

async function outputs(img: Buffer): Promise<{ full: Buffer; email: Buffer }> {
  const full = await sharp(img).resize(OUT, OUT, { fit: "cover" }).flatten({ background: "#ffffff" }).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
  const email = await sharp(img).resize(EMAIL, EMAIL, { fit: "cover" }).flatten({ background: "#ffffff" }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  return { full, email };
}

// The render at its own resolution with the patch built to fit it, so nothing is upscaled twice.
async function onHat(hatFile: string, makePatch: (width: number) => Promise<Buffer>): Promise<Buffer> {
  const hat = await publicFile("hats", hatFile);
  const meta = await sharp(hat).metadata();
  const side = meta.width!;
  const patch = await makePatch(side * PATCH.width);
  const pm = await sharp(patch).metadata();
  const left = Math.round(side * PATCH.cx - pm.width! / 2);
  const top = Math.round(side * PATCH.cy - pm.height! / 2);
  return sharp(hat).composite(await withShadow(patch, left, top)).png().toBuffer();
}

async function housePatchFile(name: HousePatch): Promise<Buffer> {
  return publicFile("patches", `${name}.png`);
}

// The patch alone, large, on light grey.
async function alone(patch: Buffer): Promise<Buffer> {
  const pm = await sharp(patch).metadata();
  return sharp({ create: { width: OUT, height: OUT, channels: 3, background: LIGHT_GREY } })
    .composite(await withShadow(patch, Math.round((OUT - pm.width!) / 2), Math.round((OUT - pm.height!) / 2), 0.35))
    .png()
    .toBuffer();
}

// The four house patches, two by two, on light grey.
async function optionsGrid(): Promise<Buffer> {
  const cell = OUT / 2;
  const width = patchSize(cell * 0.8).w;
  const layers: OverlayOptions[] = [];
  for (const [i, name] of HOUSE_PATCHES.entries()) {
    const patch = await buildHousePatch(await housePatchFile(name), width);
    const pm = await sharp(patch).metadata();
    const left = (i % 2) * cell + Math.round((cell - pm.width!) / 2);
    const top = Math.floor(i / 2) * cell + Math.round((cell - pm.height!) / 2);
    layers.push(...(await withShadow(patch, left, top, 0.35)));
  }
  return sharp({ create: { width: OUT, height: OUT, channels: 3, background: LIGHT_GREY } }).composite(layers).png().toBuffer();
}

export async function renderSet(logoPng: Buffer, colours: string[] | null): Promise<MockupImage[]> {
  const logoPatch = (w: number) => buildLogoPatch(logoPng, colours, w);
  const hooks = await housePatchFile("hooks");
  const jobs: Array<[MockupKind, string | null, Promise<Buffer>]> = [
    ["hero", "black", onHat(HATS.black, logoPatch)],
    ["graphite", "graphite", onHat(HATS.graphite, logoPatch)],
    ["white", "white", onHat(HATS.white, logoPatch)],
    ["house_patch", "black", onHat(HATS.black, (w) => buildHousePatch(hooks, w))],
    ["options_grid", null, optionsGrid()],
    ["patch", null, logoPatch(OUT * 0.75).then(alone)],
  ];
  return Promise.all(jobs.map(async ([kind, colorway, img]) => ({ kind, colorway, ...(await outputs(await img)) })));
}
