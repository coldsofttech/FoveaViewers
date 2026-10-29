/* eslint-disable security/detect-non-literal-fs-filename -- paths and keys come from this repository's own folders and files. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { Viewer, componentName, load, registry } from '@coldsofttech/fovea-viewers';

afterEach(() => cleanup());

const samples = join(import.meta.dirname, 'samples');
const sample = (name) => new File([readFileSync(join(samples, name))], name);

// What each sample shows once it is open.
const text = (pattern) => (container) => expect(container.textContent).toMatch(pattern);
const frame = (pattern) => (container) =>
  expect(container.querySelector('iframe')?.getAttribute('srcdoc') ?? '').toMatch(pattern);
const picture = (container) => expect(container.querySelector('img')).not.toBeNull();
const opened = (container) => expect(container.textContent.length).toBeGreaterThan(0);

const SAMPLES = {
  'sample.txt': text(/FOVEA VIEWERS - SAMPLE TEXT FILE/),
  'sample.log': opened,
  'sample.md': text(/Fovea Viewers sample/),
  'sample.js': text(/small module/),
  'sample.py': text(/small module/),
  'sample.cpp': text(/small program/),
  'sample.json': text(/fovea-viewers-sample/),
  'sample.yaml': text(/fovea-viewers-sample/),
  'sample.html': (container) =>
    expect(container.querySelector('iframe')?.getAttribute('srcdoc') ?? '').toContain(
      "default-src 'none'",
    ),
  'sample.rss': opened,
  'sample.atom': text(/Field notes/),
  'sample.csv': text(/Ada Lovelace/),
  'sample.tsv': text(/Ada Lovelace/),
  'sample.png': picture,
  'sample.svg': picture,
  'sample.eml': text(/Notes on the Analytical Engine/),
  'sample.xlsx': text(/Quarterly sales/),
  'sample.docx': frame(/Project update/),
  'sample.pptx': text(/Launch plan/),
  'sample.pdf': opened,
};

describe('the installed packages', () => {
  it.each(registry.map((entry) => entry.id))(
    'the %s viewer loads and exports its component',
    async (id) => {
      const module = await load(id);
      expect(typeof module[componentName(id)]).toBe('function');
      expect(module.meta.id).toBe(id);
    },
  );

  it.each(Object.entries(SAMPLES))(
    'opens %s',
    async (name, check) => {
      const { container } = render(<Viewer source={sample(name)} />);
      await waitFor(() => check(container), { timeout: 20000 });
      expect(container.querySelector('[role="alert"]')).toBeNull();
    },
    30000,
  );
});
