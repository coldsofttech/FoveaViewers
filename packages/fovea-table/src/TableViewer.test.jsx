import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { TableViewer } from './TableViewer.jsx';

const file = (text) => new File([text], 'data.csv', { type: 'text/csv' });

const CSV = 'Name,Score\nBea,10\nAda,9\nCy,100\n';

const bodyNames = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0].textContent);

describe('TableViewer', () => {
  it('shows the headers and rows, and has no accessibility violations', async () => {
    const { container } = render(<TableViewer source={file(CSV)} />);
    expect(await screen.findByRole('columnheader', { name: /Name/ })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Table' })).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(4);
    expect(screen.getByRole('cell', { name: 'Bea' })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('sorts by a column, numbers as numbers, then back to the original order', async () => {
    const user = userEvent.setup();
    render(<TableViewer source={file(CSV)} />);
    await screen.findByRole('columnheader', { name: /Score/ });
    const score = screen.getByRole('button', { name: /Score/ });

    await user.click(score);
    expect(bodyNames()).toEqual(['Ada', 'Bea', 'Cy']);
    expect(screen.getByRole('columnheader', { name: /Score/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    await user.click(score);
    expect(bodyNames()).toEqual(['Cy', 'Bea', 'Ada']);
    await user.click(score);
    expect(bodyNames()).toEqual(['Bea', 'Ada', 'Cy']);
  });

  it('can leave sorting off', async () => {
    render(<TableViewer source={file(CSV)} sortable={false} />);
    await screen.findByRole('columnheader', { name: 'Name' });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('names the columns when the first row is not a header', async () => {
    render(<TableViewer source={file(CSV)} header={false} />);
    expect(await screen.findByRole('columnheader', { name: /Column 1/ })).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(5);
  });

  it('reads a semicolon file given the delimiter', async () => {
    render(<TableViewer source={file('a;b\n1;2')} delimiter=";" />);
    expect(await screen.findByRole('cell', { name: '2' })).toBeInTheDocument();
  });

  it('shows rows a page at a time', async () => {
    const user = userEvent.setup();
    const rows = Array.from({ length: 5 }, (_, i) => `r${i + 1}`).join('\n');
    render(<TableViewer source={file(`h\n${rows}`)} pageSize={2} />);
    expect(await screen.findByText('Rows 1–2 of 5')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getByText('Rows 3–4 of 5')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'r3' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getByText('Rows 5–5 of 5')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });

  it('reports when it is ready', async () => {
    const onReady = vi.fn();
    render(<TableViewer source={file(CSV)} onReady={onReady} />);
    await screen.findByRole('columnheader', { name: /Name/ });
    expect(onReady).toHaveBeenCalledWith({ rowCount: 3, columnCount: 2, delimiter: ',' });
  });

  it('says so when the file is empty', async () => {
    render(<TableViewer source={file('')} />);
    expect(await screen.findByText('This file is empty.')).toBeInTheDocument();
  });

  it('reports a file that cannot be loaded', async () => {
    const onError = vi.fn();
    const fetcher = () => Promise.reject(new Error('offline'));
    render(<TableViewer source="https://example.com/a.csv" fetcher={fetcher} onError={onError} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('offline');
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'offline' }));
  });
});
