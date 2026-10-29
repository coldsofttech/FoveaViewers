import { scoreMatch, squash } from '@coldsofttech/fovea-viewers/core';

/**
 * @typedef {object} Box
 * @property {number} x Distance from the left edge, in EMU (English Metric Units, 914400 to the inch).
 * @property {number} y Distance from the top edge, in EMU.
 * @property {number} w Width, in EMU.
 * @property {number} h Height, in EMU.
 */

/**
 * @typedef {object} Run
 * @property {string} text
 * @property {boolean} [bold]
 * @property {boolean} [italic]
 * @property {boolean} [underline]
 * @property {number} [size] Font size in points.
 * @property {string} [color] A CSS colour.
 */

/**
 * @typedef {object} Paragraph
 * @property {number} level How far it is indented (from 0).
 * @property {boolean} bullet Whether it is a list item.
 * @property {'left' | 'center' | 'right' | 'justify'} [align]
 * @property {Run[]} runs
 */

/**
 * @typedef {object} TextShape
 * @property {'text'} kind
 * @property {Box | null} box
 * @property {'title' | 'subtitle' | 'body' | 'other'} role
 * @property {Paragraph[]} paragraphs
 * @property {string} [fill] A CSS colour.
 * @property {'start' | 'center' | 'end'} anchor Where the text sits up and down in its box.
 * @property {number} scale How much the text was shrunk to fit, from 0 to 1.
 */

/**
 * @typedef {object} PictureShape
 * @property {'picture'} kind
 * @property {Box | null} box
 * @property {string} src A `data:` address.
 * @property {string} alt
 */

/**
 * @typedef {object} TableCell
 * @property {string} text
 * @property {number} colSpan
 * @property {number} rowSpan
 * @property {boolean} covered Whether a merged cell covers this one.
 */

/**
 * @typedef {object} TableShape
 * @property {'table'} kind
 * @property {Box | null} box
 * @property {TableCell[][]} rows
 */

/**
 * @typedef {TextShape | PictureShape | TableShape} Shape
 */

/**
 * @typedef {object} Slide
 * @property {string} title
 * @property {Shape[]} shapes
 * @property {string | undefined} background A CSS colour.
 * @property {string} notes The speaker notes.
 * @property {string} text All the words on the slide, for finding.
 */

/**
 * @typedef {object} Presentation
 * @property {number} width The slide width, in EMU.
 * @property {number} height The slide height, in EMU.
 * @property {Slide[]} slides
 */

const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const REL_TYPE = NS_REL;

// Maps, not objects, because the keys are read from the file.
const MIME = new Map([
  ['png', 'image/png'],
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['gif', 'image/gif'],
  ['bmp', 'image/bmp'],
  ['webp', 'image/webp'],
  ['svg', 'image/svg+xml'],
]);
const ALIGN = new Map([
  ['l', 'left'],
  ['ctr', 'center'],
  ['r', 'right'],
  ['just', 'justify'],
]);
const ANCHOR = new Map([
  ['ctr', 'center'],
  ['b', 'end'],
  ['t', 'start'],
]);

/** @type {Promise<typeof import('jszip')> | null} */
let loading = null;

/**
 * Loads JSZip the first time a presentation is opened, so a page that never shows one never pays
 * for it.
 *
 * @returns {Promise<typeof import('jszip')>}
 */
function loadZip() {
  loading ??= import('jszip').then((module) => module.default ?? module);
  return loading;
}

/**
 * The child elements of an element with a name.
 *
 * @param {Element | null | undefined} element
 * @param {string} name
 * @returns {Element[]}
 */
const kids = (element, name) =>
  Array.from(element?.children ?? []).filter((c) => c.localName === name);

/**
 * The first child element with a name.
 *
 * @param {Element | null | undefined} element
 * @param {string} name
 * @returns {Element | undefined}
 */
const kid = (element, name) => kids(element, name)[0];

/**
 * Follows a path of child element names.
 *
 * @param {Element | null | undefined} element
 * @param {...string} names
 * @returns {Element | undefined}
 */
function under(element, ...names) {
  /** @type {Element | undefined} */
  let at = element ?? undefined;
  for (const name of names) at = at && kid(at, name);
  return at;
}

/**
 * The value of an attribute of an element, by its local name (the namespace is ignored).
 *
 * @param {Element | null | undefined} element
 * @param {string} name
 * @returns {string | undefined}
 */
