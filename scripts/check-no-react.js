/* eslint-disable security/detect-non-literal-fs-filename -- paths come from the package's own dist/ */
// Fails if a built package bundles React instead of treating it as a peer dependency.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const MARKERS = [
  'react.production',
  'react.development',
  'react-dom.production',
  'react-dom.development',
  'react/cjs',
  'react-dom/cjs',
  '__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED',
  '__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE',
];

/**
 * Lists every JavaScript file under a directory.
 *
 * @param {string} dir Directory to walk.
 * @returns {string[]} File paths.
 */
function listJsFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return listJsFiles(path);
    return path.endsWith('.js') ? [path] : [];
  });
}

const dist = join(process.cwd(), 'dist');
if (!existsSync(dist)) {
  console.error('dist/ not found. Build the package first.');
  process.exit(1);
}

const offenders = listJsFiles(dist).filter((file) => {
  const source = readFileSync(file, 'utf8');
  return MARKERS.some((marker) => source.includes(marker));
});

if (offenders.length > 0) {
  console.error('React appears to be bundled in:');
  for (const file of offenders) console.error(`  ${file}`);
  process.exit(1);
}
console.log('OK: React is not bundled.');
