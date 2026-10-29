import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import ExcelJS from 'exceljs';
import { ExcelViewer } from './ExcelViewer.jsx';
import { columnName, formatNumber } from './parseWorkbook.js';

async function workbookFile() {
  const book = new ExcelJS.Workbook();
  const first = book.addWorksheet('Sales');
  first.columns = [{ width: 12 }, { width: 8 }, { width: 8 }];
  first.addRow(['Report', null, null]);
  first.mergeCells('A1:C1');
  first.getCell('A1').font = { bold: true, color: { argb: 'FFFF0000' } };
  first.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
  first.addRow(['Apples', 3, { formula: 'B2*2', result: 6 }]);
  first.addRow(['Pears', 0.256, new Date(Date.UTC(2024, 9, 1))]);
  first.getCell('B3').numFmt = '0.0%';
  const second = book.addWorksheet('Notes');
  second.addRow(['Remember the milk']);
  const hidden = book.addWorksheet('Secret');
  hidden.state = 'hidden';
  hidden.addRow(['hidden words']);
  const buffer = await book.xlsx.writeBuffer();
  return new File([buffer], 'book.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

describe('column names and number formats', () => {
  it('names columns with letters', () => {
    expect([1, 26, 27, 52, 703].map(columnName)).toEqual(['A', 'Z', 'AA', 'AZ', 'AAA']);
  });

  it('shows numbers as their format does', () => {
    expect(formatNumber(1234.5, '#,##0.00')).toBe('1,234.50');
    expect(formatNumber(0.256, '0.0%')).toBe('25.6%');
    expect(formatNumber(5, '"$"#,##0.00')).toBe('$5.00');
    expect(formatNumber(5, '[$€-407] #,##0')).toBe('€ 5');
    expect(formatNumber(1.5, 'General')).toBe('1.5');
  });
});

describe('ExcelViewer', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('shows the sheets as tabs and the first sheet as a table', async () => {
    render(<ExcelViewer source={await workbookFile()} />);
    const tabs = await screen.findAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Sales', 'Notes']);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    const table = screen.getByRole('table');
    expect(within(table).getByText('Apples')).toBeInTheDocument();
    expect(within(table).getByText('25.6%')).toBeInTheDocument();
    expect(within(table).getByText('2024-10-01')).toBeInTheDocument();
    expect(within(table).getByText('6')).toBeInTheDocument();
  });

  it('draws merged cells once, with their styles and column widths', async () => {
    const { container } = render(<ExcelViewer source={await workbookFile()} />);
    const merged = await screen.findByText('Report');
    expect(merged).toHaveAttribute('colspan', '3');
    expect(merged.style.fontWeight).toBe('700');
    expect(merged.style.color).toBe('rgb(255, 0, 0)');
    expect(merged.style.backgroundColor).toBe('rgb(255, 255, 0)');
    expect(merged.closest('tr').querySelectorAll('td')).toHaveLength(1);
    expect(container.querySelector('col').style.width).toBe('13ch');
    // Sorting would break the merge.
    expect(screen.queryByRole('button', { name: 'A' })).toBeNull();
  });

  it('shows formulas when asked', async () => {
    render(<ExcelViewer source={await workbookFile()} showFormulas />);
    expect(await screen.findByText('=B2*2')).toBeInTheDocument();
  });

  it('switches sheets with the mouse and the arrow keys, and tells the host', async () => {
    const user = userEvent.setup();
    const onSheetChange = vi.fn();
    render(<ExcelViewer source={await workbookFile()} onSheetChange={onSheetChange} />);
    await user.click(await screen.findByRole('tab', { name: 'Notes' }));
    expect(screen.getByText('Remember the milk')).toBeInTheDocument();
    expect(onSheetChange).toHaveBeenLastCalledWith('Notes', 1);
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Sales' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Sales' })).toHaveFocus();
  });

  it('lets the host choose the sheet', async () => {
    render(<ExcelViewer source={await workbookFile()} sheet="Notes" />);
    expect(await screen.findByText('Remember the milk')).toBeInTheDocument();
  });

  it('finds the target in another sheet, shows it and marks it', async () => {
    const onMarked = vi.fn();
    const { container } = render(
      <ExcelViewer
        source={await workbookFile()}
        target={{ matched: 'the milk' }}
        onMarked={onMarked}
      />,
    );
    await waitFor(() => expect(container.querySelector('mark')).not.toBeNull());
    expect(screen.getByRole('tab', { name: 'Notes' })).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(onMarked).toHaveBeenLastCalledWith(true));
  });

  it('says when the target is not in the workbook', async () => {
    const onMarked = vi.fn();
    render(
      <ExcelViewer
        source={await workbookFile()}
        target={{ matched: 'zebra' }}
        onMarked={onMarked}
      />,
    );
    await screen.findAllByRole('tab');
    await waitFor(() => expect(onMarked).toHaveBeenLastCalledWith(false));
  });

  it('calls onReady with the sheet names and has no accessibility violations', async () => {
    const onReady = vi.fn();
    const { container } = render(<ExcelViewer source={await workbookFile()} onReady={onReady} />);
    await screen.findAllByRole('tab');
    await waitFor(() => expect(onReady).toHaveBeenCalledWith({ sheets: ['Sales', 'Notes'] }));
    expect(await axe(container)).toHaveNoViolations();
  });

  it('reports a file that cannot be read', async () => {
    const onError = vi.fn();
    render(<ExcelViewer source={new File(['not a workbook'], 'x.xlsx')} onError={onError} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be read');
    await waitFor(() => expect(onError).toHaveBeenCalled());
  });
});
