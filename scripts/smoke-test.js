/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- paths and keys come from this repository's own folders and files. */
// Installs the packed packages in a fresh app, as a user would, then builds the app and renders the
// demo samples in it. Run `npm run build` first. The app is made in `.temp/smoke`.
//
//   node scripts/smoke-test.js [--react 18|19]
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = join(root, '.temp', 'smoke');
const tarballs = join(app, 'tarballs');
const react = process.argv.includes('--react')
  ? process.argv[process.argv.indexOf('--react') + 1]
  : '19';
if (!['18', '19'].includes(react)) {
  console.error('--react must be 18 or 19.');
  process.exit(1);
}

/**
 * @param {string} command
 * @param {string[]} args
 * @param {string} cwd
 * @returns {string}
 */
function run(command, args, cwd) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    shell: true,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}

const rootPackage = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const packages = readdirSync(join(root, 'packages'))
  .map((name) => join(root, 'packages', name))
  .filter((dir) => existsSync(join(dir, 'package.json')));

const missing = packages.filter((dir) => !existsSync(join(dir, 'dist', 'index.js')));
if (missing.length > 0) {
  console.error('Build the packages first with `npm run build`. Not built:');
  for (const dir of missing) console.error(`  ${dir}`);
  process.exit(1);
}

rmSync(app, { recursive: true, force: true });
mkdirSync(tarballs, { recursive: true });

// Pack each package exactly as `npm publish` would.
const files = packages.map((dir) => {
  const [pack] = JSON.parse(
    run('npm', ['pack', '--json', '--pack-destination', JSON.stringify(tarballs)], dir),
  );
  return join(tarballs, pack.filename);
});

// The app is the template plus the demo's sample files.
cpSync(join(root, 'scripts', 'smoke'), app, { recursive: true });
cpSync(join(root, 'examples', 'demo', 'public', 'samples'), join(app, 'samples'), {
  recursive: true,
});
cpSync(join(root, 'examples', 'demo', 'public', 'samples'), join(app, 'public', 'samples'), {
  recursive: true,
});

const dev = rootPackage.devDependencies;
const pick = (/** @type {string[]} */ names) => Object.fromEntries(names.map((n) => [n, dev[n]]));
writeFileSync(
  join(app, 'package.json'),
  JSON.stringify(
    {
      name: 'smoke-app',
      private: true,
      type: 'module',
      dependencies: {
        ...Object.fromEntries(
          files.map((file, i) => [
            JSON.parse(readFileSync(join(packages[i], 'package.json'), 'utf8')).name,
            `file:${file.replaceAll('\\', '/')}`,
          ]),
        ),
        react: `^${react}`,
        'react-dom': `^${react}`,
      },
      devDependencies: pick([
        '@testing-library/dom',
        '@testing-library/react',
        '@vitejs/plugin-react',
        'jsdom',
        'vite',
        'vitest',
      ]),
    },
    null,
    2,
  ),
);

run('npm', ['install', '--no-audit', '--no-fund'], app);
console.log(run('npx', ['vite', 'build'], app));
console.log(run('npx', ['vitest', 'run'], app));
console.log(
  `\nOK: ${packages.length} packages installed from their tarballs, built and rendered with React ${react}.`,
);
