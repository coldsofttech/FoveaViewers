import PostalMime from 'postal-mime';

/**
 * @typedef {object} EmailAddress
 * @property {string} name
 * @property {string} address
 */

/**
 * @typedef {object} EmailAttachment
 * @property {string} filename
 * @property {string} mimeType
 * @property {number} size In bytes.
 * @property {Blob} blob
 */

/**
 * @typedef {object} ParsedEmail
 * @property {string} subject
 * @property {EmailAddress | null} from
 * @property {EmailAddress[]} to
 * @property {EmailAddress[]} cc
 * @property {EmailAddress[]} bcc
 * @property {Date | null} date
 * @property {string | null} html The message markup, with `cid:` pictures filled in.
 * @property {string | null} text The message as plain text.
 * @property {EmailAttachment[]} attachments The files attached, not counting embedded pictures.
 * @property {{ key: string, value: string }[]} headers Every header, as in the message.
 */

/** @param {ArrayBuffer} buffer */
function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/** @param {any} address */
const person = (address) => ({ name: address?.name ?? '', address: address?.address ?? '' });

/**
 * Reads an `.eml` message. Pictures the markup embeds by `cid:` are put in as `data:` addresses, so
 * they show without the web; the other attachments are listed.
 *
 * @param {Blob | ArrayBuffer} source
 * @returns {Promise<ParsedEmail>}
 */
export async function parseEmail(source) {
  const email = await PostalMime.parse(source);
  let html = email.html ?? null;

  /** @type {EmailAttachment[]} */
  const attachments = [];
  for (const part of email.attachments ?? []) {
    const content = /** @type {ArrayBuffer} */ (part.content);
    const cid = part.contentId?.replace(/^<|>$/g, '');
    if (html && cid && html.includes(`cid:${cid}`)) {
      html = html.split(`cid:${cid}`).join(`data:${part.mimeType};base64,${toBase64(content)}`);
      continue;
    }
    attachments.push({
      filename: part.filename || 'attachment',
      mimeType: part.mimeType,
      size: content.byteLength,
      blob: new Blob([content], { type: part.mimeType }),
    });
  }

  return {
    subject: email.subject ?? '',
    from: email.from ? person(email.from) : null,
    to: (email.to ?? []).map(person),
    cc: (email.cc ?? []).map(person),
    bcc: (email.bcc ?? []).map(person),
    date: email.date ? new Date(email.date) : null,
    html,
    text: email.text ?? null,
    attachments,
    headers: (email.headers ?? []).map(({ key, value }) => ({ key, value })),
  };
}
