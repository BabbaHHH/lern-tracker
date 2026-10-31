import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditPilot, invocation, TEMPLATE_FILES } from './pilot-check.mjs';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const lock = JSON.parse(await readFile(join(project, 'deploy/pilot/source-lock.json'), 'utf8'));
const files = [...TEMPLATE_FILES, ...Object.keys(lock.files)];
async function fixture(work) {
  const root = await mkdtemp(join(tmpdir(), 'stex-pilot-static-'));
  try {
    for (const name of files) {
      await mkdir(dirname(join(root, name)), { recursive: true });
      await writeFile(join(root, name), await readFile(join(project, name)));
    }
    await work(root);
  } finally { await rm(root, { recursive: true, force: true }); }
}
async function replace(root, path, before, after) {
  const target = join(root, path), text = await readFile(target, 'utf8');
  assert.ok(text.includes(before)); await writeFile(target, text.replace(before, after));
}
const failed = (report, code) => report.checks.some(check => check.code === code && !check.passed);
// Synthetic fixtures only: demonstrate that fresh hashes cannot grant operation or hide contract drift.
async function rebindFixture(root, path) {
  const target = join(root, 'deploy/pilot/source-lock.json');
  const copy = JSON.parse(await readFile(target, 'utf8'));
  copy.files[path] = createHash('sha256').update(await readFile(join(root, path))).digest('hex');
  await writeFile(target, JSON.stringify(copy));
}

