// Render an approved pitch pack (Markdown) to a simple PDF.
import PDFDocument from "pdfkit";
import { marked, type Token, type Tokens } from "marked";

const inline = (text: string) =>
  text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\((.+?)\)/g, "$1 ($2)")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');

export function renderPitchPdf(title: string, markdown: string): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 56, info: { Title: title } });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  doc.font("Helvetica-Bold").fontSize(20).text(title);
  doc.moveDown(0.3).font("Helvetica").fontSize(9).fillColor("#666")
    .text("Overlap pitch pack · evidence from Qloo taste data · agent-drafted, seller-approved");
  doc.fillColor("#000").moveDown(1);

  const render = (tokens: Token[]) => {
    for (const t of tokens) {
      switch (t.type) {
        case "heading": {
          const h = t as Tokens.Heading;
          doc.moveDown(0.6).font("Helvetica-Bold").fontSize(h.depth <= 2 ? 14 : 12).text(inline(h.text));
          doc.moveDown(0.3);
          break;
        }
        case "paragraph":
          doc.font("Helvetica").fontSize(10.5).text(inline((t as Tokens.Paragraph).text), { lineGap: 2 });
          doc.moveDown(0.5);
          break;
        case "list": {
          const l = t as Tokens.List;
          l.items.forEach((item, i) => {
            const bullet = l.ordered ? `${Number(l.start || 1) + i}.` : "•";
            doc.font("Helvetica").fontSize(10.5).text(`${bullet} ${inline(item.text)}`, { indent: 10, lineGap: 2 });
          });
          doc.moveDown(0.5);
          break;
        }
        case "blockquote":
          doc.font("Helvetica-Oblique").fontSize(10.5).text(inline((t as Tokens.Blockquote).text), { indent: 14 });
          doc.moveDown(0.5);
          break;
        case "code":
          doc.font("Courier").fontSize(9.5).text((t as Tokens.Code).text);
          doc.moveDown(0.5);
          break;
        case "hr":
          doc.moveDown(0.3);
          break;
        default:
          if ("text" in t && typeof t.text === "string" && t.text.trim()) {
            doc.font("Helvetica").fontSize(10.5).text(inline(t.text));
          }
      }
    }
  };
  render(marked.lexer(markdown));
  doc.end();
  return done;
}
