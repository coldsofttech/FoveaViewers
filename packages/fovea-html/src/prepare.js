import DOMPurify from 'dompurify';

/**
 * @typedef {object} PrepareOptions
 * @property {boolean} [allowImages] Let http(s) pictures load.
 * @property {boolean} [allowStyles] Let http(s) stylesheets and fonts load.
 * @property {boolean} [allowScripts] Keep the page's inline scripts.
 * @property {boolean} [stripLinks] Take the address out of every link. Used when scripts are on, as
 *   a click cannot then be intercepted.
 * @property {string} [base] The address the page came from, so its relative addresses resolve.
 */

/** @type {ReturnType<typeof DOMPurify> | null} */
let purify = null;

/** A DOMPurify of our own, made on first use so importing the package touches no browser API. */
function cleaner() {
  if (!purify) {
    purify = DOMPurify(window);
    // A stylesheet link is the one `<link>` that is kept, and only to an http(s) address.
    purify.addHook('uponSanitizeElement', (node, data) => {
      if (data.tagName !== 'link') return;
      const element = /** @type {Element} */ (node);
      const rel = (element.getAttribute('rel') ?? '').toLowerCase();
      if (
        !/(^|\s)stylesheet(\s|$)/.test(rel) ||
        !/^https?:/i.test(element.getAttribute('href') ?? '')
      ) {
        element.remove();
      }
    });
  }
  return purify;
}

/**
 * Puts markup at the start of a page's `<head>`, making a head when the page has none.
 *
 * @param {string} html
 * @param {string} snippet
 * @returns {string}
 */
export function inHead(html, snippet) {
  const head = /<head\b[^>]*>/i.exec(html);
  if (head) {
    const end = head.index + head[0].length;
    return html.slice(0, end) + snippet + html.slice(end);
  }
  const root = /<html\b[^>]*>/i.exec(html) ?? /^\s*<!doctype[^>]*>/i.exec(html);
  if (root) {
    const end = root.index + root[0].length;
    return `${html.slice(0, end)}<head>${snippet}</head>${html.slice(end)}`;
  }
  return `<head>${snippet}</head>${html}`;
}

/** @param {string} value */
const escapeAttribute = (value) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

/**
 * The origin of an address, or `null` when it is not an http(s) one.
 *
 * @param {string | undefined} address
 * @returns {string | null}
 */
function originOf(address) {
  if (!address) return null;
  try {
    const url = new URL(address);
    return /^https?:$/.test(url.protocol) ? url.origin : null;
  } catch {
    return null;
  }
}

/**
 * The policy a page is shown under: nothing loads from anywhere but the file itself, unless the
 * host allowed pictures or styles, and scripts run only if the host allowed them. A script that
 * runs still cannot ask the network for anything.
 *
 * @param {PrepareOptions} [options]
 * @returns {string}
 */
export function policy({
  allowImages = false,
  allowStyles = false,
  allowScripts = false,
  base,
} = {}) {
  const web = ' http: https:';
  return [
    "default-src 'none'",
    `img-src data:${allowImages ? web : ''}`,
    `style-src 'unsafe-inline'${allowStyles ? web : ''}`,
    `font-src data:${allowStyles ? web : ''}`,
    ...(allowScripts ? ["script-src 'unsafe-inline'"] : []),
    "form-action 'none'",
    `base-uri ${originOf(base) ?? "'none'"}`,
  ].join('; ');
}

/**
 * A page's markup with the address taken out of every link, so they go nowhere.
 *
 * @param {string} html
 * @returns {string}
 */
function withoutLinkAddresses(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  for (const link of doc.querySelectorAll('a[href], area[href]')) link.removeAttribute('href');
  const doctype = doc.doctype ? `<!DOCTYPE ${doc.doctype.name}>` : '';
  return doctype + doc.documentElement.outerHTML;
}

/**
 * A page's markup ready for the frame. Nothing is let in by default: the markup is cleaned (scripts,
 * event handlers, frames, objects and `<base>` are taken out), a refresh to another address is
 * removed, and a policy is added so the page cannot load pictures, styles or fonts from the web.
 * The host opens up each of these on purpose.
 *
 * With scripts allowed the markup is not cleaned, as that would remove them: the frame's sandbox
 * and the policy are what keep the page in.
 *
 * @param {string} html The page's markup.
 * @param {PrepareOptions} [options]
 * @returns {string}
 */
export function prepare(html, options = {}) {
  const { allowStyles = false, allowScripts = false, stripLinks = false, base } = options;
  let page = html.replace(/<meta\b[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*>/gi, '');

  if (allowScripts) {
    page = page.replace(/<base\b[^>]*>/gi, '');
    if (stripLinks) page = withoutLinkAddresses(page);
  } else {
    page = cleaner().sanitize(page, {
      WHOLE_DOCUMENT: true,
      // The doctype is kept, as without it the page is drawn in quirks mode.
      ADD_TAGS: allowStyles ? ['!doctype', 'link'] : ['!doctype'],
      FORBID_TAGS: ['base', 'meta', 'iframe', 'frame', 'frameset', 'object', 'embed'],
    });
  }

  // Relative addresses (pictures, stylesheets, links) resolve against where the page came from.
  const where = originOf(base) ? base : undefined;
  const head =
    `<meta http-equiv="Content-Security-Policy" content="${policy({ ...options, base: where })}">` +
    (where ? `<base href="${escapeAttribute(where)}">` : '');
  return inHead(page, head);
}
