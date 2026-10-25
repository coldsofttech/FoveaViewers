// Fails if a package tarball contains anything other than build output and package metadata.
import { execFileSync } from 'node:child_process';

const ALLOWED = /^(dist\/|package\.json$|README\.md$|LICENSE$)/;

const [pack] = JSON.parse(
  execFileSync('npm', ['pack', '--dry-run', '--json'], { encoding: 'utf8', shell: true }),
);
const unexpected = pack.files.map((file) => file.path).filter((path) => !ALLOWED.test(path));

if (unexpected.length > 0) {
  console.error('Unexpected files in the package tarball:');
  for (const path of unexpected) console.error(`  ${path}`);
  process.exit(1);
}
console.log(`OK: ${pack.files.length} files in the tarball.`);
