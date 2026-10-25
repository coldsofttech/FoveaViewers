import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { TextViewer } from './TextViewer.jsx';

const file = (text) => new File([text], 'notes.txt', { type: 'text/plain' });

/** Gives the scrolling region a size, since jsdom has no layout. */
function sizeRegion(height) {
  const spy = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(height);
  return () => spy.mockRestore();
}

describe('TextViewer', () => {
  it('shows the lines with their numbers and has no accessibility violations', async () => {
    const { container } = render(<TextViewer source={file('alpha\nbeta\ngamma')} />);
    expect(await screen.findByText('beta')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Text' })).toBeInTheDocument();
    expect(container.querySelector('[data-line="3"]')).toHaveTextContent('3gamma');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('uses the label as the accessible name', async () => {
    render(<TextViewer source={file('x')} label="Release notes" />);
    expect(await screen.findByRole('region', { name: 'Release notes' })).toBeInTheDocument();
  });

  it('draws only the lines near the view of a very long file', async () => {
    const restore = sizeRegion(200);
    const text = Array.from({ length: 50_000 }, (_, i) => `line ${i + 1}`).join('\n');
    const { container } = render(<TextViewer source={file(text)} />);
    expect(await screen.findByText('line 1')).toBeInTheDocument();
    const drawn = container.querySelectorAll('[data-line]').length;
    expect(drawn).toBeGreaterThan(0);
    expect(drawn).toBeLessThan(100);
    expect(screen.queryByText('line 50000')).not.toBeInTheDocument();
    restore();
  });

  it('marks the target characters and scrolls to the target line', async () => {
    const restore = sizeRegion(200);
    const text = Array.from({ length: 1000 }, (_, i) => `row ${i + 1} needle here`).join('\n');
    render(<TextViewer source={file(text)} target={{ line: 500, column: 9, length: 6 }} />);
    const mark = await screen.findByText('needle');
    expect(mark.tagName).toBe('MARK');
    expect(screen.getByRole('region').scrollTop).toBe(499 * 20 - 90);
    restore();
  });

  it('applies a theme as custom properties', async () => {
    render(<TextViewer source={file('x')} theme="dark" />);
    const region = await screen.findByRole('region');
    expect(region.style.getPropertyValue('--fovea-background')).toBe('#1e1e1e');
  });

  it('calls onReady with the line count', async () => {
    const onReady = vi.fn();
    render(<TextViewer source={file('a\nb\nc')} onReady={onReady} />);
    await screen.findByText('a');
    expect(onReady).toHaveBeenCalledWith({ lineCount: 3 });
  });

  it('shows an alert and calls onError when the file cannot be loaded', async () => {
    const onError = vi.fn();
    const fetcher = () => Promise.resolve(new Response('', { status: 404 }));
    render(<TextViewer source="/missing.txt" fetcher={fetcher} onError={onError} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('404');
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });
});
