// Render an approved pitch pack (Markdown) to a PDF in the Overlap look: an Ink header band with the
// mark, condensed display headings, Coral list markers, and a running footer. The PDF is the version
// a seller sends, so the internal "Seller notes" section is left out.
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";
import { marked, type Token, type Tokens } from "marked";

const asset = (p: string) => fileURLToPath(new URL(`../../assets/${p}`, import.meta.url));
const FONTS = {
  display: asset("fonts/Bricolage-Display-Condensed-ExtraBold.ttf"),
  displayWide: asset("fonts/Bricolage-Display-Bold.ttf"),
  body: asset("fonts/Inter-Regular.ttf"),
  bold: asset("fonts/Inter-SemiBold.ttf"),
};
const MARK = asset("mark-dark.png");
const MONO = asset("fonts/JetBrainsMono-Regular.ttf");

/** Data figures set in mono: call references and ranks (#1186, #3), decimals (0.931), signed skews (+0.43).
    Plain prose numbers ("a 20-minute call") stay in the body face. Capturing group for split(). */
const NUMERIC = /((?:call |Qloo )?#\d+|[+-]?\d+\.\d+)/g;

const INK = "#111216";
const INK_SOFT = "#5d5f66";
const ON_INK_SOFT = "#9c9ea5";
const PAPER = "#f3f3f1";
const CORAL = "#ff5a36";
const RULE = "#cfcfc9";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 54;
const WIDTH = PAGE_W - M * 2;

const clean = (text: string) =>
  text
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\((.+?)\)/g, "$1 ($2)")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<");

