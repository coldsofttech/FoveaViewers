import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { LineViewer } from './LineViewer.jsx';
import { piecesOf } from './pieces.js';

const tokens = (text) =>
  text.startsWith('//')
    ? [['comment', text]]
    : [
        ['keyword', 'const'],
        [null, text.slice(5)],
      ];

describe('LineViewer', () => {
  it('shows the lines it is given and has no accessibility violations', async () => {
    const { container } = render(<LineViewer lines={['const a = 1;', '// note']} />);
    expect(screen.getByText('// note')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('colours each piece of a line by its kind through a CSS variable', () => {
    render(<LineViewer lines={['const a = 1;', '// note']} tokens={tokens} />);
    expect(screen.getByText('const').style.color).toBe('var(--fovea-token-keyword, inherit)');
    expect(screen.getByText('// note').style.color).toBe('var(--fovea-token-comment, inherit)');
  });

  it('marks characters inside a coloured piece and keeps its colour', () => {
    render(
      <LineViewer
        lines={['const a = 1;']}
        tokens={tokens}
        target={{ line: 1, column: 1, length: 3 }}
      />,
    );
    const mark = screen.getByText('con');
    expect(mark.tagName).toBe('MARK');
    expect(mark.style.color).toContain('keyword');
  });

  it('shows a loading message and an error', () => {
    const onError = vi.fn();
    const { rerender } = render(<LineViewer lines={null} status="loading" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    rerender(
      <LineViewer lines={null} status="error" error={new Error('gone')} onError={onError} />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('gone');
    expect(onError).toHaveBeenCalled();
  });
});

describe('piecesOf', () => {
  it('cuts coloured pieces at the ends of the mark', () => {
    const pieces = piecesOf(
      'abcdef',
      [
        ['a', 'abc'],
        ['b', 'def'],
      ],
      { from: 2, to: 4 },
    );
    expect(pieces).toEqual([
      { kind: 'a', text: 'ab', hit: false },
      { kind: 'a', text: 'c', hit: true },
      { kind: 'b', text: 'd', hit: true },
      { kind: 'b', text: 'ef', hit: false },
    ]);
  });

  it('returns the line whole when there are no segments and no mark', () => {
    expect(piecesOf('abc', null, null)).toEqual([{ kind: null, text: 'abc', hit: false }]);
  });
});
