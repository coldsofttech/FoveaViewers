/**
 * Saves an attachment, by way of an address that is made for the click and let go of after.
 *
 * @param {Document} doc The document to make the link in.
 * @param {import('./parse.js').EmailAttachment} attachment
 */
export function saveAttachment(doc, attachment) {
  const url = URL.createObjectURL(attachment.blob);
  const link = doc.createElement('a');
  link.href = url;
  link.download = attachment.filename;
  link.click();
  URL.revokeObjectURL(url);
}
