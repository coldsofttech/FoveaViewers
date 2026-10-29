import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { HtmlViewer } from './HtmlViewer.jsx';

const file = (html) => new File([html], 'page.html', { type: 'text/html' });
const PAGE =
  '<!doctype html><html><head><title>Hidden title</title><style>.x{color:red}</style></head>' +
  '<body><h1>Welcome</h1><p>Some <b>bold</b> words here and wheat.</p>' +
  '<a id="web" href="https://example.com/next">next</a> <a id="hash" href="#end">end</a> ' +
  '<a id="bad" href="javascript:alert(1)">bad</a><form><button id="go">Go</button></form>' +
  '<script>void 0</script><p id="end">The end</p></body></html>';

/**
 * jsdom does not load a frame's `srcdoc` itself. Put the page in, as a browser would, and say the
 * frame has loaded. That scripts do not run in a browser is the frame's `sandbox` attribute and
 * policy, which the tests check.
 */
async function pageOf(title = 'Web page') {
  const frame = await screen.findByTitle(title);
  await waitFor(() => expect(frame.getAttribute('srcdoc')).toBeTruthy());
  const doc = frame.contentDocument;
  doc.open();
  doc.write(frame.getAttribute('srcdoc'));
  doc.close();
  fireEvent.load(frame);
  return { frame, doc };
}

const policyOf = (doc) =>
  doc.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content');

