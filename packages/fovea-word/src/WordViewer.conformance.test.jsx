import { describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import { describeConformance } from '../../../test-support/conformance.js';
import {
  elementAdapter,
  reactComponentAdapter,
  vanillaAdapter,
} from '../../../test-support/adapters.jsx';
import { WordViewer } from './WordViewer.jsx';
import { defineWordElement } from './element.js';
import { createWordViewer } from './vanilla/index.js';

const NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

/** A small `.docx`: a heading, and a paragraph with a link and an unknown style. */
async function docx() {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '</Types>',
  );
  zip.file(
    '_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  );
  zip.file(
    'word/_rels/document.xml.rels',
    '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.com/next" TargetMode="External"/></Relationships>',
  );
  zip.file(
    'word/styles.xml',
    `<?xml version="1.0" encoding="UTF-8"?><w:styles ${NS}><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style></w:styles>`,
  );
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8"?><w:document ${NS}><w:body>` +
      '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Quarterly report</w:t></w:r></w:p>' +
      '<w:p><w:r><w:t xml:space="preserve">Revenue grew. </w:t></w:r><w:hyperlink r:id="rId2"><w:r><w:t>Read more</w:t></w:r></w:hyperlink></w:p>' +
      '<w:p><w:pPr><w:pStyle w:val="Mystery"/></w:pPr><w:r><w:t>Odd style</w:t></w:r></w:p>' +
      '</w:body></w:document>',
  );
  return zip.generateAsync({ type: 'uint8array' });
}
const sample = await docx();

/** jsdom does not load a frame's `srcdoc`, so the test puts the page in and says it has loaded. */
function settleFrame(frame) {
  const srcdoc = frame.getAttribute('srcdoc');
  if (!srcdoc || frame.dataset.settled === srcdoc) return;
  frame.dataset.settled = srcdoc;
  const doc = frame.contentDocument;
  doc.open();
  doc.write(srcdoc);
  doc.close();
  frame.dispatchEvent(new Event('load'));
}
const settle = (root) => {
  const frame = root.querySelector('iframe');
  if (frame) settleFrame(frame);
};

describeConformance('word', {
  text: sample,
  settle,
  axeOptions: { iframes: false },
  hasTheme: false,
  textOf: (root) => root.querySelector('iframe')?.getAttribute('srcdoc') ?? '',
  shows: (root) =>
    expect(root.querySelector('iframe').getAttribute('srcdoc')).toContain('Quarterly report'),
  adapters: [
    vanillaAdapter(createWordViewer),
    elementAdapter('fovea-word', defineWordElement),
    reactComponentAdapter(WordViewer),
  ],
});

describe('createWordViewer', () => {
  it('reports what could not be shown, in onReady and in onWarnings', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const onReady = vi.fn();
    const onWarnings = vi.fn();
    const viewer = createWordViewer(host, { source: new Blob([sample]), onReady, onWarnings });
    await vi.waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));
    expect(onReady.mock.calls[0][0].messages.length).toBeGreaterThan(0);
    expect(onWarnings).toHaveBeenCalledWith(onReady.mock.calls[0][0].messages);
    viewer.destroy();
    host.remove();
  });

  it('marks the target in the frame, and reports a file that is not a document', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const onMarked = vi.fn();
    const onError = vi.fn();
    const viewer = createWordViewer(host, {
      source: new Blob([sample]),
      target: { matched: 'Revenue grew' },
      onMarked,
    });
    await vi.waitFor(() => {
      settle(viewer.element);
      expect(onMarked).toHaveBeenLastCalledWith(true);
    });
    expect(
      viewer.element.querySelector('iframe').contentDocument.querySelector('mark'),
    ).toHaveTextContent('Revenue grew');
    viewer.update({ source: new Blob(['not a zip']), onError });
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(viewer.element.querySelector('[role="alert"]')).toHaveTextContent('could not be read');
    viewer.destroy();
    host.remove();
  });
});
