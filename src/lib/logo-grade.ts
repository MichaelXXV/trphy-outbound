// Claude vision looks at every candidate for one company, picks one, and grades it for PVC.
// Claude only reads the images. It never draws, edits or redraws a logo.

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { LogoImage } from "@/lib/logo-image";

export type Grade = "usable" | "needs_cleanup" | "not_pvc";

const GradeSchema = z.object({
  pick: z.number().int().describe("Index of the chosen candidate, or -1 if none of them is the company's logo"),
  grade: z.enum(["usable", "needs_cleanup", "not_pvc"]),
  colors: z.array(z.string()).describe("Two or three dominant colours of the chosen logo as #rrggbb, most dominant first. Never the grey backdrop."),
  kind: z.enum(["mark", "wordmark", "both"]),
  notes: z.string().describe("One or two plain sentences for staff: why this grade, and what a person would need to fix"),
});

export type GradeResult = z.infer<typeof GradeSchema>;

// Michael's rubric, 2026-10-06.
const SYSTEM = `You grade company logos for a hat shop that turns them into PVC patches. PVC is moulded rubber in flat colour areas, so the question is never whether the logo looks good, only whether it can be made as a patch.

You will see numbered candidates found on one company's website, each on a mid grey backdrop. The grey is not part of the logo. Any white or coloured box left around a logo is a background that was not removed.

First pick the candidate that is the company's actual logo at the best quality. They are listed in preference order: the site's own logo, then og:image, then icons, then logo services. Within that, prefer SVG, then PNG with transparency, then JPG, larger first. Skip images that are photos of work, stock images, banners with a logo somewhere inside, or another company's mark. If none is the company's logo, answer pick -1.

Then grade the one you picked:
- usable: flat colours, eight or fewer, no gradients or photos, bold shapes, any text at least a tenth of the logo's height.
- needs_cleanup: a background box to remove, thin strokes, a small file, or one photographic element that could be simplified.
- not_pvc: photographs, gradients throughout, fine script, or a wordmark that is only small text.

Also give the two or three dominant colours as hex, and whether it is a mark, a wordmark, or both.`;

let client: Anthropic | null = null;

export async function gradeCandidates(companyName: string, images: LogoImage[]): Promise<GradeResult | null> {
  client ??= new Anthropic();
  const content: Anthropic.Beta.BetaContentBlockParam[] = [
    { type: "text", text: `Company: ${companyName}. ${images.length} candidate${images.length === 1 ? "" : "s"}.` },
  ];
  images.forEach((img, i) => {
    const size = img.longSide == null ? "vector (SVG)" : `${img.longSide}px on the long side`;
    const bg = img.background === "transparent" ? "already transparent" : img.background === "removed" ? "flat background removed" : "background could not be removed automatically";
    content.push({ type: "text", text: `Candidate ${i}: from ${img.candidate.source.replace("_", " ")}, ${img.format.toUpperCase()}, ${size}, ${bg}.` });
    content.push({ type: "image", source: { type: "base64", media_type: "image/png", data: img.preview.toString("base64") } });
  });

  const response = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(GradeSchema) },
    system: SYSTEM,
    messages: [{ role: "user", content }],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) return null;

  const r = response.parsed_output;
  r.colors = r.colors.map((c) => c.trim().toLowerCase()).filter((c) => /^#[0-9a-f]{6}$/.test(c)).slice(0, 3);
  if (r.pick >= images.length) r.pick = -1;
  return r;
}