function attr(element, name) {
  if (!element) return undefined;
  for (const each of Array.from(element.attributes)) {
    if (each.localName === name) return each.value;
  }
  return undefined;
}

/**
 * @param {string} xml
 * @returns {Element}
 */
function parseXml(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const root = doc.documentElement;
  if (!root || root.localName === 'parsererror' || doc.getElementsByTagName('parsererror').length) {
    throw new Error('Part of the presentation is not valid.');
  }
  return root;
}

/**
 * The address of a part, from the part that refers to it.
 *
 * @param {string} from The part the reference is in, for example `ppt/slides/slide1.xml`.
 * @param {string} target The reference, for example `../media/image1.png`.
 * @returns {string}
 */
export function resolvePart(from, target) {
  const parts = target.startsWith('/') ? [] : from.split('/').slice(0, -1);
  for (const piece of target.split('/')) {
    if (piece === '..') parts.pop();
    else if (piece !== '.' && piece !== '') parts.push(piece);
  }
  return parts.join('/');
}

/** @param {string} value */
const colourOf = (value) => (/^[0-9a-f]{6}$/i.test(value) ? `#${value}` : undefined);

/**
 * A solid colour in a fill or colour element, when it is a fixed one (theme colours are not read).
 *
 * @param {Element | undefined} holder An element that has a `solidFill` child.
 * @returns {string | undefined}
 */
function solidColour(holder) {
  return colourOf(attr(under(holder, 'solidFill', 'srgbClr'), 'val') ?? '');
}

/**
 * An `xfrm` element as a box.
 *
 * @param {Element | undefined} xfrm
 * @returns {Box | null}
 */
function boxOf(xfrm) {
  const off = kid(xfrm, 'off');
  const ext = kid(xfrm, 'ext');
  if (!off || !ext) return null;
  return {
    x: Number(attr(off, 'x')) || 0,
    y: Number(attr(off, 'y')) || 0,
    w: Number(attr(ext, 'cx')) || 0,
    h: Number(attr(ext, 'cy')) || 0,
  };
}

/**
 * @typedef {object} Transform
 * @property {number} ox
 * @property {number} oy
 * @property {number} sx
 * @property {number} sy
 */

/**
 * A box moved into the slide by the groups it is in.
 *
 * @param {Box | null} box
 * @param {Transform} transform
 * @returns {Box | null}
 */
const moved = (box, transform) =>
  box && {
    x: transform.ox + box.x * transform.sx,
    y: transform.oy + box.y * transform.sy,
    w: box.w * transform.sx,
    h: box.h * transform.sy,
  };

/**
 * The words in a text body, paragraph by paragraph.
 *
 * @param {Element | undefined} body A `txBody` element.
 * @param {'title' | 'subtitle' | 'body' | 'other'} role
 * @returns {Paragraph[]}
 */
function readParagraphs(body, role) {
  return kids(body, 'p').map((paragraph) => {
    const properties = kid(paragraph, 'pPr');
    const level = Number(attr(properties, 'lvl')) || 0;
    let bullet = role === 'body';
    for (const child of Array.from(properties?.children ?? [])) {
      if (child.localName === 'buNone') bullet = false;
      else if (['buChar', 'buAutoNum', 'buBlip'].includes(child.localName)) bullet = true;
    }
    const align = /** @type {Paragraph['align']} */ (ALIGN.get(attr(properties, 'algn') ?? ''));
    /** @type {Run[]} */
    const runs = [];
    for (const child of Array.from(paragraph.children)) {
      if (child.localName === 'br') {
        runs.push({ text: '\n' });
      } else if (child.localName === 'r' || child.localName === 'fld') {
        const text = kid(child, 't')?.textContent ?? '';
        if (!text) continue;
        const style = kid(child, 'rPr');
        const size = Number(attr(style, 'sz'));
        runs.push({
          text,
          bold: attr(style, 'b') === '1' || attr(style, 'b') === 'true' || undefined,
          italic: attr(style, 'i') === '1' || attr(style, 'i') === 'true' || undefined,
          underline: (attr(style, 'u') ?? 'none') !== 'none' || undefined,
          size: size > 0 ? size / 100 : undefined,
          color: solidColour(style),
        });
      }
    }
    return { level, bullet, align, runs };
  });
}

/** @param {Paragraph[]} paragraphs */
const wordsOf = (paragraphs) =>
  paragraphs
    .map((paragraph) => paragraph.runs.map((run) => run.text).join(''))
    .filter(Boolean)
    .join('\n');

