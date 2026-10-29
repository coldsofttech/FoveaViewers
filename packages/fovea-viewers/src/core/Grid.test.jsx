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

  it('styles cells, merges them and sets column widths', () => {
    const cellProps = (row, column) => {
      if (row === 0 && column === 0) return { colSpan: 2, style: { fontWeight: 'bold' } };
      if (row === 0 && column === 1) return { coveredBy: 0 };
      if (row === 1 && column === 0) return { rowSpan: 2 };
      if (row === 2 && column === 0) return { coveredBy: 1 };
      return undefined;
    };
    const { container } = render(
      <Grid
        columns={['L', 'N']}
        rows={rows}
        sortable={false}
        cellProps={cellProps}
        columnWidths={['10ch', undefined]}
      />,
    );
    const body = container.querySelectorAll('tbody tr');
    expect(body[0].querySelectorAll('td')).toHaveLength(1);
    expect(body[0].querySelector('td')).toHaveAttribute('colspan', '2');
    expect(body[0].querySelector('td').style.fontWeight).toBe('bold');
    expect(body[1].querySelector('td')).toHaveAttribute('rowspan', '2');
    expect(body[2].querySelectorAll('td')).toHaveLength(1);
    expect(container.querySelector('col').style.width).toBe('10ch');
  });

  it('draws a covered cell when the cell that covers it is on another page', () => {
    const cellProps = (row, column) => (row === 1 && column === 0 ? { coveredBy: 0 } : undefined);
    const { container } = render(
      <Grid columns={['L', 'N']} rows={rows} pageSize={1} cellProps={cellProps} />,
    );
    expect(container.querySelectorAll('tbody td')).toHaveLength(2);
  });

  it('shows the page of a row to reveal, once for each key', async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 5 }, (_, i) => [`r${i}`, '']);
    const { rerender } = render(
      <Grid columns={['L', 'N']} rows={many} pageSize={2} reveal={{ row: 3, key: 'a' }} />,
    );
    expect(screen.getByText('r3')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(screen.getByText('r0')).toBeInTheDocument();
    rerender(<Grid columns={['L', 'N']} rows={many} pageSize={2} reveal={{ row: 3, key: 'a' }} />);
    expect(screen.getByText('r0')).toBeInTheDocument();
    rerender(<Grid columns={['L', 'N']} rows={many} pageSize={2} reveal={{ row: 4, key: 'b' }} />);
    expect(screen.getByText('r4')).toBeInTheDocument();
  });
});
