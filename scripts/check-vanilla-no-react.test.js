import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { findReactImports, importsOf } from './check-vanilla-no-react.js';

const dirs = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Writes a fake built package: `files` maps a path under dist to its source. */
function fakePackage(files) {
  const root = mkdtempSync(join(tmpdir(), 'fovea-check-'));
  dirs.push(root);
  for (const [path, source] of Object.entries(files)) {
    const full = join(root, 'dist', path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, source);
  }
  return root;
}
const exportsMap = {
  '.': { import: './dist/index.js' },
  './vanilla': { import: './dist/vanilla.js' },
  './element': './dist/element.js',
};

describe('importsOf', () => {
  it('finds static, re-export, side-effect and dynamic imports', () => {
    const source = `
      import a from './a.js';
      import { b, c } from "react";
      export { d } from './d.js';
      export * from './e.js';
      import './side.js';
      const m = await import('./lazy.js');
    `;
    expect(importsOf(source)).toEqual([
      './a.js',
      'react',
      './d.js',
      './e.js',
      './side.js',
      './lazy.js',
    ]);
  });
});

describe('findReactImports', () => {
  it('passes when the React-free entries reach no React, even though the root does', () => {
    const root = fakePackage({
      'index.js': "import { jsx } from 'react/jsx-runtime';",
      'vanilla.js': "import { shared } from './shared.js'; import x from 'dompurify';",
      'shared.js': 'export const shared = 1;',
      'element.js': "import './vanilla.js';",
    });
    expect(findReactImports(root, exportsMap)).toEqual([]);
  });

  it('catches React imported directly', () => {
    const root = fakePackage({
      'vanilla.js': "import { useState } from 'react';",
      'element.js': '',
    });
    expect(findReactImports(root, exportsMap)).toEqual(['./vanilla -> react']);
  });

  it('catches React reached through a shared chunk, with the path to it', () => {
    const root = fakePackage({
      'vanilla.js': "import './a.js';",
      'a.js': "export * from './chunks/b.js';",
      'chunks/b.js': "import { createRoot } from 'react-dom/client';",
      'element.js': '',
    });
    expect(findReactImports(root, exportsMap)).toEqual([
      './vanilla -> ./a.js -> ./chunks/b.js -> react-dom/client',
    ]);
  });

  it('catches the React halves of the shared package but not its vanilla ones', () => {
    const root = fakePackage({
      'vanilla.js': `
        import { Viewer } from '@coldsofttech/fovea-viewers';
        import { useText } from '@coldsofttech/fovea-viewers/core';
        import { createShell } from '@coldsofttech/fovea-viewers/core/vanilla';
      `,
      'element.js': '',
    });
    expect(findReactImports(root, exportsMap)).toEqual([
      './vanilla -> @coldsofttech/fovea-viewers',
      './vanilla -> @coldsofttech/fovea-viewers/core',
    ]);
  });

  it('copes with import cycles and reports a missing build', () => {
    const root = fakePackage({
      'vanilla.js': "import './b.js';",
      'b.js': "import './vanilla.js';",
    });
    expect(findReactImports(root, exportsMap)).toEqual([
      expect.stringMatching(/^\.\/element: .*does not exist/),
    ]);
  });

  it('ignores a package with no React-free entries', () => {
    expect(findReactImports(fakePackage({}), { '.': './dist/index.js' })).toEqual([]);
  });
});