/** Drop the "Seller notes (internal ...)" section: heading through to the next heading of the same depth. */
export function publicMarkdown(md: string): string {
  return md.replace(/^(#{1,3})\s*Seller notes[^\n]*\n[\s\S]*?(?=^#{1,3}\s|$(?![\s\S]))/im, "");
}

export function renderPitchPdf(title: string, markdown: string, approvedAt?: Date | null): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margins: { top: M, bottom: 64, left: M, right: M }, info: { Title: title }, bufferPages: true });
  doc.registerFont("display", FONTS.display);
  doc.registerFont("displayWide", FONTS.displayWide);
  doc.registerFont("body", FONTS.body);
  doc.registerFont("bold", FONTS.bold);
  doc.registerFont("mono", MONO);
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  // ---- Header band ----
  const bandH = 168;
  doc.rect(0, 0, PAGE_W, bandH).fill(INK);
  doc.image(MARK, PAGE_W - M - 74, 40, { width: 74 });
  doc.font("display").fontSize(30).fillColor(PAPER).text(title.toUpperCase(), M, 46, { width: WIDTH - 100, lineGap: -4 });
  const stamp = approvedAt ? `approved by the seller on ${approvedAt.toISOString().slice(0, 10)}` : "approved by the seller";
  doc
    .font("body")
    .fontSize(8.5)
    .fillColor(ON_INK_SOFT)
    .text(`Evidence from Qloo taste data · drafted by Overlap · ${stamp}`, M, bandH - 30, { width: WIDTH });
  doc.x = M;
  doc.y = bandH + 30;

  // Inline **bold** as runs of SemiBold within a paragraph.
  const rich = (text: string, opts: PDFKit.Mixins.TextOptions & { x?: number; size?: number; color?: string } = {}) => {
    const { x = doc.x, size = 10, color = INK, ...rest } = opts;
    // Runs: **bold** spans, and within every span the figures (affinities, ranks, call IDs) in tabular mono.
    const segs = clean(text)
      .split(/\*\*(.+?)\*\*/g)
      .flatMap((s, i) =>
        s
          .replace(/\*(.+?)\*/g, "$1")
          .split(NUMERIC)
          .map((part, j) => ({ s: part, font: j % 2 === 1 ? "mono" : i % 2 === 1 ? "bold" : "body" })),
      )
      .filter((p) => p.s);
    doc.fillColor(color).fontSize(size);
    // pdfkit continues a paragraph across font changes only when later runs pass no position or layout options.
    segs.forEach((p, i) => {
      doc.font(p.font).fontSize(p.font === "mono" ? size * 0.92 : size);
      const continued = i < segs.length - 1;
      if (i === 0) doc.text(p.s, x, undefined, { lineGap: 3, ...rest, continued });
      else doc.text(p.s, { continued });
    });
  };

  const ensure = (h: number) => {
    if (doc.y + h > PAGE_H - 70) doc.addPage();
  };

  const render = (tokens: Token[]) => {
    for (const t of tokens) {
      switch (t.type) {
        case "heading": {
          const h = t as Tokens.Heading;
          if (h.depth <= 2) {
            ensure(70);
            doc.moveDown(0.8);
            const y = doc.y;
            doc.moveTo(M, y).lineTo(PAGE_W - M, y).lineWidth(1.2).strokeColor(INK).stroke();
            doc.font("display").fontSize(15).fillColor(INK).text(clean(h.text).toUpperCase(), M, y + 8, { width: WIDTH });
            doc.moveDown(0.35);
          } else {
            ensure(40);
            doc.moveDown(0.4);
            doc.font("bold").fontSize(10.5).fillColor(INK).text(clean(h.text), M, undefined, { width: WIDTH });
            doc.moveDown(0.15);
          }
          break;
        }
        case "paragraph":
          ensure(30);
          rich((t as Tokens.Paragraph).text, { x: M, width: WIDTH });
          doc.moveDown(0.6);
          break;
        case "list": {
          const l = t as Tokens.List;
          l.items.forEach((item, i) => {
            ensure(24);
            const y = doc.y;
            if (l.ordered) doc.font("bold").fontSize(9).fillColor(CORAL).text(`${Number(l.start || 1) + i}.`, M, y + 1, { width: 14 });
            else doc.rect(M + 1, y + 4.5, 4, 4).fill(CORAL);
            doc.y = y;
            rich(item.text, { x: M + 16, width: WIDTH - 16 });
            doc.moveDown(0.25);
          });
          doc.moveDown(0.4);
          break;
        }
        case "blockquote": {
          ensure(30);
          const y = doc.y;
          rich((t as Tokens.Blockquote).text.replace(/^>\s?/gm, ""), { x: M + 14, width: WIDTH - 14, color: INK_SOFT });
          doc.moveTo(M + 2, y).lineTo(M + 2, doc.y).lineWidth(1).strokeColor(RULE).stroke();
          doc.moveDown(0.6);
          break;
        }
        case "code":
          doc.font("body").fontSize(9).fillColor(INK_SOFT).text((t as Tokens.Code).text, M, undefined, { width: WIDTH });
          doc.moveDown(0.5);
          break;
        case "hr":
          break;
        default:
          if ("text" in t && typeof t.text === "string" && t.text.trim()) rich(t.text, { x: M, width: WIDTH });
      }
    }
  };
  render(marked.lexer(publicMarkdown(markdown)));

  // ---- Running footer on every page ----
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    // Writing inside the bottom margin would make pdfkit start a new page; lift the margin for the footer.
    doc.page.margins.bottom = 0;
    const y = PAGE_H - 40;
    doc.moveTo(M, y - 8).lineTo(PAGE_W - M, y - 8).lineWidth(0.6).strokeColor(RULE).stroke();
    doc
      .font("body")
      .fontSize(7.5)
      .fillColor(INK_SOFT)
      .text("Overlap · Names identify; they do not imply endorsement. Affinity is an aggregate taste signal, not a forecast.", M, y, {
        width: WIDTH - 60,
        lineBreak: false,
      });
    doc.text(`${i + 1} / ${range.count}`, PAGE_W - M - 50, y, { width: 50, align: "right", lineBreak: false });
  }
  doc.end();
  return done;
}