/**
 * What a placeholder is for.
 *
 * @param {Element | undefined} placeholder A `ph` element.
 * @returns {'title' | 'subtitle' | 'body' | 'other'}
 */
function roleOf(placeholder) {
  if (!placeholder) return 'other';
  const type = attr(placeholder, 'type');
  if (type === 'title' || type === 'ctrTitle') return 'title';
  if (type === 'subTitle') return 'subtitle';
  if (type === undefined || type === 'body' || type === 'obj') return 'body';
  return 'other';
}

/**
 * The box a layout or master gives a placeholder.
 *
 * @param {Element | undefined} tree The layout's or master's `spTree`.
 * @param {Element} placeholder The slide's `ph` element.
 * @returns {Box | null}
 */
function inheritedBox(tree, placeholder) {
  const type = attr(placeholder, 'type');
  const index = attr(placeholder, 'idx');
  const title = type === 'title' || type === 'ctrTitle';
  for (const shape of kids(tree, 'sp')) {
    const there = under(shape, 'nvSpPr', 'nvPr', 'ph');
    if (!there) continue;
    const thereType = attr(there, 'type');
    const sameKind =
      index !== undefined
        ? attr(there, 'idx') === index
        : title
          ? thereType === 'title' || thereType === 'ctrTitle'
          : thereType === type;
    if (!sameKind) continue;
    const box = boxOf(under(shape, 'spPr', 'xfrm'));
    if (box) return box;
  }
  return null;
}

/**
 * @typedef {object} Context
 * @property {Map<string, string>} images Picture parts by the id the slide refers to them by.
 * @property {(part: string) => Promise<string>} load Reads a picture part as a `data:` address.
 * @property {Element | undefined} layout The slide's layout `spTree`.
 * @property {Element | undefined} master The layout's master `spTree`.
 * @property {Promise<void>[]} pending Work to wait for before the slide is done.
 */

/**
 * @param {Element} shape A `p:sp` element.
 * @param {Transform} transform
 * @param {Context} context
 * @returns {TextShape | null}
 */
function readTextShape(shape, transform, context) {
  const placeholder = under(shape, 'nvSpPr', 'nvPr', 'ph');
  const role = roleOf(placeholder);
  const properties = kid(shape, 'spPr');
  let box = boxOf(kid(properties, 'xfrm'));
  if (!box && placeholder) {
    box = inheritedBox(context.layout, placeholder) ?? inheritedBox(context.master, placeholder);
  }
  const body = kid(shape, 'txBody');
  const paragraphs = readParagraphs(body, role);
  const fill = solidColour(properties);
  if (!wordsOf(paragraphs) && !fill) return null;
  const properties2 = kid(body, 'bodyPr');
  const anchor = ANCHOR.get(attr(properties2, 'anchor') ?? '');
  const fontScale = Number(attr(kid(properties2, 'normAutofit'), 'fontScale'));
  return {
    kind: 'text',
    box: moved(box, transform),
    role,
    paragraphs,
    fill,
    anchor: /** @type {TextShape['anchor']} */ (anchor ?? 'start'),
    scale: fontScale > 0 ? fontScale / 100000 : 1,
  };
}

/**
 * @param {Element} picture A `p:pic` element.
 * @param {Transform} transform
 * @param {Context} context
 * @returns {PictureShape | null}
 */
function readPicture(picture, transform, context) {
  const id = attr(under(picture, 'blipFill', 'blip'), 'embed');
  const part = id ? context.images.get(id) : undefined;
  if (!part) return null;
  /** @type {PictureShape} */
  const shape = {
    kind: 'picture',
    box: moved(boxOf(under(picture, 'spPr', 'xfrm')), transform),
    src: '',
    alt: attr(under(picture, 'nvPicPr', 'cNvPr'), 'descr') ?? '',
  };
  context.pending.push(
    context.load(part).then(
      (src) => {
        shape.src = src;
      },
      () => {},
    ),
  );
  return shape;
}

/**
 * @param {Element} frame A `p:graphicFrame` element.
 * @param {Transform} transform
 * @returns {TableShape | null}
 */
