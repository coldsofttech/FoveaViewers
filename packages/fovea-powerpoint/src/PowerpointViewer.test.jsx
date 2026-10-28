import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import JSZip from 'jszip';
import { PowerpointViewer } from './PowerpointViewer.jsx';
import { resolvePart } from './parsePresentation.js';

const P = 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const A = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';
const R = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PIXEL =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const rels = (items) =>
  `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items
    .map(
      ([id, type, target]) => `<Relationship Id="${id}" Type="${REL}/${type}" Target="${target}"/>`,
    )
    .join('')}</Relationships>`;

const xfrm = (x, y, w, h) =>
  `<a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm>`;

const text = (paragraphs) =>
  `<p:txBody><a:bodyPr/><a:p>${paragraphs.join('</a:p><a:p>')}</a:p></p:txBody>`;
const run = (t, props = '') => `<a:r><a:rPr lang="en-US"${props}/><a:t>${t}</a:t></a:r>`;

/** A placeholder shape that takes its place from the layout. */
const placeholder = (id, name, ph, body) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr/><p:nvPr><p:ph ${ph}/></p:nvPr></p:nvSpPr><p:spPr/>${body}</p:sp>`;

const tree = (shapes) =>
  `<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${shapes}</p:spTree></p:cSld>`;

const cell = (t, attrs = '') =>
  `<a:tc${attrs}><a:txBody><a:bodyPr/><a:p><a:r><a:t>${t}</a:t></a:r></a:p></a:txBody></a:tc>`;

/**
 * A small `.pptx`: a 16:9 deck of two slides. The first has a title and bullets that take their place
 * from the layout, and speaker notes. The second has a picture in a group and a table.
 *
 * @returns {Promise<ArrayBuffer>}
 */
async function makePptx() {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>' +
      '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>' +
      '</Types>',
  );
  zip.file('_rels/.rels', rels([['rId1', 'officeDocument', 'ppt/presentation.xml']]));
  zip.file(
    'ppt/presentation.xml',
    `<?xml version="1.0" encoding="UTF-8"?><p:presentation ${P} ${A} ${R}><p:sldIdLst><p:sldId id="256" r:id="rId1"/><p:sldId id="257" r:id="rId2"/></p:sldIdLst><p:sldSz cx="9144000" cy="5143500"/></p:presentation>`,
  );
  zip.file(
    'ppt/_rels/presentation.xml.rels',
    rels([
      ['rId1', 'slide', 'slides/slide1.xml'],
      ['rId2', 'slide', 'slides/slide2.xml'],
    ]),
  );

  zip.file(
    'ppt/slideMasters/slideMaster1.xml',
    `<?xml version="1.0" encoding="UTF-8"?><p:sldMaster ${P} ${A} ${R}>${tree('')}</p:sldMaster>`,
  );
  zip.file(
    'ppt/slideLayouts/slideLayout1.xml',
    `<?xml version="1.0" encoding="UTF-8"?><p:sldLayout ${P} ${A} ${R}>${tree(
      `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr>${xfrm(457200, 228600, 8229600, 857250)}</p:spPr></p:sp>` +
        `<p:sp><p:nvSpPr><p:cNvPr id="3" name="Body"/><p:cNvSpPr/><p:nvPr><p:ph idx="1"/></p:nvPr></p:nvSpPr><p:spPr>${xfrm(457200, 1200150, 8229600, 3394472)}</p:spPr></p:sp>`,
    )}</p:sldLayout>`,
  );
  zip.file(
    'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
    rels([['rId1', 'slideMaster', '../slideMasters/slideMaster1.xml']]),
  );

  zip.file(
    'ppt/slides/slide1.xml',
    `<?xml version="1.0" encoding="UTF-8"?><p:sld ${P} ${A} ${R}>${tree(
      placeholder(2, 'Title 1', 'type="title"', text([run('Launch plan')])) +
        placeholder(
          3,
          'Content 2',
          'idx="1"',
          text([
            `<a:pPr/>${run('First, ship', ' b="1"')}`,
            `<a:pPr lvl="1"/>${run('Then measure')}`,
            `<a:pPr><a:buNone/></a:pPr>${run('Plain closing line')}`,
          ]),
        ),
    )}</p:sld>`,
  );
  zip.file(
    'ppt/slides/_rels/slide1.xml.rels',
    rels([
      ['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'],
      ['rId2', 'notesSlide', '../notesSlides/notesSlide1.xml'],
    ]),
  );
  zip.file(
    'ppt/notesSlides/notesSlide1.xml',
    `<?xml version="1.0" encoding="UTF-8"?><p:notes ${P} ${A} ${R}>${tree(
      placeholder(2, 'Notes', 'type="body" idx="1"', text([run('Remember to thank the team')])),
    )}</p:notes>`,
  );

  zip.file(
    'ppt/slides/slide2.xml',
    `<?xml version="1.0" encoding="UTF-8"?><p:sld ${P} ${A} ${R}>${tree(
      placeholder(2, 'Title 1', 'type="title"', text([run('Results')])) +
        `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="4" name="Group"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="457200" y="1200150"/><a:ext cx="2000000" cy="2000000"/><a:chOff x="0" y="0"/><a:chExt cx="1000000" cy="1000000"/></a:xfrm></p:grpSpPr>` +
        `<p:pic><p:nvPicPr><p:cNvPr id="5" name="Picture" descr="A single dot"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/></p:blipFill><p:spPr>${xfrm(500000, 500000, 500000, 500000)}</p:spPr></p:pic></p:grpSp>` +
        `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="6" name="Table"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="3200400" y="1200150"/><a:ext cx="5000000" cy="1200000"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblGrid/>` +
        `<a:tr>${cell('Region')}${cell('Sales')}</a:tr><a:tr>${cell('North')}${cell('120')}</a:tr><a:tr>${cell('South, merged', ' gridSpan="2"')}${cell('', ' hMerge="1"')}</a:tr>` +
        `</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`,
    )}</p:sld>`,
  );
  zip.file(
    'ppt/slides/_rels/slide2.xml.rels',
    rels([
      ['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'],
      ['rId2', 'image', '../media/dot.png'],
    ]),
  );
  zip.file('ppt/media/dot.png', PIXEL, { base64: true });

  return zip.generateAsync({ type: 'arraybuffer' });
}

const file = async () =>
  new File([await makePptx()], 'deck.pptx', {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  });

describe('resolvePart', () => {
  it('finds a part from the part that refers to it', () => {
    expect(resolvePart('ppt/slides/slide1.xml', '../media/a.png')).toBe('ppt/media/a.png');
    expect(resolvePart('ppt/presentation.xml', 'slides/slide1.xml')).toBe('ppt/slides/slide1.xml');
    expect(resolvePart('ppt/slides/slide1.xml', '/ppt/media/a.png')).toBe('ppt/media/a.png');
  });
});

describe('PowerpointViewer', () => {
  it('shows the first slide with its title, list and speaker notes', async () => {
    render(<PowerpointViewer source={await file()} />);
    const stage = await screen.findByRole('group', { name: /slide 1 of 2: Launch plan/i });
    expect(within(stage).getByRole('heading', { name: 'Launch plan' })).toBeInTheDocument();
    const items = within(stage).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(['First, ship', 'Then measure']);
    expect(items[0].querySelector('span').style.fontWeight).toBe('700');
    // A paragraph that turns its bullet off is not a list item.
    expect(within(stage).getByText('Plain closing line').closest('li')).toBeNull();
    expect(screen.getByRole('complementary', { name: 'Speaker notes' })).toHaveTextContent(
      'Remember to thank the team',
    );
    expect(screen.getByRole('status')).toHaveTextContent('Slide 1 of 2');
  });

  it('places shapes that take their place from the layout', async () => {
    render(<PowerpointViewer source={await file()} thumbnails={false} />);
    const stage = await screen.findByRole('group', { name: /slide 1/i });
    const title = within(stage).getByRole('heading').parentElement;
    expect(title.style.left).toBe(`${(457200 / 9144000) * 100}%`);
    expect(title.style.top).toBe(`${(228600 / 5143500) * 100}%`);
  });

  it('moves between slides with the buttons, the thumbnails and the keys', async () => {
    const user = userEvent.setup();
    const onSlideChange = vi.fn();
    render(<PowerpointViewer source={await file()} onSlideChange={onSlideChange} />);
    await screen.findByRole('group', { name: /slide 1/i });
    expect(screen.getByRole('button', { name: 'Previous slide' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Next slide' }));
    expect(
      await screen.findByRole('group', { name: /slide 2 of 2: Results/i }),
    ).toBeInTheDocument();
    expect(onSlideChange).toHaveBeenLastCalledWith(1);
    expect(screen.getByRole('button', { name: 'Next slide' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Slide 1: Launch plan' }));
    expect(screen.getByRole('group', { name: /slide 1 of 2/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Slide 1: Launch plan' })).toHaveAttribute(
      'aria-current',
      'true',
    );

    screen.getByRole('group', { name: /slide 1/i }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('group', { name: /slide 2/i })).toBeInTheDocument();
    await user.keyboard('{Home}');
    expect(screen.getByRole('group', { name: /slide 1/i })).toBeInTheDocument();
    await user.keyboard('{End}');
    expect(screen.getByRole('group', { name: /slide 2/i })).toBeInTheDocument();
  });

  it('shows a picture inside a group, and a table with merged cells', async () => {
    render(<PowerpointViewer source={await file()} slide={1} thumbnails={false} />);
    const stage = await screen.findByRole('group', { name: /slide 2/i });
    const picture = within(stage).getByRole('img', { name: 'A single dot' });
    expect(picture.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
    // The group maps its own coordinates (0..1,000,000) onto its box on the slide.
    expect(picture.style.left).toBe(`${((457200 + 500000 * 2) / 9144000) * 100}%`);
    expect(picture.style.width).toBe(`${((500000 * 2) / 9144000) * 100}%`);
    const table = within(stage).getByRole('table');
    expect(within(table).getByText('South, merged')).toHaveAttribute('colspan', '2');
    expect(within(table).getAllByRole('row').at(2).querySelectorAll('td')).toHaveLength(1);
  });

  it('hides the notes and the thumbnails when asked', async () => {
    render(<PowerpointViewer source={await file()} showNotes={false} thumbnails={false} />);
    await screen.findByRole('group', { name: /slide 1/i });
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(screen.queryByRole('list', { name: /slides/i })).toBeNull();
  });

  it('lets the host choose the slide', async () => {
    render(<PowerpointViewer source={await file()} slide={1} />);
    expect(await screen.findByRole('group', { name: /slide 2 of 2/i })).toBeInTheDocument();
  });

  it('finds the target on another slide, shows it and marks it', async () => {
    const onMarked = vi.fn();
    const { container } = render(
      <PowerpointViewer
        source={await file()}
        thumbnails={false}
        target={{ matched: 'South, merged' }}
        onMarked={onMarked}
      />,
    );
    await waitFor(() => expect(container.querySelector('mark')).not.toBeNull());
    expect(screen.getByRole('group', { name: /slide 2 of 2/i })).toBeInTheDocument();
    expect(onMarked).toHaveBeenLastCalledWith(true);
  });

  it('finds a target in the speaker notes only when they are shown', async () => {
    const onMarked = vi.fn();
    const deck = await file();
    const target = { matched: 'thank the team' };
    const { container, rerender } = render(
      <PowerpointViewer
        source={deck}
        thumbnails={false}
        showNotes={false}
        target={target}
        onMarked={onMarked}
      />,
    );
    await screen.findByRole('group', { name: /slide 1/i });
    await waitFor(() => expect(onMarked).toHaveBeenLastCalledWith(false));
    expect(container.querySelector('mark')).toBeNull();
    rerender(
      <PowerpointViewer source={deck} thumbnails={false} target={target} onMarked={onMarked} />,
    );
    await waitFor(() => expect(container.querySelector('mark')).not.toBeNull());
    expect(onMarked).toHaveBeenLastCalledWith(true);
  });

  it('calls onReady with the slide count and has no accessibility violations', async () => {
    const onReady = vi.fn();
    const { container } = render(<PowerpointViewer source={await file()} onReady={onReady} />);
    await screen.findByRole('group', { name: /slide 1/i });
    expect(onReady).toHaveBeenCalledWith({ slideCount: 2 });
    expect(await axe(container)).toHaveNoViolations();
  });

  it('reports a file that cannot be read', async () => {
    const onError = vi.fn();
    render(<PowerpointViewer source={new File(['not a deck'], 'x.pptx')} onError={onError} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be read');
    expect(onError).toHaveBeenCalled();
  });
});
