import DOMPurify from 'dompurify';

/** @type {ReturnType<typeof DOMPurify> | null} */
let purify = null;
/** Whether the hook below should keep pictures. DOMPurify hooks cannot take options. */
let keepImages = false;

const WEB = /^https?:\/\//i;

/** A DOMPurify of our own, made on first use so importing the package touches no browser API. */
function cleaner() {
  if (!purify) {
    purify = DOMPurify(window);
    purify.addHook('afterSanitizeAttributes', (node) => {
      if (node.nodeName === 'A') {
        const href = node.getAttribute('href');
        if (href && !href.startsWith('#')) {
          node.setAttribute('target', '_blank');
          node.setAttribute('rel', 'noopener noreferrer');
        }
      } else if (node.nodeName === 'IMG') {
        // A picture is only kept if the host allowed pictures, and only from the web or embedded.
        const src = node.getAttribute('src') ?? '';
        if (!keepImages || !(WEB.test(src) || /^data:image\//i.test(src))) {
          node.remove();
          return;
        }
        node.setAttribute('loading', 'lazy');
        node.setAttribute('referrerpolicy', 'no-referrer');
        node.removeAttribute('srcset');
      }
    });
  }
  return purify;
}

/**
 * Cleans the HTML of a feed entry: scripts, event handlers, styles, frames, forms and media are
 * removed, links open in a new window without access to the page, and pictures stay only if
 * `allowImages` is set.
 *
 * @param {string} html
 * @param {boolean} allowImages
 * @returns {DocumentFragment}
 */
export function sanitizeToFragment(html, allowImages) {
  keepImages = allowImages;
  return cleaner().sanitize(html, {
    RETURN_DOM_FRAGMENT: true,
    FORBID_ATTR: ['style'],
    FORBID_TAGS: [
      'style',
      'form',
      'input',
      'button',
      'select',
      'textarea',
      'iframe',
      'frame',
      'object',
      'embed',
      'video',
      'audio',
      'source',
      'picture',
      'svg',
      'math',
      'link',
      'meta',
      'base',
    ],
  });
}
