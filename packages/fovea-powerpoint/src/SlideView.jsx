import { Fragment } from 'react';
import styles from './PowerpointViewer.module.css';

/**
 * @typedef {import('./parsePresentation.js').Slide} Slide
 * @typedef {import('./parsePresentation.js').Shape} Shape
 * @typedef {import('./parsePresentation.js').Paragraph} Paragraph
 * @typedef {import('./parsePresentation.js').Box} Box
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
 * @returns {import('react').CSSProperties}
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
 * @param {{ paragraph: Paragraph, size: number, scale: number, width: number }} props
 */
function Runs({ paragraph, size, scale, width }) {
  return paragraph.runs.map((run, index) =>
    run.text === '\n' ? (
      <br key={index} />
    ) : (
      <span
        key={index}
        style={{
          fontWeight: run.bold ? 700 : undefined,
          fontStyle: run.italic ? 'italic' : undefined,
          textDecoration: run.underline ? 'underline' : undefined,
          fontSize: sized((run.size ?? size) * scale, width),
          color: run.color,
        }}
      >
        {run.text}
      </span>
    ),
  );
}

/**
 * The words of a shape: list items together in a list, other paragraphs on their own.
 *
 * @param {{ shape: import('./parsePresentation.js').TextShape, width: number }} props
 */
function Words({ shape, width }) {
  const size = DEFAULT_SIZE[shape.role];
  const paragraphs = shape.paragraphs.filter((paragraph) => paragraph.runs.length > 0);
  /** @type {Array<Paragraph[]>} */
  const groups = [];
  for (const paragraph of paragraphs) {
    const last = groups.at(-1);
    if (last && last[0]?.bullet === paragraph.bullet && paragraph.bullet) last.push(paragraph);
    else groups.push([paragraph]);
  }
  const style = (/** @type {Paragraph} */ paragraph) => ({
    textAlign: paragraph.align,
    marginLeft: paragraph.level ? `${paragraph.level * 1.5}em` : undefined,
  });
  return groups.map((group, index) =>
    group[0]?.bullet ? (
      <ul key={index} className={styles.list}>
        {group.map((paragraph, at) => (
          <li key={at} style={style(paragraph)}>
            <Runs paragraph={paragraph} size={size} scale={shape.scale} width={width} />
          </li>
        ))}
      </ul>
    ) : (
      <div key={index}>
        {group.map((paragraph, at) => (
          <p key={at} className={styles.paragraph} style={style(paragraph)}>
            <Runs paragraph={paragraph} size={size} scale={shape.scale} width={width} />
          </p>
        ))}
      </div>
    ),
  );
}

/**
 * One slide: its text, tables and pictures placed as they are in the file, scaled to the width they
 * are given.
 *
 * @param {{ slide: Slide, width: number, height: number }} props
 */
export function SlideView({ slide, width, height }) {
  return (
    <div
      className={styles.slide}
      style={{ aspectRatio: `${width} / ${height}`, background: slide.background }}
    >
      {slide.shapes.map((shape, index) => {
        const where = place(shape.box, width, height);
        if (shape.kind === 'picture') {
          return shape.src ? (
            <img
              key={index}
              className={styles.picture}
              style={where}
              src={shape.src}
              alt={shape.alt}
            />
          ) : null;
        }
        if (shape.kind === 'table') {
          return (
            <div key={index} className={styles.shape} style={where}>
              <table className={styles.table} style={{ fontSize: sized(14, width) }}>
                <tbody>
                  {shape.rows.map((row, at) => (
                    <tr key={at}>
                      {row.map((cell, column) =>
                        cell.covered ? null : (
                          <td
                            key={column}
                            colSpan={cell.colSpan > 1 ? cell.colSpan : undefined}
                            rowSpan={cell.rowSpan > 1 ? cell.rowSpan : undefined}
                          >
                            {cell.text}
                          </td>
                        ),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return (
          <div
            key={index}
            className={styles.shape}
            style={{
              ...where,
              background: shape.fill,
              justifyContent: { start: 'flex-start', center: 'center', end: 'flex-end' }[
                shape.anchor
              ],
            }}
          >
            {shape.role === 'title' ? (
              <h2 className={styles.title}>
                {shape.paragraphs
                  .filter((paragraph) => paragraph.runs.length > 0)
                  .map((paragraph, at) => (
                    <Fragment key={at}>
                      {at > 0 && <br />}
                      <Runs
                        paragraph={paragraph}
                        size={DEFAULT_SIZE.title}
                        scale={shape.scale}
                        width={width}
                      />
                    </Fragment>
                  ))}
              </h2>
            ) : (
              <Words shape={shape} width={width} />
            )}
          </div>
        );
      })}
    </div>
  );
}