test('current: implemented runtime/search bindings pass statically without deployment or release claims', async () => {
  const report = await auditPilot(project);
  assert.equal(report.status, 'passed');
  assert.equal(report.onlineReady, false); assert.equal(report.offsiteInstalled, false);
  assert.equal(report.version, 2); assert.equal(report.unresolvedTemplates, true);
  assert.deepEqual(report.productionAuth, { sourceContractMatched: true, implementation: 'productionAccountRuntime',
    defaultClosed: true, operatorReleaseInTemplate: false });
  assert.deepEqual(report.searchWorker, { sourceContractMatched: true, persistence: 'configuredPersistence',
    publicAuthRuntimeIndependent: true, templateStartBlocked: true });
  assert.equal(report.serviceTemplatesBlocked, true); assert.equal(report.deploymentState, 'not_observed');
  assert.equal(report.environmentLoaded, false);
});
test('argument contract accepts only explicit absolute root/help without action modes', () => {
  assert.deepEqual(invocation(['--help']), { help: true });
  assert.deepEqual(invocation(['--root', '/synthetic/app']), { root: '/synthetic/app' });
  for (const argv of [[], ['--root', '.'], ['--root', '/'], ['--root', '/synthetic/../app'], ['--start'], ['--root', '/app', '--send']]) {
    assert.throws(() => invocation(argv), /^Error: Der statische Vorlagenabgleich/);
  }
});
test('unsupported environment activation flags and literal secret values are rejected', async () => fixture(async root => {
  await replace(root, 'deploy/pilot/env/core-secrets.env.example', '__AUTH_SECRET_BASE64URL_43_TO_128__', 'SYNTHETIC_SENTINEL_MUST_NOT_APPEAR');
  await writeFile(join(root, 'deploy/pilot/env/common.env.example'), 'STEX_AI_ENABLED=1\n', { flag: 'a' });
  const report = await auditPilot(root);
  assert.ok(failed(report, 'env_value:BETTER_AUTH_SECRET')); assert.ok(failed(report, 'env_names:common'));
  assert.ok(!JSON.stringify(report).includes('SYNTHETIC_SENTINEL_MUST_NOT_APPEAR'));
}));
test('proxy raw auth-link logging and wrong upload limit fail static contract', async () => fixture(async root => {
  await replace(root, 'deploy/pilot/nginx/stex-pilot.conf.in', '$time_iso8601 $status', '$request_uri $status');
  await replace(root, 'deploy/pilot/nginx/stex-pilot.conf.in', 'client_max_body_size 110m;', 'client_max_body_size 1g;');
  const report = await auditPilot(root);
  assert.ok(failed(report, 'proxy_logging')); assert.ok(failed(report, 'proxy_limits'));
}));
test('private path inside release, service command drift and removed preparation gate fail', async () => fixture(async root => {
  await replace(root, 'deploy/pilot/env/common.env.example', '/srv/stex/data/files', '/srv/stex/current/public/files');
  await replace(root, 'deploy/pilot/systemd/stex-pilot-mail.service.in', 'mail-dispatch.mts once', 'mail-dispatch.mts watch');
  await replace(root, 'deploy/pilot/systemd/stex-pilot-app.service.in', 'ExecStartPre=/usr/bin/false', '# gate removed');
  await replace(root, 'deploy/pilot/systemd/stex-pilot-backup@.service.in', 'ReadWritePaths=/srv/stex/data/files /srv/stex/backup-staging', 'ReadWritePaths=/srv/stex/current');
  const report = await auditPilot(root);
  for (const code of ['env_value:STEX_PRIVATE_FILE_ROOT', 'service:mail', 'service:app', 'service_paths:backup']) assert.ok(failed(report, code));
}));
test('current: production source drift cannot reuse old preparation evidence', async () => fixture(async root => {
  await replace(root, 'src/lib/server/auth/production-runtime.ts', 'production_auth_not_released', 'synthetic_changed_gate');
  const report = await auditPilot(root);
  assert.ok(failed(report, 'source:src/lib/server/auth/production-runtime.ts'));
  assert.ok(failed(report, 'production_runtime_binding')); assert.equal(report.productionAuth.defaultClosed, false);
}));
test('current: missing or active operator release in a template fails without leaking its value', async () => {
  for (const replacement of ['', 'STEX_AUTH_RUNTIME_RELEASE=operator-approved\n']) {
    await fixture(async root => {
      await replace(root, 'deploy/pilot/env/common.env.example', 'STEX_AUTH_RUNTIME_RELEASE=__OPERATOR_RELEASE_NOT_GRANTED__\n', replacement);
      const report = await auditPilot(root);
      assert.equal(report.status, 'failed');
      assert.ok(failed(report, replacement ? 'env_value:STEX_AUTH_RUNTIME_RELEASE' : 'env_names:common'));
      assert.equal(report.productionAuth.operatorReleaseInTemplate, Boolean(replacement));
      assert.ok(!JSON.stringify(report).includes('operator-approved'));
      assert.equal(report.onlineReady, false);
    });
  }
});
test('current: rehashing an inverted runtime gate does not prove the production contract', async () => fixture(async root => {
  const path = 'src/lib/server/auth/production-runtime.ts';
  await replace(root, path, 'STEX_AUTH_RUNTIME_RELEASE !== "operator-approved"', 'STEX_AUTH_RUNTIME_RELEASE === "operator-approved"');
  await rebindFixture(root, path);
  const report = await auditPilot(root);
  assert.ok(!failed(report, `source:${path}`)); assert.ok(failed(report, 'production_runtime_binding'));
  assert.equal(report.productionAuth.defaultClosed, false); assert.equal(report.onlineReady, false);
}));
test('current: rehashed search regression to account runtime is rejected independently of auth release', async () => fixture(async root => {
  const path = 'scripts/search/worker.mts';
  await replace(root, path, 'persistence: configuredPersistence,', 'persistence: accountRuntime,');
  await rebindFixture(root, path);
  const report = await auditPilot(root);
  assert.ok(!failed(report, `source:${path}`)); assert.ok(failed(report, 'search_operator_binding'));
  assert.equal(report.searchWorker.publicAuthRuntimeIndependent, false);
  assert.equal(report.productionAuth.defaultClosed, true);
}));
test('current: rehashed production persistence cannot silently choose a different database binding', async () => fixture(async root => {
  const path = 'scripts/data-migration/local-config.ts';
  await replace(root, path, 'config = production.database;', 'config = syntheticOtherDatabase;');
  await rebindFixture(root, path);
  const report = await auditPilot(root);
  assert.ok(!failed(report, `source:${path}`)); assert.ok(failed(report, 'shared_production_contract'));
  assert.equal(report.searchWorker.sourceContractMatched, false);
}));
test('current: template service/proxy gates, uninstalled timer and false approval record remain mandatory', async () => fixture(async root => {
  for (const name of ['app', 'search', 'mail', 'backup@']) {
    await replace(root, `deploy/pilot/systemd/stex-pilot-${name}.service.in`, 'ExecStartPre=/usr/bin/false', '# ExecStartPre=/usr/bin/false');
  }
  await replace(root, 'deploy/pilot/nginx/stex-pilot.conf.in', '    return 503;', '    # return 503;');
  await writeFile(join(root, 'deploy/pilot/systemd/stex-pilot-mail.timer.in'), '\n[Install]\nWantedBy=timers.target\n', { flag: 'a' });
  const target = join(root, 'deploy/pilot/release-record.example.json');
  const record = JSON.parse(await readFile(target, 'utf8'));
  for (const field of ['runtimeReleaseGranted', 'servicesInstalled', 'mailTimerInstalled', 'offsiteBackupInstalled',
    'linuxRuntimeVerified', 'publicAuthReleased', 'offsiteRestoreVerified', 'onlineReady']) record[field] = true;
  await writeFile(target, JSON.stringify(record));
  const report = await auditPilot(root);
  for (const name of ['app', 'search', 'mail', 'backup']) assert.ok(failed(report, `service:${name}`));
  for (const code of ['proxy_closed', 'mail_timer', 'release_record']) assert.ok(failed(report, code));
  assert.equal(report.serviceTemplatesBlocked, false); assert.equal(report.searchWorker.templateStartBlocked, false);
  assert.equal(report.onlineReady, false); assert.equal(report.deploymentState, 'not_observed');
}));
test('current: the new runtime/worker source binding stays read-only, excludes private files and refuses symlinks', async () => fixture(async root => {
  const privatePath = join(root, '.env.local'), sentinel = 'CURRENT_SYNTHETIC_PRIVATE_SENTINEL';
  await writeFile(privatePath, sentinel);
  const before = await Promise.all(files.map(name => readFile(join(root, name))));
  const originalFetch = globalThis.fetch;
  let network = 0;
  globalThis.fetch = async () => { network++; throw new Error('Synthetic network refusal'); };
  try {
    const report = await auditPilot(root);
    assert.equal(network, 0); assert.ok(!JSON.stringify(report).includes(sentinel));
    assert.ok(report.files.every(file => !file.path.includes('.env.local')));
    assert.deepEqual(await Promise.all(files.map(name => readFile(join(root, name)))), before);
    const target = join(root, 'scripts/search/worker-config.ts');
    await rm(target); await symlink(privatePath, target);
    await assert.rejects(auditPilot(root));
    assert.equal(await readFile(privatePath, 'utf8'), sentinel);
  } finally { globalThis.fetch = originalFetch; }
}));
test('migration conflict, timer mismatch and broad extra AI restrictions fail', async () => fixture(async root => {
  await writeFile(join(root, 'db/migrations/016_auth_mail_dispatch.sql'), '-- synthetic altered migration\n');
  await replace(root, 'deploy/pilot/systemd/stex-pilot-mail.timer.in', 'Unit=stex-pilot-mail.service', 'Unit=synthetic-other.service');
  await writeFile(join(root, 'deploy/pilot/nginx/stex-pilot.conf.in'), '\nlocation /api/account/ai-credential { return 403; }\n', { flag: 'a' });
  const report = await auditPilot(root);
  for (const code of ['source:db/migrations/016_auth_mail_dispatch.sql', 'mail_timer', 'no_extra_ai_scope']) assert.ok(failed(report, code));
}));
test('read-only/no-fetch audit excludes real environment/private names and does not follow template symlinks', async () => fixture(async root => {
  const privatePath = join(root, '.env.local'), sentinel = 'SYNTHETIC_PRIVATE_SENTINEL';
  await writeFile(privatePath, sentinel);
  const before = await Promise.all(files.map(name => readFile(join(root, name))));
  const originalFetch = globalThis.fetch;
  let network = 0;
  globalThis.fetch = async () => { network++; throw new Error('Synthetic network refusal'); };
  try {
    const report = await auditPilot(root);
    assert.equal(network, 0); assert.ok(!JSON.stringify(report).includes(sentinel));
    assert.ok(report.files.every(file => !file.path.includes('.env.local')));
    const after = await Promise.all(files.map(name => readFile(join(root, name))));
    assert.deepEqual(after, before); assert.equal(await readFile(privatePath, 'utf8'), sentinel);
    const target = join(root, 'deploy/pilot/env/core-secrets.env.example');
    await rm(target); await symlink(privatePath, target);
    await assert.rejects(auditPilot(root));
    assert.equal(await readFile(privatePath, 'utf8'), sentinel);
  } finally { globalThis.fetch = originalFetch; }
}));
