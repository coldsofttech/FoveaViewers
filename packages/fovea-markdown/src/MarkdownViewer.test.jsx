import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { MarkdownViewer } from './MarkdownViewer.jsx';

const file = (text) => new File([text], 'notes.md', { type: 'text/markdown' });

const SAMPLE = [
  '# Title',
  '',
  'Some **bold** text and a [link](https://example.com/page).',
  '',
  '- [x] done',
  '- [ ] todo',
  '',
  '| a | b |',
  '| - | - |',
  '| 1 | 2 |',
  '',
  'Footnote here[^1].',
  '',
  '[^1]: The note.',
  '',
].join('\n');

describe('MarkdownViewer', () => {
  it('renders formatted blocks and has no accessibility violations', async () => {
    const { container } = render(<MarkdownViewer source={file(SAMPLE)} />);
    expect(await screen.findByRole('heading', { name: 'Title' })).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'done' })).toBeChecked();
    expect(screen.getByRole('region', { name: 'Markdown' })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('opens links in a new window without access to the page', async () => {
    render(<MarkdownViewer source={file(SAMPLE)} />);
    const link = await screen.findByRole('link', { name: 'link' });
    expect(link).toHaveAttribute('href', 'https://example.com/page');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('hands a clicked link to onNavigate instead of opening it', async () => {
    const onNavigate = vi.fn();
    render(<MarkdownViewer source={file(SAMPLE)} onNavigate={onNavigate} />);
    await userEvent.click(await screen.findByRole('link', { name: 'link' }));
    expect(onNavigate).toHaveBeenCalledWith('https://example.com/page', expect.any(MouseEvent));
  });

  it('shows raw HTML and unsafe links as inert text', async () => {
    const text =
      '<img src=x onerror="alert(1)">\n\n[bad](javascript:alert(1))\n\n<script>x</script>';
    const { container } = render(<MarkdownViewer source={file(text)} />);
    expect(await screen.findByText(/\[?bad\]?/)).toBeInTheDocument();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[onerror]')).toBeNull();
    expect(container.querySelector('a[href]')).toBeNull();
  });

  it('shows pictures as alt text unless images are allowed', async () => {
    const text = '![a cat](https://example.com/cat.png)';
    const { container, rerender } = render(<MarkdownViewer source={file(text)} />);
    expect(await screen.findByText('[a cat]')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
    rerender(<MarkdownViewer source={file(text)} allowImages />);
    await waitFor(() => expect(screen.getByRole('img', { name: 'a cat' })).toBeInTheDocument());
  });

  it('marks the words in the block of the target line and says so', async () => {
    const onMarked = vi.fn();
    const target = { line: 3, matched: 'bold text' };
    render(<MarkdownViewer source={file(SAMPLE)} target={target} onMarked={onMarked} />);
    const mark = await screen.findByText('bold', { selector: 'mark' });
    expect(mark).toBeInTheDocument();
    expect(onMarked).toHaveBeenCalledWith(true);
  });

  it('says the words are not shown when they are not in the rendered block', async () => {
    const onMarked = vi.fn();
    const target = { line: 3, matched: 'example.com/missing' };
    render(<MarkdownViewer source={file(SAMPLE)} target={target} onMarked={onMarked} />);
    await screen.findByRole('heading', { name: 'Title' });
    await waitFor(() => expect(onMarked).toHaveBeenCalledWith(false));
  });

  it('moves the mark when the target moves', async () => {
    const { rerender } = render(
      <MarkdownViewer source={file(SAMPLE)} target={{ line: 1, matched: 'Title' }} />,
    );
    await screen.findByText('Title', { selector: 'mark' });
    rerender(<MarkdownViewer source={file(SAMPLE)} target={{ line: 3, matched: 'bold' }} />);
    await screen.findByText('bold', { selector: 'mark' });
    expect(screen.queryByText('Title', { selector: 'mark' })).not.toBeInTheDocument();
  });

  it('follows a footnote link to the footnote', async () => {
    render(<MarkdownViewer source={file(SAMPLE)} />);
    const scrolled = vi.spyOn(HTMLElement.prototype, 'scrollTop', 'set');
    const reference = await screen.findByRole('link', { name: /1/ });
    await userEvent.click(reference);
    expect(scrolled).toHaveBeenCalled();
    scrolled.mockRestore();
  });

  it('applies a theme as custom properties', async () => {
    render(<MarkdownViewer source={file('x')} theme="dark" />);
    const region = await screen.findByRole('region');
    expect(region.style.getPropertyValue('--fovea-background')).toBe('#1e1e1e');
  });

  it('calls onReady with the block count', async () => {
    const onReady = vi.fn();
    render(<MarkdownViewer source={file('a\n\nb\n\nc')} onReady={onReady} />);
    await waitFor(() => expect(onReady).toHaveBeenCalledWith({ blockCount: 3 }));
  });

  it('handles an empty file', async () => {
    const onReady = vi.fn();
    render(<MarkdownViewer source={file('')} onReady={onReady} />);
    await waitFor(() => expect(onReady).toHaveBeenCalledWith({ blockCount: 0 }));
  });

  it('shows an alert and calls onError when the file cannot be loaded', async () => {
    const onError = vi.fn();
    const fetcher = () => Promise.resolve(new Response('', { status: 404 }));
    render(<MarkdownViewer source="/missing.md" fetcher={fetcher} onError={onError} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('404');
    expect(onError).toHaveBeenCalled();
  });
});
