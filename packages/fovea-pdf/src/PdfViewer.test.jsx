import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { PdfViewer } from './PdfViewer.jsx';
import { loadPdfjs } from './pdfjs.js';

vi.mock('./pdfjs.js', () => ({ loadPdfjs: vi.fn() }));

const file = () => new File(['%PDF-1.7'], 'a.pdf', { type: 'application/pdf' });

const PAGES = ['Alpha opens the file', 'Beta is in the middle', 'Gamma closes it'];
const OUTLINE = [
  { title: 'Start', dest: [0], items: [] },
  { title: 'Ending', dest: [2], items: [{ title: 'Last words', dest: [2], items: [] }] },
];

/** A stand-in for pdf.js: pages of 600 × 800, one line of text each, no drawing. */
function fakePdfjs({ locked = false, outline = OUTLINE, pages = PAGES } = {}) {
  class TextLayer {
    constructor({ container, textContentSource }) {
      this.container = container;
      this.text = textContentSource.text;
    }
    async render() {
      const span = document.createElement('span');
      span.textContent = this.text;
      this.container.append(span);
    }
    cancel() {}
  }
  const doc = {
    numPages: pages.length,
    getPage: async (number) => ({
      rotate: 0,
      getViewport: ({ scale, rotation = 0 }) =>
        rotation % 180
          ? { width: 800 * scale, height: 600 * scale }
          : { width: 600 * scale, height: 800 * scale },
      render: () => ({ promise: Promise.resolve(), cancel() {} }),
      streamTextContent: () => ({ text: pages[number - 1] }),
      getTextContent: async () => ({ items: [{ str: pages[number - 1] }] }),
    }),
    getOutline: async () => outline,
    getDestination: async () => null,
    getPageIndex: async (ref) => ref,
  };
  const tasks = [];
  const pdfjs = {
    TextLayer,
    PasswordResponses: { NEED_PASSWORD: 1, INCORRECT_PASSWORD: 2 },
    getDocument: ({ password }) => {
      const task = { destroy: vi.fn(), onPassword: () => {} };
      task.promise = new Promise((resolve) => {
        const ask = (why) =>
          queueMicrotask(() =>
            task.onPassword((typed) => (typed === 'secret' ? resolve(doc) : ask(2)), why),
          );
        if (locked && password !== 'secret') ask(password === undefined ? 1 : 2);
        else resolve(doc);
      });
      tasks.push(task);
      return task;
    },
  };
  return { pdfjs, tasks };
}

const open = (options, props = {}) => {
  const fake = fakePdfjs(options);
  vi.mocked(loadPdfjs).mockResolvedValue(fake.pdfjs);
  return { ...fake, ...render(<PdfViewer source={file()} {...props} />) };
};

const region = () => screen.findByRole('region', { name: 'PDF document' });
const pageInput = () => screen.getByRole('spinbutton', { name: 'Page number' });
const zoomText = () =>
  [...screen.getByRole('toolbar').children].find((child) => child.tagName === 'SPAN').textContent;

