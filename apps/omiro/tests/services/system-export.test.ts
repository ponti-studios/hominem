import { describe, expect, it, vi } from 'vitest';

import { buildNoteHtml, pdfFileName } from '~/services/system/note-pdf';
import { appendScannedText } from '~/services/system/scan-text';

vi.mock('expo-sharing', () => ({}));
vi.mock('expo-image-picker', () => ({}));

describe('buildNoteHtml', () => {
  it('renders the title as the page heading and the markdown beneath it', () => {
    const html = buildNoteHtml('Trip', '## Packing\n\n- passport');
    expect(html).toContain('<h1 class="title">Trip</h1>');
    expect(html).toContain('<h2>Packing</h2>');
    expect(html).toContain('<li>passport</li>');
  });

  it('leaves the heading out for an untitled note', () => {
    expect(buildNoteHtml('  ', 'body')).not.toContain('class="title"');
  });

  it('escapes markup in the title and does not run raw HTML from the body', () => {
    const html = buildNoteHtml('<b>x</b>', '<script>alert(1)</script>');
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(html).not.toContain('<script>');
  });
});

describe('pdfFileName', () => {
  it('drops characters a file path cannot hold', () => {
    expect(pdfFileName('Q3: plan / budget?')).toBe('Q3 plan budget');
  });

  it('falls back to Note when nothing usable is left', () => {
    expect(pdfFileName(' /// ')).toBe('Note');
    expect(pdfFileName('')).toBe('Note');
  });

  it('caps a very long title', () => {
    expect(pdfFileName('a'.repeat(200))).toHaveLength(80);
  });
});

describe('appendScannedText', () => {
  it('uses the scanned text alone when nothing is typed', () => {
    expect(appendScannedText('', '  Receipt total 42  ')).toBe('Receipt total 42');
  });

  it('adds the scanned text as a new paragraph after what is typed', () => {
    expect(appendScannedText('From the whiteboard:\n', 'Ship Friday')).toBe(
      'From the whiteboard:\n\nShip Friday',
    );
  });

  it('leaves the draft alone when the photo had no text', () => {
    expect(appendScannedText('draft', '   ')).toBe('draft');
  });
});
