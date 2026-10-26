// Shared look for the Nueva Technology proposal documents (same layout as the clinic and SJCMPC ones): simple, Word-like, A4.
const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, AlignmentType, Header, Footer, PageNumber,
  TableOfContents, LevelFormat, PageBreak, TabStopType, ImageRun,
} = require('docx');

const BRAND = '0A2E73';
const ACCENT = 'A86F00';
const SOFT = 'E8EEF9';
const ROW_ALT = 'F5F7FB';
const GREY_TEXT = '5E6678';
const CODE_BG = 'F3F4F4';
const BORDER = 'C9D2E3';

const PAGE_W = 11906; // A4
const PAGE_H = 16838;
const MARGIN = 1134; // 2 cm
const CONTENT_W = PAGE_W - MARGIN * 2; // 9638

const FONT = 'Calibri';
const MONO = 'Consolas';

// Inline markup: **bold** and `code`.
function runs(text, base = {}) {
  if (Array.isArray(text)) return text;
  const parts = String(text).split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter((s) => s !== '');
  return parts.map((part) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return new TextRun({ ...base, text: part.slice(2, -2), bold: true });
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return new TextRun({ ...base, text: part.slice(1, -1), font: MONO, size: (base.size || 21) - 2, color: base.color || '1F3A2C' });
    }
    return new TextRun({ ...base, text: part });
  });
}

const p = (text, opts = {}) => new Paragraph({ children: runs(text, opts.run || {}), spacing: { after: 120, line: 276 }, ...opts.para });
// Captions and section notes: kept on the same page as what follows.
const small = (text) => p(text, { run: { size: 18, color: GREY_TEXT }, para: { keepNext: true } });
const h1 = (text, pageBreak = true) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)], pageBreakBefore: pageBreak });
const h2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });
const h3 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(text)] });
const bullets = (items, level = 0) => items.map((t) => new Paragraph({ numbering: { reference: 'bullets', level }, children: runs(t), spacing: { after: 60, line: 264 } }));
let listCounter = 0;
const numbered = (items) => {
  const ref = `numbered-${listCounter++}`;
  numberingConfigs.push({ reference: ref, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 360 } } } }] });
  return items.map((t) => new Paragraph({ numbering: { reference: ref, level: 0 }, children: runs(t), spacing: { after: 60, line: 264 } }));
};
const numberingConfigs = [
  {
    reference: 'bullets',
    levels: [
      { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 300 } } } },
      { level: 1, format: LevelFormat.BULLET, text: '–', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1080, hanging: 300 } } } },
    ],
  },
];

const cellBorders = {
  top: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
  left: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
  right: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
};

/**
 * table(['A','B'], [['1','2']], [30, 70])  widths as percentages of content width.
 */
function table(headers, rows, percents, opts = {}) {
  const widths = percents.map((pc) => Math.floor((CONTENT_W * pc) / 100));
  widths[widths.length - 1] += CONTENT_W - widths.reduce((a, b) => a + b, 0);
  const size = opts.size || 19;

  const cell = (text, i, header, alt) => new TableCell({
    width: { size: widths[i], type: WidthType.DXA },
    borders: cellBorders,
    shading: header ? { type: ShadingType.CLEAR, fill: BRAND, color: 'auto' } : alt ? { type: ShadingType.CLEAR, fill: ROW_ALT, color: 'auto' } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: String(text ?? '').split('\n').map((line) => new Paragraph({
      spacing: { after: 0, line: 252 },
      children: runs(line, header ? { bold: true, color: 'FFFFFF', size } : { size, ...(i === 0 && opts.boldFirst ? { bold: true, color: BRAND } : {}) }),
    })),
  });

  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      ...(headers ? [new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((h, i) => cell(h, i, true)) })] : []),
      ...rows.map((r, ri) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, i, false, ri % 2 === 1)) })),
    ],
  });
}

const spacer = (after = 120) => new Paragraph({ children: [], spacing: { after } });

function code(text) {
  const lines = String(text).replace(/\r/g, '').split('\n');
  return lines.map((line, i) => new Paragraph({
    shading: { type: ShadingType.CLEAR, fill: CODE_BG, color: 'auto' },
    border: {
      left: { style: BorderStyle.SINGLE, size: 12, color: ACCENT, space: 6 },
      ...(i === 0 ? { top: { style: BorderStyle.SINGLE, size: 2, color: CODE_BG, space: 4 } } : {}),
      ...(i === lines.length - 1 ? { bottom: { style: BorderStyle.SINGLE, size: 2, color: CODE_BG, space: 4 } } : {}),
    },
    keepLines: true,
    keepNext: i < lines.length - 1,
    spacing: { after: i === lines.length - 1 ? 160 : 0, line: 240 },
    indent: { left: 120 },
    children: [new TextRun({ text: line.length ? line : ' ', font: MONO, size: 16, color: '1B2333' })],
  }));
}

