import { beforeEach, describe, expect, it, vi } from 'vitest';
import { describeConformance } from '../../../test-support/conformance.js';
import { fakePdfjs } from '../../../test-support/fake-pdfjs.js';
import {
  elementAdapter,
  reactComponentAdapter,
  vanillaAdapter,
} from '../../../test-support/adapters.jsx';
import { PdfViewer } from './PdfViewer.jsx';
import { definePdfElement } from './element.js';
import { loadPdfjs } from './pdfjs.js';
import { createPdfViewer } from './vanilla/index.js';

vi.mock('./pdfjs.js', () => ({ loadPdfjs: vi.fn() }));

beforeEach(() => {
  vi.mocked(loadPdfjs).mockReset();
  vi.mocked(loadPdfjs).mockResolvedValue(fakePdfjs().pdfjs);
});

describeConformance('pdf', {
  text: '%PDF-1.7 a sample',
  shows: (root) => {
    expect(root.querySelector('[data-page="1"]')).not.toBeNull();
    expect(root.querySelector('[role="toolbar"]')).not.toBeNull();
  },
  adapters: [
    vanillaAdapter(createPdfViewer),
    elementAdapter('fovea-pdf', definePdfElement),
    reactComponentAdapter(PdfViewer),
  ],
});

describe('createPdfViewer', () => {
  const open = (props, options) => {
    const fake = fakePdfjs(options);
    vi.mocked(loadPdfjs).mockResolvedValue(fake.pdfjs);
    const host = document.createElement('div');
    document.body.append(host);
    const viewer = createPdfViewer(host, { source: new Blob(['%PDF']), ...props });
    return { ...fake, host, viewer };
  };
  const scroller = (viewer) => viewer.element.querySelector('[role="region"]');
  const pages = (viewer) =>
    [...viewer.element.querySelectorAll('[data-page]')].map((p) => Number(p.dataset.page));
  const ready = (viewer) => vi.waitFor(() => expect(pages(viewer).length).toBeGreaterThan(0));

  it('draws the page with its text, and reports the page count and the page the reader is on', async () => {
    const onReady = vi.fn();
    const onPageChange = vi.fn();
    const { host, viewer } = open({ onReady, onPageChange });
    await ready(viewer);
    expect(viewer.element.querySelector('[data-page="1"]')).toHaveTextContent(
      'Alpha opens the file',
    );
    expect(onReady).toHaveBeenCalledWith({ pageCount: 3 });
    await vi.waitFor(() => expect(onPageChange).toHaveBeenCalledWith(1));
    viewer.destroy();
    host.remove();
  });

  it('zooms with the buttons and the keys, turns the pages and fits them', async () => {
    const { host, viewer } = open({});
    await ready(viewer);
    const zoom = () => viewer.element.querySelector('[role="toolbar"] > span').textContent;
    const click = (name) => viewer.element.querySelector(`[aria-label="${name}"]`).click();
    const before = zoom();
    click('Zoom in');
    expect(zoom()).not.toBe(before);
    click('Zoom out');
    expect(zoom()).toBe(before);
    const press = (key) =>
      scroller(viewer).dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
      );
    press('+');
    expect(zoom()).not.toBe(before);
    press('0');
    expect(zoom()).toBe(before);
    click('Rotate right');
    await vi.waitFor(() =>
      expect(viewer.element.querySelector('[data-page="1"]').style.width).toBe('800px'),
    );
    press('[');
    click('Fit to page');
    expect(zoom()).not.toBe('');
    viewer.destroy();
    host.remove();
  });

  it('goes to a page typed in, and to an outline item', async () => {
    const { host, viewer } = open({});
    await ready(viewer);
    const input = viewer.element.querySelector('[aria-label="Page number"]');
    input.value = '3';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(scroller(viewer).scrollTop).toBeGreaterThan(1000);
    scroller(viewer).scrollTop = 0;
    viewer.element.querySelector('[aria-label="Outline"]').click();
    const ending = [...viewer.element.querySelectorAll('nav button')].find(
      (b) => b.textContent === 'Ending',
    );
    ending.click();
    await vi.waitFor(() => expect(scroller(viewer).scrollTop).toBeGreaterThan(1000));
    viewer.element.querySelector('[aria-label="Outline"]').click();
    expect(viewer.element.querySelector('nav')).toBeNull();
    viewer.destroy();
    host.remove();
  });

  it('finds the target, scrolls to its page, marks the words and says which page', async () => {
    const onLocated = vi.fn();
    const { host, viewer } = open({ target: { matched: 'Beta is in the middle' }, onLocated });
    await vi.waitFor(() => expect(onLocated).toHaveBeenCalledWith(2));
    // The viewer scrolled to page 2. jsdom sends no scroll event for that, so send it.
    expect(scroller(viewer).scrollTop).toBeGreaterThan(0);
    scroller(viewer).dispatchEvent(new Event('scroll'));
    await vi.waitFor(() =>
      expect(viewer.element.querySelector('mark')).toHaveTextContent('Beta is in the middle'),
    );
    viewer.update({ target: { matched: 'nowhere at all' } });
    await vi.waitFor(() => expect(onLocated).toHaveBeenLastCalledWith(null));
    viewer.update({ target: undefined });
    expect(viewer.element.querySelector('mark')).toBeNull();
    viewer.destroy();
    host.remove();
  });

  it('asks for a password, says when it is wrong, and opens the PDF when it is right', async () => {
    const { host, viewer } = open({}, { locked: true });
    await vi.waitFor(() => expect(viewer.element.querySelector('form')).not.toBeNull());
    const submit = (text) => {
      viewer.element.querySelector('input[type="password"]').value = text;
      viewer.element
        .querySelector('form')
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    };
    expect(viewer.element.querySelector('form [role="status"]')).toHaveTextContent('protected');
    submit('wrong');
    await vi.waitFor(() =>
      expect(viewer.element.querySelector('form [role="alert"]')).toHaveTextContent('not right'),
    );
    submit('secret');
    await ready(viewer);
    expect(viewer.element.querySelector('form')).toBeNull();
    viewer.destroy();
    host.remove();
  });

  it('tries a given password first, and opens the PDF again when it changes', async () => {
    const { host, viewer, tasks } = open({ password: 'secret' }, { locked: true });
    await ready(viewer);
    expect(viewer.element.querySelector('form')).toBeNull();
    viewer.update({ password: 'other' });
    await vi.waitFor(() => expect(viewer.element.querySelector('form')).not.toBeNull());
    expect(tasks[0].destroy).toHaveBeenCalled();
    viewer.destroy();
    host.remove();
  });

  it('closes the document when it goes away, and reports a file that is not a PDF', async () => {
    const { host, viewer, tasks } = open({});
    await ready(viewer);
    viewer.destroy();
    expect(tasks[0].destroy).toHaveBeenCalled();
    host.remove();

    const onError = vi.fn();
    vi.mocked(loadPdfjs).mockResolvedValue({
      ...fakePdfjs().pdfjs,
      getDocument: () => ({
        promise: Promise.reject(new Error('Invalid PDF structure.')),
        destroy() {},
      }),
    });
    const bad = document.createElement('div');
    document.body.append(bad);
    const broken = createPdfViewer(bad, { source: new Blob(['nope']), onError });
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(broken.element.querySelector('[role="alert"]')).toHaveTextContent(
      'Invalid PDF structure',
    );
    broken.destroy();
    bad.remove();
  });

  it('opens at the page it is given', async () => {
    const { host, viewer } = open({ initialPage: 3 });
    await ready(viewer);
    await vi.waitFor(() => expect(scroller(viewer).scrollTop).toBeGreaterThan(1000));
    viewer.destroy();
    host.remove();
  });
});
