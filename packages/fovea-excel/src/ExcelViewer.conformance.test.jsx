import { describe, expect, it, vi } from 'vitest';
import ExcelJS from 'exceljs';
import { describeConformance } from '../../../test-support/conformance.js';
import {
  elementAdapter,
  reactComponentAdapter,
  vanillaAdapter,
} from '../../../test-support/adapters.jsx';
import { ExcelViewer } from './ExcelViewer.jsx';
import { defineExcelElement } from './element.js';
import { createExcelViewer } from './vanilla/index.js';

/** A small workbook: Sales (with a formula), Notes, and an empty sheet. */
async function workbook() {
  const book = new ExcelJS.Workbook();
  const sales = book.addWorksheet('Sales');
  sales.addRow(['Item', 'Count']);
  sales.addRow(['Apples', 3]);
  sales.addRow(['Pears', { formula: 'B2*2', result: 6 }]);
  const notes = book.addWorksheet('Notes');
  notes.addRow(['Remember the milk']);
  book.addWorksheet('Empty');
  return new Uint8Array(await book.xlsx.writeBuffer());
}
const sample = await workbook();

describeConformance('excel', {
  text: sample,
  shows: (root) => {
    expect(root.querySelectorAll('[role="tab"]')).toHaveLength(3);
    expect(root.querySelector('td')).toHaveTextContent('Item');
  },
  adapters: [
    vanillaAdapter(createExcelViewer),
    elementAdapter('fovea-excel', defineExcelElement),
    reactComponentAdapter(ExcelViewer),
  ],
});

describe('createExcelViewer', () => {
  const open = (props) => {
    const host = document.createElement('div');
    document.body.append(host);
    return { host, viewer: createExcelViewer(host, { source: new Blob([sample]), ...props }) };
  };
  const tabs = (viewer) => [...viewer.element.querySelectorAll('[role="tab"]')];
  const cells = (viewer) => [...viewer.element.querySelectorAll('td')].map((td) => td.textContent);

  it('shows a tab for each sheet, selects the first, and links the tab to its panel', async () => {
    const { host, viewer } = open({});
    await vi.waitFor(() => expect(tabs(viewer)).toHaveLength(3));
    expect(tabs(viewer).map((t) => t.getAttribute('aria-selected'))).toEqual([
      'true',
      'false',
      'false',
    ]);
    expect(tabs(viewer).map((t) => t.tabIndex)).toEqual([0, -1, -1]);
    const panel = viewer.element.querySelector('[role="tabpanel"]');
    expect(panel.getAttribute('aria-labelledby')).toBe(tabs(viewer)[0].id);
    expect(tabs(viewer)[0].getAttribute('aria-controls')).toBe(panel.id);
    viewer.destroy();
    host.remove();
  });

  it('changes sheet on a click, keeps the tab in place, and tells the host', async () => {
    const onSheetChange = vi.fn();
    const { host, viewer } = open({ onSheetChange });
    await vi.waitFor(() => expect(tabs(viewer)).toHaveLength(3));
    const [, notes] = tabs(viewer);
    notes.click();
    expect(onSheetChange).toHaveBeenCalledWith('Notes', 1);
    expect(cells(viewer)).toEqual(['Remember the milk']);
    expect(tabs(viewer)[1]).toBe(notes);
    expect(notes).toHaveAttribute('aria-selected', 'true');
    tabs(viewer)[2].click();
    expect(viewer.element).toHaveTextContent('This sheet is empty.');
    viewer.destroy();
    host.remove();
  });

  it('moves between tabs with the arrow keys, Home and End, and keeps the focus on the chosen tab', async () => {
    const { host, viewer } = open({});
    await vi.waitFor(() => expect(tabs(viewer)).toHaveLength(3));
    const press = (key) => {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      document.activeElement.dispatchEvent(event);
      return event;
    };
    tabs(viewer)[0].focus();
    press('ArrowRight');
    expect(document.activeElement).toBe(tabs(viewer)[1]);
    press('End');
    expect(document.activeElement).toBe(tabs(viewer)[2]);
    press('ArrowRight');
    expect(document.activeElement).toBe(tabs(viewer)[0]);
    press('ArrowLeft');
    expect(document.activeElement).toBe(tabs(viewer)[2]);
    press('Home');
    expect(document.activeElement).toBe(tabs(viewer)[0]);
    expect(press('x').defaultPrevented).toBe(false);
    viewer.destroy();
    host.remove();
  });

  it('lets the host choose the sheet by name or place, and shows formulas on request', async () => {
    const { host, viewer } = open({ sheet: 'Notes' });
    await vi.waitFor(() => expect(cells(viewer)).toEqual(['Remember the milk']));
    viewer.update({ sheet: 0 });
    expect(cells(viewer)).toContain('Apples');
    viewer.update({ sheet: 'Nonsense' });
    expect(cells(viewer)).toContain('Apples');
    viewer.update({ showFormulas: true });
    expect(cells(viewer).some((c) => c.startsWith('='))).toBe(true);
    viewer.update({ showFormulas: false });
    expect(cells(viewer)).toContain('6');
    viewer.destroy();
    host.remove();
  });

  it('finds the target in another sheet, shows that sheet and marks the words once', async () => {
    const onMarked = vi.fn();
    Element.prototype.scrollIntoView = vi.fn();
    const { host, viewer } = open({ target: { matched: 'the milk' }, onMarked });
    await vi.waitFor(() => expect(onMarked).toHaveBeenLastCalledWith(true));
    expect(tabs(viewer)[1]).toHaveAttribute('aria-selected', 'true');
    expect(viewer.element.querySelector('mark')).toHaveTextContent('the milk');
    const calls = onMarked.mock.calls.length;
    viewer.update({ label: 'Book' });
    expect(onMarked.mock.calls.length).toBe(calls);
    expect(viewer.element.querySelector('mark')).not.toBeNull();
    viewer.update({ target: undefined });
    expect(onMarked).toHaveBeenLastCalledWith(null);
    expect(viewer.element.querySelector('mark')).toBeNull();
    viewer.destroy();
    host.remove();
  });

  it('reports the sheet names once, and a file that is not a workbook', async () => {
    const onReady = vi.fn();
    const onError = vi.fn();
    const { host, viewer } = open({ onReady, onError });
    await vi.waitFor(() =>
      expect(onReady).toHaveBeenCalledWith({ sheets: ['Sales', 'Notes', 'Empty'] }),
    );
    viewer.update({ pageSize: 5 });
    expect(onReady).toHaveBeenCalledTimes(1);
    viewer.update({ source: new Blob(['not a workbook']) });
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(viewer.element.querySelector('[role="alert"]')).toHaveTextContent('could not be read');
    viewer.destroy();
    host.remove();
  });
});

