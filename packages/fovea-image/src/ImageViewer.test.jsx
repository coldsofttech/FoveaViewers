import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { ImageViewer } from './ImageViewer.jsx';

const file = (type = 'image/png') => new File(['x'.repeat(2048)], 'pic.png', { type });

/** jsdom does not load images, so the test says when one has loaded and how big it is. */
function loadImage(image, width = 200, height = 100) {
  Object.defineProperty(image, 'naturalWidth', { value: width, configurable: true });
  Object.defineProperty(image, 'naturalHeight', { value: height, configurable: true });
  fireEvent.load(image);
}

const imageOf = async () => screen.findByRole('img', { name: 'Image' });
const zoomText = () => screen.getByRole('toolbar').querySelector('span').textContent;

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:fake');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ImageViewer', () => {
  it('shows a file, its details, and has no accessibility violations', async () => {
    const onReady = vi.fn();
    const { container } = render(<ImageViewer source={file()} onReady={onReady} />);
    const image = await imageOf();
    expect(image).toHaveAttribute('src', 'blob:fake');
    loadImage(image);
    expect(await screen.findByText('200 × 100 px · 2.0 KB · image/png')).toBeInTheDocument();
    await waitFor(() =>
      expect(onReady).toHaveBeenCalledWith({
        width: 200,
        height: 100,
        size: 2048,
        type: 'image/png',
      }),
    );
    expect(zoomText()).toBe('100%');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('gives a URL straight to the browser unless there is a fetcher', async () => {
    // A plain response: Node 22's Response cannot be built from jsdom's File.
    const fetcher = vi.fn(() => Promise.resolve({ ok: true, blob: () => Promise.resolve(file()) }));
    const { unmount } = render(<ImageViewer source="https://example.com/a.png" />);
    expect((await imageOf()).getAttribute('src')).toBe('https://example.com/a.png');
    expect(fetcher).not.toHaveBeenCalled();
    unmount();

    render(<ImageViewer source="https://example.com/a.png" fetcher={fetcher} />);
    expect((await imageOf()).getAttribute('src')).toBe('blob:fake');
    expect(fetcher).toHaveBeenCalledWith('https://example.com/a.png');
  });

  it('releases the temporary address when it goes away', async () => {
    const { unmount } = render(<ImageViewer source={file()} />);
    await imageOf();
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake');
  });

  it('zooms with the buttons and the keyboard, and fits again', async () => {
    const user = userEvent.setup();
    render(<ImageViewer source={file()} />);
    loadImage(await imageOf());
    await user.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(zoomText()).toBe('125%');
    await user.click(screen.getByRole('button', { name: 'Zoom out' }));
    await user.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(zoomText()).toBe('80%');

    screen.getByRole('region', { name: 'Image' }).focus();
    await user.keyboard('+');
    expect(zoomText()).toBe('100%');
    await user.keyboard('1');
    expect(zoomText()).toBe('100%');
    await user.click(screen.getByRole('button', { name: 'Fit to view' }));
    expect(zoomText()).toBe('100%');
  });

  it('zooms with the mouse wheel', async () => {
    render(<ImageViewer source={file()} />);
    loadImage(await imageOf());
    fireEvent.wheel(screen.getByRole('region', { name: 'Image' }), { deltaY: -100 });
    expect(Number.parseInt(zoomText(), 10)).toBeGreaterThan(100);
  });

  it('turns the image in quarter turns', async () => {
    const user = userEvent.setup();
    render(<ImageViewer source={file()} />);
    const image = await imageOf();
    loadImage(image);
    await user.click(screen.getByRole('button', { name: 'Rotate right' }));
    expect(image.style.transform).toContain('rotate(90deg)');
    await user.click(screen.getByRole('button', { name: 'Rotate left' }));
    await user.click(screen.getByRole('button', { name: 'Rotate left' }));
    expect(image.style.transform).toContain('rotate(270deg)');
  });

  it('can start at its own size and leave out the details', async () => {
    render(<ImageViewer source={file()} fit="actual" showInfo={false} />);
    loadImage(await imageOf());
    expect(zoomText()).toBe('100%');
    expect(screen.queryByText(/px/)).not.toBeInTheDocument();
  });

  it('reports an image that cannot be shown', async () => {
    const onError = vi.fn();
    render(<ImageViewer source={file()} onError={onError} />);
    fireEvent.error(await imageOf());
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be shown');
    await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.any(Error)));
  });

  it('reports a file that cannot be loaded', async () => {
    const onError = vi.fn();
    const fetcher = () => Promise.reject(new Error('offline'));
    render(<ImageViewer source="https://example.com/a.png" fetcher={fetcher} onError={onError} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('offline');
    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'offline' })),
    );
  });
});