describe('HtmlViewer', () => {
  it('shows the page locked down by default, and has no accessibility violations', async () => {
    const { container } = render(<HtmlViewer source={file(PAGE)} label="Preview" />);
    const { frame, doc } = await pageOf('Preview');
    expect(frame.getAttribute('sandbox')).toBe('allow-same-origin');
    expect(doc.querySelector('h1')).toHaveTextContent('Welcome');
    expect(doc.querySelector('script')).toBeNull();
    expect(policyOf(doc)).toContain("default-src 'none'");
    expect(policyOf(doc)).not.toMatch(/https?:/);
    // The page inside the frame is the file's own; the viewer's part is the frame and its title.
    expect(await axe(container, { iframes: false })).toHaveNoViolations();
  });

  it('shows an alert and calls onError when the file cannot be loaded', async () => {
    const onError = vi.fn();
    const fetcher = () => Promise.resolve(new Response('', { status: 404 }));
    render(<HtmlViewer source="/missing.html" fetcher={fetcher} onError={onError} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('404');
    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(screen.queryByTitle('Web page')).toBeNull();
  });

  it('shows a loading message until the file is in', async () => {
    render(<HtmlViewer source={file(PAGE)} />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    await pageOf();
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
  });

  it('never submits a form', async () => {
    render(<HtmlViewer source={file(PAGE)} />);
    const { doc } = await pageOf();
    const event = new doc.defaultView.Event('submit', { cancelable: true, bubbles: true });
    doc.querySelector('form').dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(policyOf(doc)).toContain("form-action 'none'");
  });

  it('calls onReady once the page is in', async () => {
    const onReady = vi.fn();
    render(<HtmlViewer source={file(PAGE)} onReady={onReady} />);
    await pageOf();
    await waitFor(() => expect(onReady).toHaveBeenCalledWith({ allowScripts: false }));
  });
});

describe('opting in to pictures and styles', () => {
  it('lets no picture, style or font from the web through by default', async () => {
    render(<HtmlViewer source={file(PAGE)} />);
    const { doc } = await pageOf();
    expect(policyOf(doc)).toContain('img-src data:;');
    expect(policyOf(doc)).toContain("style-src 'unsafe-inline';");
    expect(policyOf(doc)).toContain('font-src data:;');
  });

  it('lets pictures through with allowImages and nothing else', async () => {
    render(<HtmlViewer source={file(PAGE)} allowImages />);
    const { doc } = await pageOf();
    expect(policyOf(doc)).toContain('img-src data: http: https:');
    expect(policyOf(doc)).toContain("style-src 'unsafe-inline';");
  });

  it('lets styles and fonts through with allowStyles and nothing else', async () => {
    render(<HtmlViewer source={file(PAGE)} allowStyles />);
    const { doc } = await pageOf();
    expect(policyOf(doc)).toContain("style-src 'unsafe-inline' http: https:");
    expect(policyOf(doc)).toContain('font-src data: http: https:');
    expect(policyOf(doc)).toContain('img-src data:;');
  });

  it('resolves the relative addresses of a page loaded from a URL, once something needs them', async () => {
    const fetcher = () => Promise.resolve(new Response('<body><img src="pic.png"></body>'));
    const { rerender } = render(
      <HtmlViewer source="https://example.com/dir/page.html" fetcher={fetcher} />,
    );
    const frame = await screen.findByTitle('Web page');
    await waitFor(() => expect(frame.getAttribute('srcdoc')).toBeTruthy());
    expect(frame.getAttribute('srcdoc')).not.toContain('<base');
    rerender(
      <HtmlViewer source="https://example.com/dir/page.html" fetcher={fetcher} allowImages />,
    );
    await waitFor(() =>
      expect(screen.getByTitle('Web page').getAttribute('srcdoc')).toContain(
        '<base href="https://example.com/dir/page.html">',
      ),
    );
  });
});

describe('opting in to scripts', () => {
  it('runs the page in a frame of its own, never together with allow-same-origin', async () => {
    const onReady = vi.fn();
    render(<HtmlViewer source={file(PAGE)} allowScripts onReady={onReady} />);
    const { frame } = await pageOf();
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
    expect(frame.getAttribute('srcdoc')).toContain('<script>void 0</script>');
    expect(frame.getAttribute('srcdoc')).toContain("script-src 'unsafe-inline'");
    expect(frame.getAttribute('srcdoc')).toContain("default-src 'none'");
    await waitFor(() => expect(onReady).toHaveBeenCalledWith({ allowScripts: true }));
  });

  it('starts a new frame when the mode changes', async () => {
    const { rerender } = render(<HtmlViewer source={file(PAGE)} />);
    const first = await screen.findByTitle('Web page');
    rerender(<HtmlViewer source={file(PAGE)} allowScripts />);
    await waitFor(() => expect(screen.getByTitle('Web page')).not.toBe(first));
    expect(screen.getByTitle('Web page').getAttribute('sandbox')).toBe('allow-scripts');
  });

  it('says the target cannot be marked, as the viewer cannot look into the frame', async () => {
    const onMarked = vi.fn();
    const { rerender } = render(
      <HtmlViewer
        source={file(PAGE)}
        allowScripts
        target={{ matched: 'wheat' }}
        onMarked={onMarked}
      />,
    );
    await pageOf();
    await waitFor(() => expect(onMarked).toHaveBeenCalledWith(false));
    rerender(<HtmlViewer source={file(PAGE)} allowScripts onMarked={onMarked} />);
    await waitFor(() => expect(onMarked).toHaveBeenLastCalledWith(null));
  });

  it('takes the address out of links unless links are opened in the viewer', async () => {
    const { rerender } = render(<HtmlViewer source={file(PAGE)} allowScripts />);
    const frame = await screen.findByTitle('Web page');
    await waitFor(() => expect(frame.getAttribute('srcdoc')).toBeTruthy());
    expect(frame.getAttribute('srcdoc')).not.toContain('https://example.com/next');
    rerender(<HtmlViewer source={file(PAGE)} allowScripts links="viewer" />);
    await waitFor(() =>
      expect(screen.getByTitle('Web page').getAttribute('srcdoc')).toContain(
        'https://example.com/next',
      ),
    );
  });
});

describe('marking words', () => {
  it('marks the target words in what the page shows, and not in its style or title', async () => {
    const onMarked = vi.fn();
    const html =
      '<head><title>needle</title><style>needle{}</style></head><body><p>a needle here</p></body>';
    render(<HtmlViewer source={file(html)} target={{ matched: 'needle' }} onMarked={onMarked} />);
    const { doc } = await pageOf();
    await waitFor(() => expect(doc.querySelectorAll('mark')).toHaveLength(1));
    expect(doc.querySelector('p mark')).toHaveTextContent('needle');
    expect(onMarked).toHaveBeenCalledWith(true);
  });

  it('says the words are not shown when they are only in the style or the title', async () => {
    const onMarked = vi.fn();
    const html =
      '<head><title>needle</title><style>needle{}</style></head><body><p>text</p></body>';
    render(<HtmlViewer source={file(html)} target={{ matched: 'needle' }} onMarked={onMarked} />);
    const { doc } = await pageOf();
    await waitFor(() => expect(onMarked).toHaveBeenCalledWith(false));
    expect(doc.querySelector('mark')).toBeNull();
  });

  it('moves the mark when the target moves, and clears it with no target', async () => {
    const onMarked = vi.fn();
    const source = file('<body><p>alpha</p><p>beta</p></body>');
    const { rerender } = render(
      <HtmlViewer source={source} target={{ matched: 'alpha' }} onMarked={onMarked} />,
    );
    const { doc } = await pageOf();
    await waitFor(() => expect(doc.querySelector('mark')).toHaveTextContent('alpha'));
    rerender(<HtmlViewer source={source} target={{ matched: 'beta' }} onMarked={onMarked} />);
    await waitFor(() => expect(doc.querySelector('mark')).toHaveTextContent('beta'));
    expect(doc.querySelectorAll('mark')).toHaveLength(1);
    rerender(<HtmlViewer source={source} onMarked={onMarked} />);
    await waitFor(() => expect(doc.querySelector('mark')).toBeNull());
    expect(onMarked).toHaveBeenLastCalledWith(null);
  });
});

describe('links', () => {
  /** Clicks a link in the frame and gives back the click, to see whether it was cancelled. */
  async function click(id) {
    const { doc } = await pageOf();
    const event = new doc.defaultView.MouseEvent('click', { cancelable: true, bubbles: true });
    doc.getElementById(id).dispatchEvent(event);
    return event;
  }

  it('does nothing for a link by default, but lets an in-page link scroll', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<HtmlViewer source={file(PAGE)} />);
    expect((await click('web')).defaultPrevented).toBe(true);
    expect((await click('hash')).defaultPrevented).toBe(false);
    expect(open).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it('opens the page inside the viewer with links="viewer"', async () => {
    render(<HtmlViewer source={file(PAGE)} links="viewer" />);
    expect((await click('web')).defaultPrevented).toBe(false);
  });

  it('takes a request for a new window out of a link, so it opens in the viewer', async () => {
    render(
      <HtmlViewer
        source={file(PAGE.replace('id="web"', 'id="web" target="_blank"'))}
        links="viewer"
      />,
    );
    const { doc } = await pageOf();
    expect(doc.getElementById('web').hasAttribute('target')).toBe(false);
  });

  it('takes the address out of a link that could run code, so there is nothing to follow', async () => {
    render(<HtmlViewer source={file(PAGE)} links="viewer" />);
    const { doc } = await pageOf();
    expect(doc.getElementById('bad').hasAttribute('href')).toBe(false);
    expect(doc.documentElement.innerHTML).not.toContain('javascript:');
  });

  it('opens a link in a new window, without access to the page, with links="window"', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<HtmlViewer source={file(PAGE)} links="window" />);
    expect((await click('web')).defaultPrevented).toBe(true);
    expect(open).toHaveBeenCalledWith('https://example.com/next', '_blank', 'noopener,noreferrer');
    open.mockRestore();
  });

  it('hands a link to onNavigate instead of following it', async () => {
    const onNavigate = vi.fn();
    render(<HtmlViewer source={file(PAGE)} onNavigate={onNavigate} />);
    expect((await click('web')).defaultPrevented).toBe(true);
    expect(onNavigate).toHaveBeenCalledWith('https://example.com/next', expect.anything());
  });
});
