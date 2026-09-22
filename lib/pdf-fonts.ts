// Server-only — never import from client components.
//
// ONE place that registers fonts for every @react-pdf document (invoice,
// attendance, customers, reports).
//
// ₹ (U+20B9): Inter's latin subset — the face every PDF uses — has no rupee
// glyph, so a bare "Inter" stack printed amounts with a blank where ₹ belongs.
// Noto Sans latin-ext does have it, and react-pdf substitutes per code point
// through a family stack, so PDF_FONT puts it behind Inter as a fallback. (Inter
// latin-ext also has ₹, but it shares Inter's PostScript name and the PDF writer
// then merges the two faces into one, losing the glyph — hence Noto.)
//
// Serverless: the files are read from node_modules at runtime. Each path is
// written out in full on purpose — a path assembled from pieces makes the file
// tracer copy the whole @fontsource folder (~540 files, 11 MB) into every PDF
// function. next.config.ts `outputFileTracingIncludes` lists the same four
// files as a backstop; keep the two lists in step.

import path from "path";
import { Font } from "@react-pdf/renderer";

Font.register({
  family: "Inter",
  fonts: [
    { src: path.join(process.cwd(), "node_modules/@fontsource/inter/files/inter-latin-400-normal.woff"), fontWeight: 400 },
    { src: path.join(process.cwd(), "node_modules/@fontsource/inter/files/inter-latin-700-normal.woff"), fontWeight: 700 },
  ],
});

Font.register({
  family: "RupeeFallback",
  fonts: [
    { src: path.join(process.cwd(), "node_modules/@fontsource/noto-sans/files/noto-sans-latin-ext-400-normal.woff"), fontWeight: 400 },
    { src: path.join(process.cwd(), "node_modules/@fontsource/noto-sans/files/noto-sans-latin-ext-700-normal.woff"), fontWeight: 700 },
  ],
});

Font.registerHyphenationCallback((w) => [w]);

/** Use as `fontFamily` on every PDF page: Inter, with ₹ drawn from Noto Sans. */
export const PDF_FONT = ["Inter", "RupeeFallback"] as unknown as string;
