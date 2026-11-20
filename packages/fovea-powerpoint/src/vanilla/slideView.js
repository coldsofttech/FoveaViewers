import styles from '../PowerpointViewer.module.css';

/**
 * @typedef {import('../parsePresentation.js').Slide} Slide
 * @typedef {import('../parsePresentation.js').Shape} Shape
 * @typedef {import('../parsePresentation.js').Paragraph} Paragraph
 * @typedef {import('../parsePresentation.js').Box} Box
 * @typedef {ReturnType<typeof import('@coldsofttech/fovea-viewers/core/vanilla').createH>} H
 */

const EMU_PER_POINT = 12700;
// What a size is when the file does not give one: PowerPoint takes it from the slide's theme,
// which is not read.
const DEFAULT_SIZE = { title: 40, subtitle: 28, body: 24, other: 18 };

/**
 * Where a shape sits on the slide, as percentages so the slide can be any size.
 *
 * @param {Box | null} box
 * @param {number} width The slide's width, in EMU.
 * @param {number} height The slide's height, in EMU.
 */
function place(box, width, height) {
  if (!box) return { left: '5%', top: '5%', width: '90%', height: '90%' };
  return {
    left: `${(box.x / width) * 100}%`,
    top: `${(box.y / height) * 100}%`,
    width: `${(box.w / width) * 100}%`,
    height: `${(box.h / height) * 100}%`,
  };
}

/**
 * A text size in points as a share of the slide's width, so text scales with the slide.
 *
 * @param {number} points
 * @param {number} width The slide's width, in EMU.
 * @returns {string}
 */
const sized = (points, width) => `${(points / (width / EMU_PER_POINT)) * 100}cqw`;

/**
 * @param {HTMLElement} element
 * @param {Record<string, string | undefined>} style
 */
function styled(element, style) {
  for (const [name, value] of Object.entries(style)) {
    // eslint-disable-next-line security/detect-object-injection -- a CSS property name written in this file.
    if (value !== undefined) /** @type {any} */ (element.style)[name] = value;
  }
  return element;
}

/**
 * The runs of a paragraph: text in spans (bold, italic, underline, size, colour), and line breaks.
 *
 * @param {H} h
 * @param {Paragraph} paragraph
 * @param {number} size
 * @param {number} scale
 * @param {number} width
 */
function runs(h, paragraph, size, scale, width) {
  return paragraph.runs.map((run) =>
    run.text === '\n'
      ? h('br')
      : styled(h('span', null, run.text), {
          fontWeight: run.bold ? '700' : undefined,
          fontStyle: run.italic ? 'italic' : undefined,
          textDecoration: run.underline ? 'underline' : undefined,
          fontSize: sized((run.size ?? size) * scale, width),
          color: run.color,
        }),
  );
}

/**
 * The words of a shape: list items together in a list, other paragraphs on their own.
 *
 * @param {H} h
 * @param {import('../parsePresentation.js').TextShape} shape
 * @param {number} width
 */
function words(h, shape, width) {
  const size = DEFAULT_SIZE[shape.role];
  const paragraphs = shape.paragraphs.filter((paragraph) => paragraph.runs.length > 0);
  /** @type {Array<Paragraph[]>} */
  const groups = [];
  for (const paragraph of paragraphs) {
    const last = groups.at(-1);
    if (last && last[0]?.bullet === paragraph.bullet && paragraph.bullet) last.push(paragraph);
    else groups.push([paragraph]);
  }
  const align = (/** @type {HTMLElement} */ element, /** @type {Paragraph} */ paragraph) =>
    styled(element, {
      textAlign: paragraph.align,
      marginLeft: paragraph.level ? `${paragraph.level * 1.5}em` : undefined,
    });
  return groups.map((group) =>
    group[0]?.bullet
      ? h(
          'ul',
          { class: styles.list },
          group.map((paragraph) =>
            align(h('li', null, runs(h, paragraph, size, shape.scale, width)), paragraph),
          ),
        )
      : h(
          'div',
          null,
          group.map((paragraph) =>
            align(
              h('p', { class: styles.paragraph }, runs(h, paragraph, size, shape.scale, width)),
              paragraph,
            ),
          ),
        ),
  );
}

/**
 * One slide: its text, tables and pictures placed as they are in the file, scaled to the width they
 * are given.
 *
 * @param {H} h
 * @param {Slide} slide
 * @param {number} width The slide's width, in EMU.
 * @param {number} height The slide's height, in EMU.
 * @returns {HTMLElement}
 */
export function slideView(h, slide, width, height) {
  const element = styled(h('div', { class: styles.slide }), {
    aspectRatio: `${width} / ${height}`,
    background: slide.background,
  });
  for (const shape of slide.shapes) {
    const where = place(shape.box, width, height);
    if (shape.kind === 'picture') {
      if (shape.src) {
        element.append(
          styled(h('img', { class: styles.picture, src: shape.src, alt: shape.alt }), where),
        );
      }
    } else if (shape.kind === 'table') {
      const body = h(
        'tbody',
        null,
        shape.rows.map((row) =>
          h(
            'tr',
            null,
            row.map((cell) =>
              cell.covered
                ? null
                : h(
                    'td',
                    {
                      colspan: cell.colSpan > 1 ? cell.colSpan : null,
                      rowspan: cell.rowSpan > 1 ? cell.rowSpan : null,
                    },
                    cell.text,
                  ),
            ),
          ),
        ),
      );
      const table = styled(h('table', { class: styles.table }, body), {
        fontSize: sized(14, width),
      });
      element.append(styled(h('div', { class: styles.shape }, table), where));
    } else {
      const anchor = { start: 'flex-start', center: 'center', end: 'flex-end' };
      const box = styled(h('div', { class: styles.shape }), {
        ...where,
        background: shape.fill,
        justifyContent: anchor[shape.anchor],
      });
      if (shape.role === 'title') {
        const title = h('h2', { class: styles.title });
        shape.paragraphs
          .filter((paragraph) => paragraph.runs.length > 0)
          .forEach((paragraph, at) => {
            if (at > 0) title.append(h('br'));
            title.append(...runs(h, paragraph, DEFAULT_SIZE.title, shape.scale, width));
          });
        box.append(title);
      } else {
        box.append(...words(h, shape, width));
      }
      element.append(box);
    }
  }
  return element;
}
