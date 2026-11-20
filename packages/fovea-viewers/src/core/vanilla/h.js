/**
 * @typedef {string | number | Node | null | undefined | false | HTMLChildren[]} HTMLChildren
 */

/**
 * Makes the `h` function for a document. A viewer gets one for the document of its container
 * (`container.ownerDocument`) instead of using the global `document`, so it also works inside a
 * shadow root or another window.
 *
 * `h(tag, attributes, ...children)` builds an element. It never parses markup: strings become text,
 * so nothing a file contains can become an element.
 *
 * - `attributes` are set with `setAttribute`; `true` sets an empty attribute, and `false`, `null`
 *   and `undefined` leave it out.
 * - An attribute named `on` plus an event name (`onclick`, `onkeydown`) with a function adds that
 *   event listener.
 * - A child is text (`string`, `number`), a node, an array of these, or nothing (`null`,
 *   `undefined`, `false`).
 *
 * @param {Document} doc
 * @returns {(tag: string, attributes?: Record<string, unknown> | null, ...children: HTMLChildren[]) => HTMLElement}
 */
export function createH(doc) {
  /** @param {HTMLElement} parent @param {HTMLChildren} child */
  const append = (parent, child) => {
    if (child === null || child === undefined || child === false) return;
    if (Array.isArray(child)) {
      for (const item of child) append(parent, item);
    } else if (typeof child === 'string' || typeof child === 'number') {
      parent.append(doc.createTextNode(String(child)));
    } else {
      parent.append(child);
    }
  };

  return (tag, attributes, ...children) => {
    const element = doc.createElement(tag);
    for (const [name, value] of Object.entries(attributes ?? {})) {
      if (value === null || value === undefined || value === false) continue;
      if (name.startsWith('on') && typeof value === 'function') {
        element.addEventListener(name.slice(2).toLowerCase(), /** @type {EventListener} */ (value));
      } else {
        element.setAttribute(name, value === true ? '' : String(value));
      }
    }
    for (const child of children) append(element, child);
    return element;
  };
}
