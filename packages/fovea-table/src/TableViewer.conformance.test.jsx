import { describe, expect, it, vi } from 'vitest';
import { describeConformance } from '../../../test-support/conformance.js';
import {
  elementAdapter,
  reactComponentAdapter,
  vanillaAdapter,
} from '../../../test-support/adapters.jsx';
import { TableViewer } from './TableViewer.jsx';
import { defineTableElement } from './element.js';
import { createTableViewer } from './vanilla/index.js';

describeConformance('table', {
  text: 'name,age\nAda,36\nGrace,45',
  shows: (root) => {
    expect(root.querySelector('th')).toHaveTextContent('name');
    expect(root.querySelectorAll('tbody tr')).toHaveLength(2);
  },
  adapters: [
    vanillaAdapter(createTableViewer),
    elementAdapter('fovea-table', defineTableElement),
    reactComponentAdapter(TableViewer),
  ],
});

describe('createTableViewer', () => {
  const open = (props) => {
    const host = document.createElement('div');
    document.body.append(host);
    return { host, viewer: createTableViewer(host, props) };
  };
  const rows = (viewer) =>
    [...viewer.element.querySelectorAll('tbody tr')].map((tr) => tr.textContent);

  it('keeps the header button focused while sorting, and sorts the rows', async () => {
    const { host, viewer } = open({ source: new Blob(['n\nb\na\nc']) });
    await vi.waitFor(() => expect(rows(viewer)).toEqual(['b', 'a', 'c']));
    const button = viewer.element.querySelector('th button');
    button.focus();
    button.click();
    expect(rows(viewer)).toEqual(['a', 'b', 'c']);
    expect(document.activeElement).toBe(button);
    expect(viewer.element.querySelector('th')).toHaveAttribute('aria-sort', 'ascending');
    button.click();
    expect(rows(viewer)).toEqual(['c', 'b', 'a']);
    button.click();
    expect(rows(viewer)).toEqual(['b', 'a', 'c']);
    viewer.destroy();
    host.remove();
  });

  it('pages the rows, and keeps the paging buttons in place', async () => {
    const text = `n\n${Array.from({ length: 5 }, (_, i) => `r${i + 1}`).join('\n')}`;
    const { host, viewer } = open({ source: new Blob([text]), pageSize: 2 });
    await vi.waitFor(() => expect(rows(viewer)).toEqual(['r1', 'r2']));
    const next = [...viewer.element.querySelectorAll('button')].find(
      (b) => b.textContent === 'Next page',
    );
    next.click();
    expect(rows(viewer)).toEqual(['r3', 'r4']);
    expect(viewer.element.querySelector('[role="status"]')).toHaveTextContent('Rows 3–4 of 5');
    next.click();
    expect(next.isConnected).toBe(true);
    expect(next.disabled).toBe(true);
    viewer.update({ pageSize: 10 });
    expect(rows(viewer)).toHaveLength(5);
    expect(next.isConnected).toBe(false);
    viewer.destroy();
    host.remove();
  });

  it('reads the file again for a new delimiter or header setting, and reports each table', async () => {
    const onReady = vi.fn();
    const { host, viewer } = open({ source: new Blob(['a;b\n1;2']), onReady });
    await vi.waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));
    expect(onReady).toHaveBeenLastCalledWith({ rowCount: 1, columnCount: 2, delimiter: ';' });
    viewer.update({ header: false });
    expect(onReady).toHaveBeenLastCalledWith({ rowCount: 2, columnCount: 2, delimiter: ';' });
    expect(viewer.element.querySelector('th')).toHaveTextContent('Column 1');
    viewer.update({ delimiter: ',' });
    expect(onReady).toHaveBeenLastCalledWith({ rowCount: 2, columnCount: 1, delimiter: ',' });
    viewer.update({ label: 'People' });
    expect(onReady).toHaveBeenCalledTimes(3);
    viewer.destroy();
    host.remove();
  });

  it('says when a file is empty, and reports a parse error', async () => {
    const onError = vi.fn();
    const { host, viewer } = open({ source: new Blob(['']), onError });
    await vi.waitFor(() => expect(viewer.element).toHaveTextContent('This file is empty.'));
    viewer.update({ source: new Blob(['a,b\n"unterminated']) });
    await vi.waitFor(() => expect(viewer.element.querySelector('tbody')).not.toBeNull());
    viewer.destroy();
    host.remove();
  });
});

describe('<fovea-table>', () => {
  it('turns header and sortable off with "false" and reads page-size', async () => {
    const el = document.createElement('fovea-table');
    el.setAttribute('header', 'false');
    el.setAttribute('sortable', 'false');
    el.setAttribute('page-size', '1');
    el.source = new Blob(['a,b\n1,2']);
    document.body.append(el);
    const root = () => el.shadowRoot.querySelector('[data-fovea-root]');
    await vi.waitFor(() => expect(root().querySelectorAll('tbody tr')).toHaveLength(1));
    expect(root().querySelector('th')).toHaveTextContent('Column 1');
    expect(root().querySelector('th button')).toBeNull();
    el.remove();
  });
});