function readTable(frame, transform) {
  const table = under(frame, 'graphic', 'graphicData', 'tbl');
  if (!table) return null;
  /** @type {TableCell[][]} */
  const rows = kids(table, 'tr').map((row) =>
    kids(row, 'tc').map((cell) => ({
      text: wordsOf(readParagraphs(kid(cell, 'txBody'), 'other')),
      colSpan: Number(attr(cell, 'gridSpan')) || 1,
      rowSpan: Number(attr(cell, 'rowSpan')) || 1,
      covered: attr(cell, 'hMerge') === '1' || attr(cell, 'vMerge') === '1',
    })),
  );
  return { kind: 'table', box: moved(boxOf(kid(frame, 'xfrm')), transform), rows };
}

/**
 * The shapes in a tree, in the order they are drawn, with groups opened up.
 *
 * @param {Element | undefined} tree
 * @param {Transform} transform
 * @param {Context} context
 * @returns {Shape[]}
 */
function readShapes(tree, transform, context) {
  /** @type {Shape[]} */
  const shapes = [];
  for (const child of Array.from(tree?.children ?? [])) {
    /** @type {Shape | null} */
    let shape = null;
    if (child.localName === 'sp') shape = readTextShape(child, transform, context);
    else if (child.localName === 'pic') shape = readPicture(child, transform, context);
    else if (child.localName === 'graphicFrame') shape = readTable(child, transform);
    else if (child.localName === 'grpSp') {
      // The group's children are placed in the group's own coordinates, which are mapped onto its
      // box on the slide.
      const xfrm = under(child, 'grpSpPr', 'xfrm');
      const outer = boxOf(xfrm);
      const chOff = kid(xfrm, 'chOff');
      const chExt = kid(xfrm, 'chExt');
      let inside = transform;
      if (outer && chOff && chExt) {
        const across = Number(attr(chExt, 'cx')) || 0;
        const down = Number(attr(chExt, 'cy')) || 0;
        const sx = across > 0 ? outer.w / across : 1;
        const sy = down > 0 ? outer.h / down : 1;
        inside = {
          ox: transform.ox + (outer.x - (Number(attr(chOff, 'x')) || 0) * sx) * transform.sx,
          oy: transform.oy + (outer.y - (Number(attr(chOff, 'y')) || 0) * sy) * transform.sy,
          sx: sx * transform.sx,
          sy: sy * transform.sy,
        };
      }
      shapes.push(...readShapes(child, inside, context));
    }
    if (shape) shapes.push(shape);
  }
  return shapes;
}

/**
 * The relationships of a part: where each id points, and what kind of thing it is.
 *
 * @param {import('jszip')} zip
 * @param {string} part
 * @returns {Promise<{ id: string, type: string, target: string }[]>}
 */
async function relationshipsOf(zip, part) {
  const slash = part.lastIndexOf('/');
  const file = zip.file(`${part.slice(0, slash + 1)}_rels/${part.slice(slash + 1)}.rels`);
  if (!file) return [];
  const root = parseXml(await file.async('string'));
  return kids(root, 'Relationship').map((each) => ({
    id: attr(each, 'Id') ?? '',
    type: attr(each, 'Type') ?? '',
    target: attr(each, 'Target') ?? '',
  }));
}

/**
 * @param {string} part
 * @returns {string}
 */
function mimeOf(part) {
  return (
    MIME.get(part.slice(part.lastIndexOf('.') + 1).toLowerCase()) ?? 'application/octet-stream'
  );
}

const NO_MOVE = { ox: 0, oy: 0, sx: 1, sy: 1 };

/**
 * Reads a `.pptx` or `.pptm` presentation. Macros are never run.
 *
 * @param {Blob | ArrayBuffer} source
 * @returns {Promise<Presentation>}
 */
