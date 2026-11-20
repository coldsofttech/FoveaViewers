/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- paths and keys come from the package's own dist/ and exports map */
// Fails if a React-free entry point (`/vanilla`, `/element`, `core/vanilla`, `core/element`) can
// reach React. It follows every import from those entries through the built files, so a shared
// chunk that pulls in a React component is caught as well as a direct import.
//
// Run it from a package directory after building it. A package with none of these entries passes.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const ENTRIES = ['./vanilla', './element', './core/vanilla', './core/element'];

/** Imports that mean React: React itself, or the React halves of the shared package. */
const isReact = (specifier) =>
  /^react(-dom)?($|\/)/.test(specifier) ||
  specifier === '@coldsofttech/fovea-viewers' ||
  specifier === '@coldsofttech/fovea-viewers/core';

const IMPORT =
  /(?:\bimport|\bexport)\s[^'";]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;

/**
 * @param {string} source JavaScript text.
 * @returns {string[]} Every module specifier it imports.
 */
export function importsOf(source) {
  return [...source.matchAll(IMPORT)].map((match) => match[1] ?? match[2] ?? match[3]);
}

/**
 * Walks the imports reachable from the entry files.
 *
 * @param {string} packageDir
 * @param {Record<string, any>} exportsMap The package's `exports`.
 * @returns {string[]} A description of each way React is reached: the entry, the chain of files and
 *   the import.
 */
export function findReactImports(packageDir, exportsMap) {
  const problems = [];
  for (const entry of ENTRIES) {
    const target = exportsMap[entry];
    const file = typeof target === 'string' ? target : target?.import;
    if (!file) continue;

    const start = resolve(packageDir, file);
    if (!existsSync(start)) {
      problems.push(`${entry}: ${file} does not exist. Build the package first.`);
      continue;
    }
    const seen = new Set([start]);
    const queue = [[start, [entry]]];
    while (queue.length > 0) {
      const [current, chain] = queue.shift();
      for (const specifier of importsOf(readFileSync(current, 'utf8'))) {
        if (isReact(specifier)) {
          problems.push(`${[...chain, specifier].join(' -> ')}`);
        } else if (specifier.startsWith('.')) {
          const next = resolve(dirname(current), specifier);
          if (existsSync(next) && !seen.has(next)) {
            seen.add(next);
            queue.push([next, [...chain, specifier]]);
          }
        }
      }
    }
  }
  return problems;
}

// Run as a script (not when imported by a test).
if (import.meta.url === new URL(process.argv[1] ?? '', 'file://').href) {
  const packageDir = process.cwd();
  const { exports: exportsMap = {} } = JSON.parse(
    readFileSync(join(packageDir, 'package.json'), 'utf8'),
  );
  const present = ENTRIES.filter((entry) => entry in exportsMap);
  const problems = findReactImports(packageDir, exportsMap);
  if (problems.length > 0) {
    console.error('A React-free entry point can reach React:');
    for (const problem of problems) console.error(`  ${problem}`);
    process.exit(1);
  }
  console.log(
    present.length > 0
      ? `OK: ${present.join(', ')} do not import React.`
      : 'OK: no React-free entry points to check.',
  );
}
