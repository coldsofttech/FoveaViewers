import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { axe } from 'vitest-axe';
import JSZip from 'jszip';
import { WordViewer } from './WordViewer.jsx';

const NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const PIXEL =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/** A small `.docx`: a heading, a paragraph with a link, a table, a picture and an unknown style. */
async function docxFile() {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Default Extension="png" ContentType="image/png"/>' +
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
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.com/next" TargetMode="External"/>' +
      '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/pixel.png"/></Relationships>',
  );
  zip.file('word/media/pixel.png', PIXEL, { base64: true });
  zip.file(
    'word/styles.xml',
    `<?xml version="1.0" encoding="UTF-8"?><w:styles ${NS}>` +
      '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style></w:styles>',
  );
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8"?><w:document ${NS} xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>` +
      '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Quarterly report</w:t></w:r></w:p>' +
      '<w:p><w:r><w:t xml:space="preserve">Revenue grew. </w:t></w:r><w:hyperlink r:id="rId2"><w:r><w:t>Read more</w:t></w:r></w:hyperlink></w:p>' +
      '<w:p><w:pPr><w:pStyle w:val="Mystery"/></w:pPr><w:r><w:t>Odd style</w:t></w:r></w:p>' +
      '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Cell A</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Cell B</w:t></w:r></w:p></w:tc></w:tr></w:tbl>' +
      '<w:p><w:r><w:drawing><wp:inline><wp:extent cx="9525" cy="9525"/><wp:docPr id="1" name="Picture 1" descr="A dot"/>' +
      '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:blipFill><a:blip r:embed="rId3"/></pic:blipFill></pic:pic></a:graphicData></a:graphic>' +
      '</wp:inline></w:drawing></w:r></w:p>' +
      '</w:body></w:document>',
  );
  const buffer = await zip.generateAsync({ type: 'arraybuffer' });
  return new File([buffer], 'report.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

/**
 * jsdom does not load a frame's `srcdoc` itself. Put the page in, as a browser would, and say the
 * frame has loaded.
 */
async function pageOf(title = 'Word document') {
  const frame = await screen.findByTitle(title);
  await waitFor(() => expect(frame.getAttribute('srcdoc')).toBeTruthy());
  const doc = frame.contentDocument;
  doc.open();
  doc.write(frame.getAttribute('srcdoc'));
  doc.close();
  fireEvent.load(frame);
  return { frame, doc };
}

describe('WordViewer', () => {
  it('shows the document in a locked-down frame, with no accessibility violations', async () => {
    const { container } = render(<WordViewer source={await docxFile()} />);
    const { frame, doc } = await pageOf();
    expect(frame.getAttribute('sandbox')).toBe('allow-same-origin');
    expect(doc.querySelector('h1')).toHaveTextContent('Quarterly report');
    expect(doc.querySelector('table')).toHaveTextContent('Cell A');
    expect(doc.querySelector('script')).toBeNull();
    expect(await axe(container, { iframes: false })).toHaveNoViolations();
  });

  it('shows a picture in the document without the web', async () => {
    render(<WordViewer source={await docxFile()} />);
    const { doc } = await pageOf();
    const picture = doc.querySelector('img');
    expect(picture.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
    expect(picture).toHaveAttribute('alt', 'A dot');
  });

  it('does nothing when a link is clicked, unless asked to open it', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<WordViewer source={await docxFile()} />);
    const { doc } = await pageOf();
    const link = doc.querySelector('a');
    expect(link).toHaveAttribute('href', 'https://example.com/next');
    expect(fireEvent.click(link)).toBe(false);
    expect(open).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it('opens a link in a new window with links="window"', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<WordViewer source={await docxFile()} links="window" />);
    const { doc } = await pageOf();
    fireEvent.click(doc.querySelector('a'));
    expect(open).toHaveBeenCalledWith('https://example.com/next', '_blank', 'noopener,noreferrer');
    open.mockRestore();
  });

  it('marks the target words', async () => {
    const onMarked = vi.fn();
    render(
      <WordViewer
        source={await docxFile()}
        target={{ matched: 'Revenue grew' }}
        onMarked={onMarked}
      />,
    );
    const { doc } = await pageOf();
    await waitFor(() => expect(doc.querySelector('mark')).not.toBeNull());
    expect(onMarked).toHaveBeenLastCalledWith(true);
  });

  it('reports what could not be shown as it is in the document', async () => {
    const onReady = vi.fn();
    const onWarnings = vi.fn();
    render(<WordViewer source={await docxFile()} onReady={onReady} onWarnings={onWarnings} />);
    await waitFor(() => expect(onReady).toHaveBeenCalled());
    expect(onReady.mock.calls[0][0].messages.length).toBeGreaterThan(0);
    expect(onWarnings).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ type: 'warning' })]),
    );
  });

  it('reports a file that cannot be read', async () => {
    const onError = vi.fn();
    render(<WordViewer source={new File(['not a document'], 'x.docx')} onError={onError} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be read');
    expect(onError).toHaveBeenCalled();
  });
});
