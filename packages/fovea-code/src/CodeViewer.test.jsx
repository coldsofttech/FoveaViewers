import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { CodeViewer, codeMode } from './index.js';

const file = (text, name) => new File([text], name);
const JSON_TEXT = '{\n  "name": "wheat",\n  "port": 80\n}\n';

describe('codeMode', () => {
  it('opens a file as its source, and a minified one laid out when it can be', () => {
    expect(codeMode('json', JSON_TEXT, 12, null)).toEqual({
      mode: 'source',
      canFormat: true,
      tooBig: false,
    });
    expect(codeMode('json', JSON_TEXT, 5000, null).mode).toBe('formatted');
  });

  it('keeps the choice made, and a language without a layout as source', () => {
    expect(codeMode('json', JSON_TEXT, 5000, 'source').mode).toBe('source');
    expect(codeMode('json', JSON_TEXT, 5, 'formatted').mode).toBe('formatted');
    expect(codeMode('toml', 'a = 1', 5000, null)).toEqual({
      mode: 'source',
      canFormat: false,
      tooBig: false,
    });
  });

  it('does not lay out a file that is too large', () => {
    const big = 'x'.repeat(20 * 1024 * 1024 + 1);
    expect(codeMode('json', big, 10, 'formatted')).toEqual({
      mode: 'source',
      canFormat: false,
      tooBig: true,
    });
  });
});

describe('CodeViewer', () => {
  it('shows coloured code with line numbers and has no accessibility violations', async () => {
    const { container } = render(<CodeViewer source={file(JSON_TEXT, 'app.json')} />);
    const key = await screen.findByText('"name"');
    expect(key.style.color).toBe('var(--fovea-token-key, inherit)');
    expect(screen.getByRole('region', { name: 'JSON source' })).toBeInTheDocument();
    expect(container.querySelector('[data-line="4"]')).toHaveTextContent('4}');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('works out the language from the file name, and an explicit language wins', async () => {
    const onReady = vi.fn();
    const { rerender } = render(
      <CodeViewer source={file('int x = 1;', 'a.c')} onReady={onReady} />,
    );
    await screen.findByRole('region', { name: 'C source' });
    await waitFor(() =>
      expect(onReady).toHaveBeenCalledWith(expect.objectContaining({ language: 'c' })),
    );
    rerender(<CodeViewer source={file('int x = 1;', 'a.c')} language="cpp" onReady={onReady} />);
    await screen.findByRole('region', { name: 'C++ source' });
  });

  it('shows a file of unknown language plain', async () => {
    render(<CodeViewer source={file('just words', 'notes.zzz')} />);
    const line = await screen.findByText('just words');
    expect(line.style.color).toBe('');
    expect(screen.getByRole('region', { name: 'Text source' })).toBeInTheDocument();
  });

  it('applies Dark+ colours', async () => {
    render(<CodeViewer source={file(JSON_TEXT, 'a.json')} theme="dark" />);
    const region = await screen.findByRole('region');
    expect(region.style.getPropertyValue('--fovea-background')).toBe('#1e1e1e');
    expect(region.style.getPropertyValue('--fovea-token-keyword')).toBe('#c586c0');
  });

  it('finds a match, marks it on its line and says where it is', async () => {
    const onLocated = vi.fn();
    render(
      <CodeViewer
        source={file(JSON_TEXT, 'a.json')}
        match={{ before: '"name": "', matched: 'wheat', after: '"' }}
        onLocated={onLocated}
      />,
    );
    const mark = await screen.findByText('wheat', { selector: 'mark' });
    expect(mark).toBeInTheDocument();
    await waitFor(() =>
      expect(onLocated).toHaveBeenCalledWith(expect.objectContaining({ line: 2 })),
    );
  });

  it('says a match is not there', async () => {
    const onLocated = vi.fn();
    render(
      <CodeViewer
        source={file(JSON_TEXT, 'a.json')}
        match={{ matched: 'absent' }}
        onLocated={onLocated}
      />,
    );
    await screen.findByText('"name"');
    await waitFor(() => expect(onLocated).toHaveBeenCalledWith(null));
  });

  it('lays out a minified file by itself and as the source when asked', async () => {
    const minified = JSON.stringify({
      items: Array.from({ length: 400 }, (_, i) => ({ id: i, name: `item ${i}` })),
    });
    expect(minified.length).toBeGreaterThan(2000);
    const onReady = vi.fn();
    const { rerender } = render(<CodeViewer source={file(minified, 'm.json')} onReady={onReady} />);
    await waitFor(() =>
      expect(onReady).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'formatted', canFormat: true }),
      ),
    );
    expect(onReady.mock.calls.at(-1)[0].lineCount).toBeGreaterThan(100);
    rerender(<CodeViewer source={file(minified, 'm.json')} mode="source" onReady={onReady} />);
    await waitFor(() =>
      expect(onReady).toHaveBeenLastCalledWith(
        expect.objectContaining({ mode: 'source', lineCount: 1 }),
      ),
    );
  });

  it('counts a CRLF file by its lines', async () => {
    const onReady = vi.fn();
    render(<CodeViewer source={file('a = 1\r\nb = 2\r\n', 'a.py')} onReady={onReady} />);
    await waitFor(() =>
      expect(onReady).toHaveBeenCalledWith(expect.objectContaining({ lineCount: 3 })),
    );
  });

  it('shows an alert and calls onError when the file cannot be loaded', async () => {
    const onError = vi.fn();
    const fetcher = () => Promise.resolve(new Response('', { status: 404 }));
    render(<CodeViewer source="/missing.js" fetcher={fetcher} onError={onError} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('404');
    await waitFor(() => expect(onError).toHaveBeenCalled());
  });
});
