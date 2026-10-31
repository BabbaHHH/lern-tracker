import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const BASE = 'deploy/pilot/';
const ENV = {
  'common': ['NODE_ENV', 'STEX_AUTH_MODE', 'STEX_AUTH_RUNTIME_RELEASE', 'STEX_LEARNING_MODE', 'BETTER_AUTH_URL', 'STEX_DATABASE_TLS', 'STEX_PRIVATE_FILE_ROOT'],
  'core-secrets': ['DATABASE_URL', 'BETTER_AUTH_SECRET', 'STEX_AUTH_MAIL_KEY'],
  'smtp-secrets': ['STEX_SMTP_HOST', 'STEX_SMTP_PORT', 'STEX_SMTP_TLS', 'STEX_SMTP_USER', 'STEX_SMTP_PASSWORD', 'STEX_SMTP_FROM_ADDRESS', 'STEX_SMTP_FROM_NAME'],
  'backup-secrets': ['STEX_AUTH_BACKUP_KEY', 'STEX_AI_CREDENTIAL_ENCRYPTION_KEY', 'STEX_AI_CREDENTIAL_FINGERPRINT_KEY'],
  'build': ['NODE_ENV', 'STEX_LEARNING_MODE'],
};
const COMMANDS = {
  app: '/usr/bin/node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3000',
  search: '/usr/bin/node --import tsx scripts/search/worker.mts watch',
  mail: '/usr/bin/node --import tsx scripts/auth/mail-dispatch.mts once',
  backup: '/usr/bin/node --import tsx scripts/data-migration/persistence.mts backup /srv/stex/backup-staging/%i',
};
const unitFile = name => `${BASE}systemd/stex-pilot-${name === 'backup' ? 'backup@' : name}.service.in`;
export const TEMPLATE_FILES = [
  ...Object.keys(ENV).map(name => `${BASE}env/${name}.env.example`),
  ...Object.keys(COMMANDS).map(unitFile),
  `${BASE}systemd/stex-pilot-mail.timer.in`, `${BASE}nginx/stex-pilot.conf.in`,
  `${BASE}nginx/proxy-common.conf.in`, `${BASE}nginx/test-allowlist.conf.in`,
  `${BASE}release-record.example.json`, `${BASE}source-lock.json`,
];
const SOURCE_FILES = ['package.json', 'package-lock.json', 'next.config.ts', 'src/app/layout.tsx',
  'src/lib/server/auth/production-config.ts', 'src/lib/server/auth/production-runtime.ts', 'src/lib/server/auth/runtime.ts',
  'src/lib/server/auth/smtp-config.ts', 'src/lib/server/auth/smtp-transport.ts',
  'src/lib/server/auth/mail-dispatcher.ts', 'src/lib/server/auth/mail-transport.ts',
  'src/lib/server/pilot-ai-guard.ts', 'src/app/api/ai/route.ts',
  'src/lib/server/catalog/http.ts', 'src/lib/catalog/limits.ts', 'src/lib/learning/documents-contract.ts',
  'src/lib/server/learning/documents-http.ts', 'src/lib/server/persistence/files.ts', 'src/lib/server/persistence/backup.ts',
  'scripts/data-migration/local-config.ts', 'scripts/data-migration/backup-config.ts', 'scripts/data-migration/persistence.mts',
  'scripts/auth/production-operator-config.ts', 'scripts/auth/operator.mts', 'scripts/auth/mail-dispatch.mts',
  'scripts/search/worker-config.ts', 'scripts/search/worker.mts'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
function fail() { throw new Error('Der statische Vorlagenabgleich konnte nicht sicher ausgeführt werden.'); }

/** Fixed public files only. No environment, app imports, subprocesses, network or writes. */
async function readFixed(root, name) {
  if (!/^[A-Za-z0-9_./@[\]-]+$/.test(name) || name.split('/').some(x => !x || x === '.' || x === '..' || x.startsWith('.'))) fail();
  let path = root;
  const parts = name.split('/');
  for (let i = 0; i < parts.length; i++) {
    path = join(path, parts[i]);
    const stat = await lstat(path);
    if (stat.isSymbolicLink() || (i < parts.length - 1 && !stat.isDirectory())) fail();
  }
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = await handle.stat();
    if (!before.isFile() || before.nlink !== 1 || before.size > 4 * 1024 * 1024) fail();
    const bytes = await handle.readFile();
    const after = await handle.stat();
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs) fail();
    return bytes;
  } finally { await handle.close(); }
}
function envEntries(body) {
  const entries = body.split('\n').filter(line => line && !line.startsWith('#')).map(line => {
    const match = /^([A-Z][A-Z0-9_]*)=(.+)$/.exec(line);
    if (!match) fail();
    return [match[1], match[2]];
  });
  if (new Set(entries.map(([key]) => key)).size !== entries.length) fail();
  return Object.fromEntries(entries);
}
export function invocation(argv) {
  if (argv.length === 1 && argv[0] === '--help') return { help: true };
  if (argv.length !== 2 || argv[0] !== '--root' || !isAbsolute(argv[1]) || resolve(argv[1]) !== argv[1] || argv[1] === '/') fail();
  return { root: argv[1] };
}
export async function auditPilot(root) {
  invocation(['--root', root]);
  if (!(await lstat(root)).isDirectory() || (await lstat(root)).isSymbolicLink()) fail();
  const bodies = new Map(), identities = [], checks = [];
  const check = (code, passed) => checks.push({ code, passed: Boolean(passed) });
  const passed = code => checks.some(item => item.code === code && item.passed);
  async function read(name) {
    const bytes = await readFixed(root, name);
    identities.push({ path: name, bytes: bytes.length, sha256: sha(bytes) });
    bodies.set(name, bytes.toString('utf8'));
    return bytes.toString('utf8');
  }
  for (const name of TEMPLATE_FILES) await read(name);
  const lock = JSON.parse(bodies.get(`${BASE}source-lock.json`));
  if (lock.format !== 'stex-pilot-template-source-lock' || lock.version !== 1 || !lock.files || typeof lock.files !== 'object') fail();
  const migrations = Object.keys(lock.files).filter(name => /^db\/migrations\/\d{3}_[a-z0-9_]+\.sql$/.test(name)).sort();
  if (migrations.length !== 16 || migrations.some((name, i) => Number(name.slice(14, 17)) !== i + 1)
    || !same(Object.keys(lock.files), [...SOURCE_FILES, ...migrations])) fail();
  for (const name of Object.keys(lock.files)) {
    if (!/^[a-f0-9]{64}$/.test(lock.files[name])) fail();
    check(`source:${name}`, sha(Buffer.from(await read(name))) === lock.files[name]);
  }
  const source = name => bodies.get(name);
  const allSource = SOURCE_FILES.map(source).join('\n');
  for (const [name, fields] of Object.entries(ENV)) {
    const entries = envEntries(bodies.get(`${BASE}env/${name}.env.example`));
    check(`env_names:${name}`, same(Object.keys(entries), fields) && fields.every(field => allSource.includes(field)));
    for (const [field, value] of Object.entries(entries)) {
      const fixed = { NODE_ENV: 'production', STEX_AUTH_MODE: 'production', STEX_LEARNING_MODE: 'account',
        STEX_AUTH_RUNTIME_RELEASE: '__OPERATOR_RELEASE_NOT_GRANTED__',
        BETTER_AUTH_URL: 'https://__PILOT_HOST__', STEX_DATABASE_TLS: 'loopback', STEX_PRIVATE_FILE_ROOT: '/srv/stex/data/files',
        STEX_SMTP_PORT: '587', STEX_SMTP_TLS: 'starttls', STEX_SMTP_FROM_NAME: '"Stex Tracker"' };
      check(`env_value:${field}`, fixed[field] ? value === fixed[field]
        : field === 'DATABASE_URL' ? value === 'postgresql://__DB_USER__:__DB_PASSWORD_URIENCODED__@127.0.0.1:5432/__DB_NAME__'
          : /^__[A-Z0-9_]+__$/.test(value));
    }
  }
  for (const [name, command] of Object.entries(COMMANDS)) {
    const text = bodies.get(unitFile(name));
    const directives = text.split('\n').filter(line => line && !line.startsWith('#'));
    check(`service:${name}`, directives.includes(`ExecStart=${command}`) && directives.includes('WorkingDirectory=/srv/stex/current')
      && directives.includes('ExecStartPre=/usr/bin/false') && directives.includes('Restart=no')
      && directives.includes('EnvironmentFile=/etc/stex/common.env') && directives.includes('EnvironmentFile=/etc/stex/core-secrets.env')
      && directives.includes('ProtectSystem=strict') && directives.includes('UMask=0077') && !directives.some(line => /^(ExecStartPost|ExecStopPost|ExecReload)=/.test(line)));
    check(`service_paths:${name}`, same(directives.filter(line => line.startsWith('Exec')), [
      'ExecStartPre=/usr/bin/false', `ExecStart=${command}`,
    ]) && same(directives.filter(line => line.startsWith('ReadWritePaths=')), name === 'app'
      ? ['ReadWritePaths=/srv/stex/data/files /srv/stex/cache'] : name === 'search' ? ['ReadWritePaths=/srv/stex/data/files']
        : name === 'backup' ? ['ReadWritePaths=/srv/stex/data/files /srv/stex/backup-staging'] : [])
      && directives.includes(`User=${name === 'mail' ? 'stex-mail' : 'stex-app'}`)
      && directives.includes(`Group=${name === 'mail' ? 'stex-mail' : 'stex-app'}`));
    const logging = name === 'mail' || name === 'backup' ? 'journal' : 'null';
    check(`service_logging:${name}`, directives.includes(`StandardOutput=${logging}`)
      && directives.includes(`StandardError=${logging}`));
    check(`service_env:${name}`, same(directives.filter(line => line.startsWith('EnvironmentFile=')), [
      'EnvironmentFile=/etc/stex/common.env', 'EnvironmentFile=/etc/stex/core-secrets.env',
      ...(name === 'mail' ? ['EnvironmentFile=/etc/stex/smtp-secrets.env'] : []),
      ...(name === 'backup' ? ['EnvironmentFile=/etc/stex/backup-secrets.env'] : []),
    ]));
  }
  const timer = bodies.get(`${BASE}systemd/stex-pilot-mail.timer.in`);
  check('mail_timer', timer.includes('OnUnitInactiveSec=60s') && timer.includes('Persistent=false')
    && timer.includes('Unit=stex-pilot-mail.service') && !/^\[Install\]/m.test(timer));
  const proxy = bodies.get(`${BASE}nginx/stex-pilot.conf.in`), common = bodies.get(`${BASE}nginx/proxy-common.conf.in`);
  const liveProxy = proxy.split('\n').filter(line => !line.trim().startsWith('#')).join('\n');
  check('proxy_logging', proxy.includes("log_format stex_pilot_safe '$time_iso8601 $status $body_bytes_sent $request_time';")
    && [...liveProxy.matchAll(/\$[a-z_][a-z0-9_]*/g)].every(([variable]) => ['$time_iso8601', '$status', '$body_bytes_sent', '$request_time'].includes(variable))
    && (proxy.match(/error_log \/dev\/null;/g) ?? []).length === 3);
  const allowlist = bodies.get(`${BASE}nginx/test-allowlist.conf.in`).split('\n').filter(line => !line.trim().startsWith('#')).join('\n');
  check('proxy_closed', /^\s*return 503;\s*$/m.test(liveProxy) && /^\s*ssl_reject_handshake on;\s*$/m.test(liveProxy)
    && /^allow __TEST_IP_OR_CIDR__;$/m.test(allowlist) && /^deny all;$/m.test(allowlist));
  check('proxy_limits', /location = \/api\/catalog\/import \{\s*client_max_body_size 110m;/.test(proxy)
    && /location = \/api\/learning\/documents \{[^}]*client_max_body_size 5m;/.test(proxy)
    && proxy.includes('client_max_body_size 1m;') && !proxy.includes('960s'));
  check('proxy_origin', common.includes('proxy_pass http://127.0.0.1:3000;') && common.includes('proxy_set_header Host __PILOT_HOST__;')
    && common.includes('proxy_set_header X-Forwarded-Proto https;') && common.includes('proxy_set_header X-Forwarded-For $remote_addr;')
    && common.includes('proxy_cache off;') && !common.includes('$proxy_add_x_forwarded_for'));
  check('no_extra_ai_scope', !/location[^\n]*(?:ai-credential|docs\/tag|openrouter|konto\/ki)/.test(proxy)
    && (proxy.match(/location\s/g) ?? []).length === 4 && !/return\s+(?:403|503)/.test(common));
  const record = JSON.parse(bodies.get(`${BASE}release-record.example.json`));
  check('release_record', record.migrationSequence === '001-016' && record.backupFormat === 4 && record.buildLearningMode === 'account'
    && record.targetOS === '__VERIFIED_SERVER_OS__' && record.targetPlatform === '__VERIFIED_LINUX_PLATFORM__'
    && record.runtimeEntry === 'productionAccountRuntime' && record.searchPersistenceEntry === 'configuredPersistence'
    && same(record.deferredProductionAi, ['planning', 'checkin', 'correction'])
    && ['runtimeReleaseGranted', 'servicesInstalled', 'mailTimerInstalled', 'offsiteBackupInstalled',
      'linuxRuntimeVerified', 'publicAuthReleased', 'offsiteRestoreVerified', 'onlineReady'].every(key => record[key] === false));
  const runtime = source('src/lib/server/auth/runtime.ts'), production = source('src/lib/server/auth/production-runtime.ts');
  const gate = production.indexOf('if (environment.STEX_AUTH_RUNTIME_RELEASE !== "operator-approved")');
  const validation = production.indexOf('const config = readProductionAuthConfig(environment, applicationRoot);');
  check('production_runtime_binding', runtime.includes('return productionAccountRuntime(env, currentRoot, dependencies);')
    && runtime.includes('"STEX_AUTH_RUNTIME_RELEASE"') && runtime.includes('fingerprint !== next')
    && /if \(environment\.STEX_AUTH_RUNTIME_RELEASE !== "operator-approved"\) \{\s*throw new AccountError\("production_auth_not_released",[^\n]*503\);\s*\}/.test(production)
    && validation >= 0 && validation < gate
    && gate >= 0 && gate < production.indexOf('database = dependencies.database(config.database);')
    && production.includes('dependencies.files(config.privateFileRoot)') && production.includes('await files.initialize();')
    && production.includes('baseURL: config.baseURL, secret: config.secret, mailKey: config.mailKey'));
  const worker = source('scripts/search/worker.mts'), workerConfig = source('scripts/search/worker-config.ts');
  check('search_operator_binding', worker.includes('persistence: configuredPersistence,')
    && worker.includes('searchWorkerInvocation(argv, env, applicationRoot)')
    && worker.includes('await dependencies.persistence(env, applicationRoot)') && !/\baccountRuntime\b/.test(worker)
    && workerConfig.includes('["once", "watch", "rebuild"]')
    && workerConfig.includes('productionOperatorConfig(env, applicationRoot)'));
  check('shared_production_contract', source('scripts/auth/production-operator-config.ts').includes('return readProductionAuthConfig(env, applicationRoot)')
    && source('scripts/data-migration/local-config.ts').includes('const production = productionOperatorConfig(env, applicationRoot);')
    && source('scripts/data-migration/local-config.ts').includes('config = production.database; fileRoot = production.privateFileRoot;'));
  check('narrow_ai_guard', source('src/lib/server/pilot-ai-guard.ts').includes('"planning" | "checkin" | "correction"')
    && source('src/app/api/ai/route.ts').includes('purpose === "planning"'));
  check('backup_binding', source('scripts/data-migration/backup-config.ts').includes('STEX_AUTH_BACKUP_KEY')
    && source('scripts/data-migration/backup-config.ts').includes('STEX_AI_CREDENTIAL_FINGERPRINT_KEY'));
  // Detect ordinary edits observed between reads. Not an atomic or hostile-FS snapshot.
  for (const identity of identities) check(`stable:${identity.path}`, sha(await readFixed(root, identity.path)) === identity.sha256);
  return { format: 'stex-pilot-template-audit', version: 2, status: checks.every(item => item.passed) ? 'passed' : 'failed',
    scope: 'static text/path/argument/source binding; no native service/proxy validation', checks, files: identities,
    unresolvedTemplates: true, servicesStarted: false, environmentLoaded: false, networkUsed: false,
    productionAuth: { sourceContractMatched: passed('production_runtime_binding'), implementation: 'productionAccountRuntime',
      defaultClosed: passed('production_runtime_binding'),
      operatorReleaseInTemplate: envEntries(bodies.get(`${BASE}env/common.env.example`)).STEX_AUTH_RUNTIME_RELEASE === 'operator-approved' },
    searchWorker: { sourceContractMatched: passed('search_operator_binding') && passed('shared_production_contract'),
      persistence: 'configuredPersistence', publicAuthRuntimeIndependent: passed('search_operator_binding'),
      templateStartBlocked: passed('service:search') && passed('service_paths:search') },
    serviceTemplatesBlocked: Object.keys(COMMANDS).every(name => passed(`service:${name}`) && passed(`service_paths:${name}`)),
    deploymentState: 'not_observed', onlineReady: false, offsiteInstalled: false };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = invocation(process.argv.slice(2));
    if (args.help) console.log('Statischer Abgleich: node scripts/host/pilot-check.mjs --root /absoluter/appordner. Keine Installation/Ausführung. Exit 1: passend, weiterhin blockiert; 2: Widerspruch; 3: unbrauchbarer Aufruf/Dateistand.');
    else { const report = await auditPilot(args.root); console.log(JSON.stringify(report, null, 2)); process.exitCode = report.status === 'passed' ? 1 : 2; }
  } catch { console.error('Der statische Vorlagenabgleich konnte nicht sicher ausgeführt werden.'); process.exitCode = 3; }
}