beforeEach(() => {
  vi.mocked(loadPdfjs).mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PdfViewer', () => {
  it('shows the first page and its text, and has no accessibility violations', async () => {
    const onReady = vi.fn();
    const { container } = open({}, { onReady });
    expect(await screen.findByRole('group', { name: 'Page 1' })).toBeInTheDocument();
    expect(await screen.findByText('Alpha opens the file')).toBeInTheDocument();
    expect(screen.getByText('of 3')).toBeInTheDocument();
    expect(onReady).toHaveBeenCalledWith({ pageCount: 3 });
    expect(await axe(container)).toHaveNoViolations();
  });

  it('draws only the pages near the view', async () => {
    open();
    const scroller = await region();
    await screen.findByRole('group', { name: 'Page 1' });
    expect(screen.queryByRole('group', { name: 'Page 3' })).not.toBeInTheDocument();
    fireEvent.scroll(scroller, { target: { scrollTop: 1700 } });
    expect(await screen.findByRole('group', { name: 'Page 3' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Page 1' })).not.toBeInTheDocument();
    expect(pageInput()).toHaveValue(3);
  });

  it('reports the page as the reader scrolls', async () => {
    const onPageChange = vi.fn();
    open({}, { onPageChange });
    const scroller = await region();
    await screen.findByRole('group', { name: 'Page 1' });
    fireEvent.scroll(scroller, { target: { scrollTop: 1700 } });
    await waitFor(() => expect(onPageChange).toHaveBeenLastCalledWith(3));
  });

  it('zooms and turns', async () => {
    const user = userEvent.setup();
    open();
    await screen.findByRole('group', { name: 'Page 1' });
    expect(zoomText()).toBe('100%');
    await user.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(zoomText()).toBe('125%');
    await user.click(screen.getByRole('button', { name: 'Zoom out' }));
    await user.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(zoomText()).toBe('80%');

    const page = screen.getByRole('group', { name: 'Page 1' });
    expect(page).toHaveStyle({ width: '480px', height: '640px' });
    await user.click(screen.getByRole('button', { name: 'Rotate right' }));
    expect(screen.getByRole('group', { name: 'Page 1' })).toHaveStyle({
      width: '640px',
      height: '480px',
    });
  });

  it('fits the page to the view', async () => {
    class Observer {
      constructor(callback) {
        this.callback = callback;
      }
      observe() {
        this.callback([{ contentRect: { width: 624, height: 424 } }]);
      }
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', Observer);
    const user = userEvent.setup();
    open();
    await screen.findByRole('group', { name: 'Page 1' });
    expect(zoomText()).toBe('100%');
    await user.click(screen.getByRole('button', { name: 'Fit to page' }));
    expect(zoomText()).toBe('50%');
    await user.click(screen.getByRole('button', { name: 'Fit to width' }));
    expect(zoomText()).toBe('100%');
  });

  it('goes to a page typed in', async () => {
    const user = userEvent.setup();
    open();
    const scroller = await region();
    await screen.findByRole('group', { name: 'Page 1' });
    await user.clear(pageInput());
    await user.type(pageInput(), '2{Enter}');
    expect(scroller.scrollTop).toBeGreaterThan(0);
  });

  it('shows the outline and goes to an item', async () => {
    const user = userEvent.setup();
    open();
    const scroller = await region();
    await user.click(await screen.findByRole('button', { name: 'Outline' }));
    const nav = screen.getByRole('navigation', { name: 'Outline' });
    expect(nav).toHaveTextContent('Last words');
    await user.click(screen.getByRole('button', { name: 'Ending' }));
    await waitFor(() => expect(scroller.scrollTop).toBeGreaterThan(0));
  });

  it('has no outline button for a PDF without one', async () => {
    open({ outline: [] });
    await screen.findByRole('group', { name: 'Page 1' });
    expect(screen.queryByRole('button', { name: 'Outline' })).not.toBeInTheDocument();
  });

  it('finds the target, tells which page it is on, and marks the words', async () => {
    const onLocated = vi.fn();
    open({}, { target: { matched: 'gamma closes', before: '', after: '' }, onLocated });
    const scroller = await region();
    await waitFor(() => expect(onLocated).toHaveBeenLastCalledWith(3));
    fireEvent.scroll(scroller, { target: { scrollTop: 1700 } });
    await screen.findByRole('group', { name: 'Page 3' });
    await waitFor(() => expect(document.querySelector('mark')).not.toBeNull());
    expect(document.querySelector('mark')).toHaveTextContent('Gamma closes');
  });

  it('says there is no page when the words are not in the PDF', async () => {
    const onLocated = vi.fn();
    open({}, { target: { matched: 'nowhere to be found' }, onLocated });
    await waitFor(() => expect(onLocated).toHaveBeenLastCalledWith(null));
  });

  it('asks for a password, and opens the PDF when it is right', async () => {
    const user = userEvent.setup();
    open({ locked: true });
    expect(await screen.findByText(/protected/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(await screen.findByText(/not right/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Password'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(await screen.findByRole('group', { name: 'Page 1' })).toBeInTheDocument();
  });

  it('tries a password it is given first', async () => {
    open({ locked: true }, { password: 'secret' });
    expect(await screen.findByRole('group', { name: 'Page 1' })).toBeInTheDocument();
  });

  it('closes the document when it goes away', async () => {
    const fake = fakePdfjs();
    vi.mocked(loadPdfjs).mockResolvedValue(fake.pdfjs);
    const { unmount } = render(<PdfViewer source={file()} />);
    await screen.findByRole('group', { name: 'Page 1' });
    unmount();
    expect(fake.tasks.at(-1).destroy).toHaveBeenCalled();
  });

  it('reports a file that cannot be loaded', async () => {
    const onError = vi.fn();
    const fetcher = () => Promise.reject(new Error('offline'));
    render(<PdfViewer source="https://example.com/a.pdf" fetcher={fetcher} onError={onError} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('offline');
    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'offline' })),
    );
  });

  it('reports a file that is not a PDF', async () => {
    const onError = vi.fn();
    const pdfjs = {
      ...fakePdfjs().pdfjs,
      getDocument: () => ({
        destroy() {},
        promise: Promise.reject(new Error('Invalid PDF structure.')),
      }),
    };
    vi.mocked(loadPdfjs).mockResolvedValue(pdfjs);
    render(<PdfViewer source={file()} onError={onError} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid PDF structure.');
    await waitFor(() => expect(onError).toHaveBeenCalled());
  });
});
