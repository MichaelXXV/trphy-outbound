// Where the patch sits on the TR5 renders. Measured 2026-10-06 on TRPHY-TR5-BLK-55.png (2048px).
//
// Every render is the same two views on one square: side on top, front below, the front already
// wearing a TRPHY patch. All ten share the angle, and two are smaller (1536 and 1024px), so the
// placement is kept as fractions of the image width and scales to any of them.
//
// The patch is 3in x 2in with a 0.2in corner radius (Michael). Scale: the factory TRPHY patch on the
// render measures about 534 x 404px, and taking it as 2in tall gives about 200px per inch. The box
// below is set a little larger, 620 x 413px (3in = 620px), so it covers the factory patch and its
// stitched edge on every render; that was checked by eye on black, white, graphite and two two-tones.

export const RENDER_SIDE = 2048;

export const PATCH = {
  cx: 992 / RENDER_SIDE,     // patch centre, fraction of width
  cy: 1455 / RENDER_SIDE,    // patch centre, fraction of height
  width: 620 / RENDER_SIDE,  // a 3 inch patch, fraction of width
};

export const PATCH_IN = { w: 3, h: 2, radius: 0.2, rim: 1.5 / 25.4 };

export const HATS = {
  black: "TRPHY-TR5-BLK-55.png",
  graphite: "TRPHY-TR5-GPH-166.png",
  white: "TRPHY-TR5-WHT-2.png",
} as const;

export const HOUSE_PATCHES = ["hooks", "texas", "blessed", "dallas"] as const;
export type HousePatch = (typeof HOUSE_PATCHES)[number];
