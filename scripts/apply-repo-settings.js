#!/usr/bin/env node
/**
 * Apply the standard security settings and the "main" ruleset to a repository.
 *
 * Usage: node scripts/apply-repo-settings.js [owner/repo]   (defaults to the current repo)
 * Requires: gh CLI authenticated with admin rights on the repository.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RULESET = fileURLToPath(new URL('../.github/rulesets/main.json', import.meta.url));

/**
 * Runs `gh` and returns trimmed stdout. Exits the process on failure.
 *
 * @param {string[]} args Arguments for gh.
 * @param {unknown} [payload] JSON body sent on stdin.
 * @returns {string} Trimmed stdout.
 */
function gh(args, payload) {
  const result = spawnSync('gh', args, {
    input: payload === undefined ? undefined : JSON.stringify(payload),
    encoding: 'utf8',
  });
  if (result.error || result.status !== 0) {
    const reason = result.error?.message ?? result.stderr.trim();
    console.error(`gh ${args.join(' ')} failed:\n${reason}`);
    process.exit(1);
  }
  return result.stdout.trim();
}

const repo =
  process.argv[2] ?? gh(['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner']);
console.log(`Configuring ${repo}`);

// Merge settings: squash only, delete head branches after merge.
gh([
  'api',
  '-X',
  'PATCH',
  `repos/${repo}`,
  '-F',
  'allow_squash_merge=true',
  '-F',
  'allow_merge_commit=false',
  '-F',
  'allow_rebase_merge=false',
  '-F',
  'delete_branch_on_merge=true',
]);

// Secret protection (secret scanning + push protection).
gh(['api', '-X', 'PATCH', `repos/${repo}`, '--input', '-'], {
  security_and_analysis: {
    secret_scanning: { status: 'enabled' },
    secret_scanning_push_protection: { status: 'enabled' },
  },
});

// Dependency graph is on by default for public repos.
// Dependabot alerts and security updates.
gh(['api', '-X', 'PUT', `repos/${repo}/vulnerability-alerts`]);
gh(['api', '-X', 'PUT', `repos/${repo}/automated-security-fixes`]);

// CodeQL default setup.
gh([
  'api',
  '-X',
  'PATCH',
  `repos/${repo}/code-scanning/default-setup`,
  '-f',
  'state=configured',
  '-f',
  'query_suite=default',
]);

// Let the Init workflow open its pull request.
gh([
  'api',
  '-X',
  'PUT',
  `repos/${repo}/actions/permissions/workflow`,
  '-f',
  'default_workflow_permissions=read',
  '-F',
  'can_approve_pull_request_reviews=true',
]);

// Label referenced by .github/release.yml (ignored if it already exists).
spawnSync(
  'gh',
  [
    'label',
    'create',
    'skip-changelog',
    '--repo',
    repo,
    '--description',
    'Exclude from release notes',
    '--color',
    'ededed',
  ],
  { encoding: 'utf8' },
);

// Ruleset (skips creation if one named "main" already exists).
const names = gh(['api', `repos/${repo}/rulesets`, '-q', '.[].name']).split('\n');
if (names.includes('main')) {
  console.log("Ruleset 'main' already exists; skipping");
} else {
  gh(['api', '-X', 'POST', `repos/${repo}/rulesets`, '--input', RULESET]);
}

console.log('Done. Complete the manual steps in docs/repo-setup.md.');
