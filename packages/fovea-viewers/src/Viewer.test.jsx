import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { Viewer } from './Viewer.jsx';
import * as registry from './registry.js';

vi.mock('./registry.js', async (importOriginal) => ({
  ...(await importOriginal()),
  load: vi.fn(),
}));

const TextViewer = ({ source }) => <p>text viewer for {source.name}</p>;

describe('Viewer', () => {
  it('loads the viewer that matches the file and renders it', async () => {
    vi.mocked(registry.load).mockResolvedValue({ TextViewer });
    const { container } = render(<Viewer source={new File(['x'], 'a.txt')} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(await screen.findByText('text viewer for a.txt')).toBeInTheDocument();
    expect(registry.load).toHaveBeenCalledWith('text');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('uses the type prop over the file name', async () => {
    vi.mocked(registry.load).mockResolvedValue({ TextViewer });
    render(<Viewer type="text" source={new File(['x'], 'a.bin')} />);
    expect(await screen.findByText('text viewer for a.bin')).toBeInTheDocument();
  });

  it('reports a file it cannot identify', async () => {
    const onError = vi.fn();
    render(<Viewer source={new File(['x'], 'a.unknown')} onError={onError} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Pass a "type"');
    expect(onError).toHaveBeenCalled();
  });

  it('reports a viewer that is not installed', async () => {
    const onError = vi.fn();
    vi.mocked(registry.load).mockRejectedValue(new Error('Install it'));
    render(<Viewer source={new File(['x'], 'a.txt')} onError={onError} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Install it');
    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Install it' })),
    );
  });
});
