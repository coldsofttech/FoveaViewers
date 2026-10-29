/**
 * A web address (`http` or `https`) read from a feed, in its full form, or an empty string when the
 * value is anything else: another kind of address, a relative one, or one that holds spaces, quotes
 * or angle brackets. A feed is untrusted, so only an address that is clearly one is let through.
 *
 * @param {string | null | undefined} value
 * @returns {string}
 */
export function webUrl(value) {
  const text = (value ?? '').trim();
  if (!text || /[<>"'`\s]/.test(text)) return '';
  try {
    const url = new URL(text);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}
