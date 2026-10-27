import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { Grid, compareCells } from './Grid.jsx';

describe('compareCells', () => {
  it('orders numbers as numbers and text with digits in order', () => {
    expect(compareCells('9', '10')).toBeLessThan(0);
    expect(compareCells('a2', 'a10')).toBeLessThan(0);
    expect(compareCells('b', 'A')).toBeGreaterThan(0);
  });
});

describe('Grid', () => {
  const rows = [
    ['b', '2'],
    ['a', ''],
    ['c', '1'],
  ];

  it('sorts with empty cells last, reports it, and has no accessibility violations', async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    const { container } = render(<Grid columns={['L', 'N']} rows={rows} onSort={onSort} />);
    await user.click(screen.getByRole('button', { name: /N/ }));
    const first = screen.getAllByRole('row')[1];
    expect(first).toHaveTextContent('c1');
    expect(screen.getAllByRole('row')[3]).toHaveTextContent('a');
    expect(onSort).toHaveBeenCalledWith({ column: 1, direction: 'ascending' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