export async function parsePresentation(source) {
  const JSZip = await loadZip();
  const buffer = source instanceof Blob ? await source.arrayBuffer() : source;
  const zip = await JSZip.loadAsync(buffer);

  const mainFile = zip.file('ppt/presentation.xml');
  if (!mainFile) throw new Error('This file is not a PowerPoint presentation.');
  const main = parseXml(await mainFile.async('string'));
  const size = under(main, 'sldSz');
  const width = Number(attr(size, 'cx')) || 9144000;
  const height = Number(attr(size, 'cy')) || 6858000;

  const mainRelations = await relationshipsOf(zip, 'ppt/presentation.xml');
  const slideParts = kids(under(main, 'sldIdLst'), 'sldId')
    .map((each) => {
      const id = Array.from(each.attributes).find((a) => a.namespaceURI === NS_REL)?.value;
      const target = mainRelations.find((relation) => relation.id === id)?.target;
      return target ? resolvePart('ppt/presentation.xml', target) : null;
    })
    .filter((part) => part !== null);

  /** @param {string} part */
  const load = async (part) => {
    const file = zip.file(part);
    if (!file) throw new Error('Missing picture.');
    return `data:${mimeOf(part)};base64,${await file.async('base64')}`;
  };

  /** @type {Map<string, Element | undefined>} */
  const trees = new Map();
  /** @param {string} part */
  const treeOf = async (part) => {
    if (!trees.has(part)) {
      const file = zip.file(part);
      trees.set(
        part,
        file ? under(parseXml(await file.async('string')), 'cSld', 'spTree') : undefined,
      );
    }
    return trees.get(part);
  };

  /** @type {Slide[]} */
  const slides = [];
  for (const part of slideParts) {
    const file = zip.file(part);
    if (!file) continue;
    const root = parseXml(await file.async('string'));
    const relations = await relationshipsOf(zip, part);
    const layoutTarget = relations.find((each) => each.type === `${REL_TYPE}/slideLayout`)?.target;
    const layoutPart = layoutTarget ? resolvePart(part, layoutTarget) : null;
    const masterTarget = layoutPart
      ? (await relationshipsOf(zip, layoutPart)).find(
          (each) => each.type === `${REL_TYPE}/slideMaster`,
        )?.target
      : undefined;

    /** @type {Context} */
    const context = {
      images: new Map(
        relations
          .filter((each) => each.type === `${REL_TYPE}/image`)
          .map((each) => [each.id, resolvePart(part, each.target)]),
      ),
      load,
      layout: layoutPart ? await treeOf(layoutPart) : undefined,
      master:
        layoutPart && masterTarget
          ? await treeOf(resolvePart(layoutPart, masterTarget))
          : undefined,
      pending: [],
    };
    const shapes = readShapes(under(root, 'cSld', 'spTree'), NO_MOVE, context);
    await Promise.all(context.pending);

    let notes = '';
    const notesTarget = relations.find((each) => each.type === `${REL_TYPE}/notesSlide`)?.target;
    const notesFile = notesTarget ? zip.file(resolvePart(part, notesTarget)) : null;
    if (notesFile) {
      const tree = under(parseXml(await notesFile.async('string')), 'cSld', 'spTree');
      notes = kids(tree, 'sp')
        .filter((shape) => attr(under(shape, 'nvSpPr', 'nvPr', 'ph'), 'type') === 'body')
        .map((shape) => wordsOf(readParagraphs(kid(shape, 'txBody'), 'other')))
        .filter(Boolean)
        .join('\n');
    }

    const titled = shapes.find((shape) => shape.kind === 'text' && shape.role === 'title');
    const texts = shapes.flatMap((shape) =>
      shape.kind === 'text'
        ? [wordsOf(shape.paragraphs)]
        : shape.kind === 'table'
          ? shape.rows.flatMap((row) => row.map((cell) => cell.text))
          : [],
    );
    const firstText = texts.find(Boolean) ?? '';
    slides.push({
      title:
        (titled && titled.kind === 'text' ? wordsOf(titled.paragraphs) : firstText)
          .split('\n')[0]
          ?.trim() ?? '',
      shapes,
      background: solidColour(under(root, 'cSld', 'bg', 'bgPr')),
      notes,
      text: texts.filter(Boolean).join('\n'),
    });
  }
  if (slides.length === 0) throw new Error('This presentation has no slides.');
  return { width, height, slides };
}

/**
 * Finds the slide that holds some words: the place where the words and the text around them agree
 * best.
 *
 * @param {Slide[]} slides
 * @param {{ matched: string, before?: string, after?: string } | undefined} target
 * @param {boolean} withNotes Whether the speaker notes are looked in.
 * @returns {number | null}
 */
export function locate(slides, target, withNotes) {
  const needle = squash(target?.matched);
  if (!needle) return null;
  const before = squash(target?.before);
  const after = squash(target?.after);
  /** @type {number | null} */
  let best = null;
  let bestScore = -1;
  slides.forEach((slide, index) => {
    const hay = squash(withNotes ? `${slide.text}\n${slide.notes}` : slide.text);
    const { at, score } = scoreMatch(hay, needle, before, after);
    if (at !== -1 && score > bestScore) {
      best = index;
      bestScore = score;
    }
  });
  return best;
}