function note(text, title = 'Note') {
  return new Paragraph({
    shading: { type: ShadingType.CLEAR, fill: SOFT, color: 'auto' },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: BRAND, space: 8 } },
    indent: { left: 160, right: 80 },
    spacing: { before: 80, after: 160, line: 264 },
    children: [new TextRun({ text: `${title}. `, bold: true, color: BRAND }), ...runs(text)],
  });
}

// PNG size from its header, so images keep their proportions.
function pngSize(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

/**
 * image('shots/home.png', { width: 640, caption: 'Figure 1. ...' })  width in pixels (content width is about 640).
 */
function image(file, { width = 640, caption, maxHeight = 860 } = {}) {
  const { w, h } = pngSize(file);
  let wd = width;
  let ht = Math.round((h * wd) / w);
  if (ht > maxHeight) { ht = maxHeight; wd = Math.round((w * ht) / h); }
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      keepNext: !!caption,
      spacing: { before: 120, after: caption ? 60 : 200 },
      children: [new ImageRun({ type: 'png', data: fs.readFileSync(file), transformation: { width: wd, height: ht }, altText: { title: caption || 'Image', description: caption || 'Image', name: caption || 'Image' } })],
    }),
    ...(caption ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 220 }, children: [new TextRun({ text: caption, italics: true, size: 18, color: GREY_TEXT })] })] : []),
  ];
}

function cover({ eyebrow, title, subtitle, meta, logo }) {
  return [
    ...(logo ? [new Paragraph({ spacing: { before: 600, after: 0 }, children: [new ImageRun({ type: 'png', data: fs.readFileSync(logo), transformation: { width: 150, height: 150 }, altText: { title: 'Logo', description: 'Logo', name: 'Logo' } })] })] : []),
    new Paragraph({ spacing: { before: logo ? 400 : 2200, after: 120 }, children: [new TextRun({ text: 'FIVE STAR BUS COMPANY', bold: true, color: ACCENT, size: 20, characterSpacing: 40 })] }),
    new Paragraph({ spacing: { after: 600 }, children: [new TextRun({ text: 'Bus Reservation & Operations System · Website, Mobile App & Staff Portal', color: GREY_TEXT, size: 24 })] }),
    new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: eyebrow.toUpperCase(), bold: true, color: ACCENT, size: 18, characterSpacing: 30 })] }),
    new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: title, bold: true, color: BRAND, size: 56, font: FONT })] }),
    new Paragraph({
      spacing: { after: 900 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: BRAND, space: 12 } },
      children: [new TextRun({ text: subtitle, color: '333333', size: 26 })],
    }),
    table(null, meta, [30, 70], { boldFirst: true }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

function tocPage() {
  return [
    new Paragraph({ children: [new TextRun({ text: 'Contents', bold: true, color: BRAND, size: 36 })], spacing: { after: 200 } }),
    new TableOfContents('Contents', { hyperlink: true, headingStyleRange: '1-2' }),
  ];
}

function build({ title, sections, file }) {
  const doc = new Document({
    creator: 'Nueva Technology',
    title,
    styles: {
      default: { document: { run: { font: FONT, size: 21, color: '222222' } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 34, bold: true, color: BRAND, font: FONT }, paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 0, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: BRAND, space: 6 } } } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 26, bold: true, color: BRAND, font: FONT }, paragraph: { spacing: { before: 280, after: 100 }, outlineLevel: 1, keepNext: true } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 22, bold: true, color: ACCENT, font: FONT }, paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 2, keepNext: true } },
      ],
    },
    numbering: { config: numberingConfigs },
    sections: [{
      properties: { page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN, header: 560, footer: 560 } }, titlePage: true },
      headers: {
        default: new Header({ children: [new Paragraph({
          tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER, space: 4 } },
          children: [new TextRun({ text: 'Five Star Bus Reservation & Operations System', size: 16, color: GREY_TEXT }), new TextRun({ text: `\t${title}`, size: 16, color: GREY_TEXT })],
        })] }),
        first: new Header({ children: [new Paragraph({ children: [] })] }),
      },
      footers: {
        default: new Footer({ children: [new Paragraph({
          tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
          children: [
            new TextRun({ text: 'Nueva Technology', size: 16, color: GREY_TEXT }),
            new TextRun({ children: ['\tPage ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES], size: 16, color: GREY_TEXT }),
          ],
        })] }),
        first: new Footer({ children: [new Paragraph({ children: [] })] }),
      },
      children: sections.flat(),
    }],
  });

  return Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(file, buf); console.log('wrote', file); });
}

module.exports = { image, p, small, h1, h2, h3, bullets, numbered, table, code, note, spacer, cover, tocPage, build, runs };