describe('<fovea-excel>', () => {
  it('reads sheet and show-formulas from attributes, and reports a tab choice in fovea-sheet-change', async () => {
    const changed = vi.fn();
    const el = document.createElement('fovea-excel');
    el.setAttribute('sheet', 'Notes');
    el.addEventListener('fovea-sheet-change', (e) => changed(e.detail));
    el.source = new Blob([sample]);
    document.body.append(el);
    const root = () => el.shadowRoot.querySelector('[data-fovea-root]');
    await vi.waitFor(() =>
      expect(root().querySelector('td')).toHaveTextContent('Remember the milk'),
    );
    root().querySelectorAll('[role="tab"]')[0].click();
    expect(changed).toHaveBeenCalledWith({ name: 'Sales', index: 0 });
    el.remove();
  });
});

describe('cells with a fill of their own', () => {
  it('get black or white text, whichever reads better, unless the file sets a text colour', async () => {
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet('Fills');
    const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
    sheet.addRow(['light', 'dark', 'own colour', 'no fill']);
    sheet.getCell('A1').fill = fill('FFDDEBF7');
    sheet.getCell('B1').fill = fill('FF1F3864');
    sheet.getCell('C1').fill = fill('FF1F3864');
    sheet.getCell('C1').font = { color: { argb: 'FFFF0000' } };
    const host = document.createElement('div');
    document.body.append(host);
    const viewer = createExcelViewer(host, { source: new Blob([await book.xlsx.writeBuffer()]) });
    await vi.waitFor(() => expect(viewer.element.querySelectorAll('td')).toHaveLength(4));
    const [light, dark, own, none] = [...viewer.element.querySelectorAll('td')].map(
      (td) => td.style.color,
    );
    expect(light).toBe('rgb(0, 0, 0)');
    expect(dark).toBe('rgb(255, 255, 255)');
    expect(own).toBe('rgb(255, 0, 0)');
    expect(none).toBe('');
    viewer.destroy();
    host.remove();
  });
});
