import * as Sharing from 'expo-sharing';
import MarkdownIt from 'markdown-it';

import OmiroSystem from '~/modules/omiro-system';

// `html: false` keeps raw HTML in a note from running as markup in the PDF.
const markdown = new MarkdownIt({ html: false, linkify: true });

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Print styles for the PDF page. Hex literals here are paper colours for a
// printed document, not app surfaces, so they sit outside the theme tokens.
const PRINT_STYLES = `
  body { font: 12pt/1.5 -apple-system, sans-serif; color: #14121f; }
  h1.title { font-size: 22pt; margin: 0 0 14pt; }
  h1, h2, h3 { line-height: 1.25; }
  pre, code { font-family: ui-monospace, Menlo, monospace; font-size: 10pt; }
  pre { background: #f4f2fb; padding: 8pt; border-radius: 6pt; white-space: pre-wrap; }
  blockquote { border-left: 2pt solid #6c4dff; margin-left: 0; padding-left: 10pt; color: #625f78; }
  img { max-width: 100%; }
`;

// The note as a standalone HTML document: title as the page heading, the
// markdown body rendered beneath it.
export function buildNoteHtml(title: string, content: string): string {
  const heading = title.trim() ? `<h1 class="title">${escapeHtml(title.trim())}</h1>` : '';
  return `<!doctype html><html><head><meta charset="utf-8"><style>${PRINT_STYLES}</style></head><body>${heading}${markdown.render(content)}</body></html>`;
}

// A file name the share sheet and Files can show: the title without characters
// a path can't hold, or "Note" when there is nothing left.
export function pdfFileName(title: string): string {
  return (
    title
      .replace(/[\\/:*?"<>|\n\r]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || 'Note'
  );
}

// Renders the note to a PDF on-device and hands it to the share sheet.
export async function shareNoteAsPdf(title: string, content: string) {
  const uri = await OmiroSystem.renderPdf(pdfFileName(title), buildNoteHtml(title, content));
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
}
