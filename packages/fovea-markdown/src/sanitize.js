import DOMPurify from 'dompurify';

/** @type {ReturnType<typeof DOMPurify> | null} */
let purify = null;

/** A DOMPurify of our own, made on first use so importing the package touches no browser API. */
function instance() {
  if (!purify) {
    purify = DOMPurify(window);
    // Links that leave the page open in a new window, without access to this one.
    purify.addHook('afterSanitizeAttributes', (node) => {
      const href = node.nodeName === 'A' ? node.getAttribute('href') : null;
      if (href && !href.startsWith('#')) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
    });
  }
  return purify;
}

/**
 * Cleans HTML made from a Markdown file: scripts, event handlers, styles and unsafe addresses are
 * removed. This is a second line of defence, as the Markdown renderer already escapes raw HTML.
 *
 * @param {string} html
 * @returns {DocumentFragment}
 */
export function sanitizeToFragment(html) {
  return instance().sanitize(html, { RETURN_DOM_FRAGMENT: true, FORBID_ATTR: ['style'] });
}
