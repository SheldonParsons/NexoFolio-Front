import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawnSync, execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexofolio-deployment-'))
const source = path.join(root, 'source'),
  bin = path.join(root, 'bin'),
  store = path.join(root, 'oss')
const realGit = execFileSync('which', ['git'], { encoding: 'utf8' }).trim()
const hash = (data) => crypto.createHash('sha256').update(data).digest('hex')
const write = (p, value, mode) => {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, value, mode ? { mode } : undefined)
}
const tsv = (text) =>
  Object.fromEntries(
    text
      .trim()
      .split('\n')
      .map((line) => line.split('\t')),
  )
function run(command, args, options = {}) {
  const r = spawnSync(command, args, { cwd: source, env, encoding: 'utf8', ...options })
  if (options.failure) assert.notEqual(r.status, 0, 'operation should have failed')
  else assert.equal(r.status, 0, r.stderr || r.stdout)
  return r
}
const env = {
  ...process.env,
  PATH: `${bin}:${process.env.PATH}`,
  REAL_GIT: realGit,
  ORIGINAL_SOURCE: source,
  FAKE_OSS: store,
}
try {
  fs.mkdirSync(source, { recursive: true })
  fs.mkdirSync(bin)
  write(path.join(source, '.gitignore'), 'artifacts/\nnode_modules/\n.env.local\n')
  write(path.join(source, 'package.json'), '{"name":"fixture","version":"1.0.0"}\n')
  write(path.join(source, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n')
  write(path.join(source, 'src/message.ts'), 'captured-before-both-builds')
  write(path.join(source, '.env.local'), 'SYNTHETIC_SECRET=never-copy\n')
  write(
    path.join(source, 'upload-server.sh'),
    fs.readFileSync(path.join(project, 'upload-server.sh')),
    0o755,
  )
  write(
    path.join(source, 'deploy/update-front.sh'),
    fs.readFileSync(path.join(project, 'deploy/update-front.sh')),
    0o755,
  )
  write(
    path.join(bin, 'git'),
    '#!/usr/bin/env bash\nif [[ "$1" == rev-parse ]]; then printf "%040d\\n" 1; else exec "$REAL_GIT" "$@"; fi\n',
    0o755,
  )
  write(
    path.join(bin, 'pnpm'),
    `#!/usr/bin/env node
const fs=require('fs'),path=require('path'),a=process.argv.slice(2);
if(a[0]==='install'||a[0]==='typecheck')process.exit(0);
if(a[0]!=='exec'||a[1]!=='vite'||a[2]!=='build')process.exit(2);
const out=a[a.indexOf('--outDir')+1],base=a[a.indexOf('--base')+1];
fs.mkdirSync(path.join(out,'assets'),{recursive:true});
fs.writeFileSync(path.join(out,'index.html'),'<script type="module" src="'+base+'assets/main.js"></script>');
fs.writeFileSync(path.join(out,'assets/main.js'),JSON.stringify({base,api:process.env.VITE_API_BASE_URL,value:fs.readFileSync('src/message.ts','utf8')}));
fs.writeFileSync(path.join(out,'mcp.md'),base+'docs/mcp '+process.env.VITE_API_BASE_URL+'/mcp');
fs.writeFileSync(path.join(out,'api.md'),base+'docs/api');
if(base==='/')fs.writeFileSync(path.join(process.env.ORIGINAL_SOURCE,'src/message.ts'),'changed-after-public-build');
`,
    0o755,
  )
  write(
    path.join(bin, 'curl'),
    `#!/usr/bin/env node
const fs=require('fs'),path=require('path'),a=process.argv.slice(2),u=new URL(a.at(-1)),prefix='/linux_files/nexofolio/front/';
if(!u.pathname.startsWith(prefix))process.exit(22);
const file=path.join(process.env.FAKE_OSS,u.pathname.slice(prefix.length));
if(!fs.existsSync(file))process.exit(22);
fs.copyFileSync(file,a[a.indexOf('--output')+1]);
`,
    0o755,
  )
  write(
    path.join(bin, 'ossutil'),
    `#!/usr/bin/env node
const fs=require('fs'),path=require('path'),a=process.argv.slice(2),url=a[a[0]==='stat'?1:2];
const relative=new URL(url).pathname.replace(/^\\/linux_files\\/nexofolio\\/front\\//,'');
const dest=path.join(process.env.FAKE_OSS,relative);
if(a[0]==='stat'){if(fs.existsSync(dest))process.exit(0);console.error('NoSuchKey');process.exit(1);}
if(a[0]!=='cp')process.exit(2);
if(process.env.FAIL_UPLOAD&&relative.includes(process.env.FAIL_UPLOAD))process.exit(1);
fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(a[1],dest);
fs.appendFileSync(process.env.PUBLICATION_LOG,relative+'\\n');
`,
    0o755,
  )
  run(realGit, ['init', '-q'])
  run('bash', ['upload-server.sh', '--build-only'])
  const packages = fs
    .readdirSync(path.join(source, 'artifacts/front-releases'))
    .filter((x) => /^\d{8}T\d{6}Z-[a-f0-9]{12}$/.test(x))
  assert.equal(packages.length, 2, 'default command builds both environments')
  const releases = {}
  for (const id of packages) {
    const p = path.join(source, 'artifacts/front-releases', id),
      meta = tsv(fs.readFileSync(path.join(p, 'manifest.tsv'), 'utf8'))
    const asset = JSON.parse(
      execFileSync('unzip', ['-p', path.join(p, 'dist.zip'), 'dist/assets/main.js'], {
        encoding: 'utf8',
      }),
    )
    assert.equal(
      asset.value,
      'captured-before-both-builds',
      'both builds must use the same frozen source',
    )
    assert.equal(asset.base, meta.app_base)
    assert.equal(asset.api, meta.api_base)
    assert.ok(!fs.readFileSync(path.join(p, 'sources.tsv'), 'utf8').includes('.env.local'))
    const prefix = path.join(store, meta.environment === 'intranet' ? 'intranet' : ''),
      dest = path.join(prefix, 'releases', id)
    fs.mkdirSync(dest, { recursive: true })
    fs.copyFileSync(path.join(p, 'dist.zip'), path.join(dest, 'dist.zip'))
    const latest = fs.readFileSync(path.join(p, 'latest.txt'))
    write(path.join(prefix, 'latest.txt'), latest)
    write(path.join(dest, 'release.txt'), latest)
    releases[meta.environment] = { id, p, meta, prefix }
  }
  assert.equal(releases.public.meta.source_sha, releases.intranet.meta.source_sha)
  assert.equal(releases.public.meta.app_base, '/')
  assert.equal(releases.intranet.meta.app_base, '/nexofolio/')
  const updater = path.join(project, 'deploy/update-front.sh'),
    deploy = path.join(root, 'intranet-server')
  const serverEnv = { ...env, DEPLOY_DIR: deploy }
  run('bash', [updater, '--env', 'intranet'], { env: serverEnv })
  const original = fs.readlinkSync(path.join(deploy, 'current'))
  assert.equal(original, `releases/${releases.intranet.id}`)
  assert.equal(fs.readFileSync(path.join(deploy, '.environment'), 'utf8'), 'intranet\n')
  run('bash', [updater], { env: serverEnv })
  // curl downloads do not preserve execute permission. Exercise the documented
  // chmod-once flow using the downloaded copy and ./, as on the intranet host.
  const downloadedUpdater = path.join(deploy, 'update-front.sh')
  write(downloadedUpdater, fs.readFileSync(updater), 0o644)
  assert.equal(fs.statSync(downloadedUpdater).mode & 0o111, 0)
  fs.chmodSync(downloadedUpdater, 0o755)
  const directStatus = run('./update-front.sh', ['status'], { cwd: deploy, env: serverEnv })
  assert.ok(directStatus.stdout.includes('Environment: intranet'))
  run('./update-front.sh', [], { cwd: deploy, env: serverEnv })
  assert.equal(fs.readlinkSync(path.join(deploy, 'current')), original)
  run('bash', [updater, '--env', 'public'], { env: serverEnv, failure: true })
  assert.equal(fs.readlinkSync(path.join(deploy, 'current')), original)

  const modify = path.join(root, 'next-package')
  fs.mkdirSync(modify)
  execFileSync('unzip', ['-q', path.join(releases.intranet.p, 'dist.zip'), '-d', modify])
  write(path.join(modify, 'dist/assets/main.js'), 'second-intranet-version')
  function publishFixture(directory, mode = [], prefix = releases.intranet.prefix) {
    const zip = path.join(root, `fixture-${crypto.randomUUID()}.zip`)
    execFileSync('zip', ['-X', '-q', '-r', ...mode, zip, 'dist'], { cwd: directory })
    const bytes = fs.readFileSync(zip),
      checksum = hash(bytes),
      id = `20261019T000000Z-${checksum.slice(0, 12)}`
    write(path.join(prefix, 'releases', id, 'dist.zip'), bytes)
    write(path.join(prefix, 'latest.txt'), `${id} ${checksum}\n`)
    return id
  }
  const next = publishFixture(modify)
  run('bash', [updater], { env: serverEnv })
  assert.equal(fs.readlinkSync(path.join(deploy, 'current')), `releases/${next}`)
  assert.equal(fs.readlinkSync(path.join(deploy, 'previous')), original)
  run('bash', [updater, '--rollback'], { env: serverEnv })
  assert.equal(fs.readlinkSync(path.join(deploy, 'current')), original)

  // Correctly hashed public packages still cannot replace an intranet package.
  const publicZip = fs.readFileSync(path.join(releases.public.p, 'dist.zip'))
  write(path.join(releases.intranet.prefix, 'releases', releases.public.id, 'dist.zip'), publicZip)
  write(
    path.join(releases.intranet.prefix, 'latest.txt'),
    fs.readFileSync(path.join(releases.public.p, 'latest.txt')),
  )
  run('bash', [updater], { env: serverEnv, failure: true })
  assert.equal(fs.readlinkSync(path.join(deploy, 'current')), original)

  const falseId = `20261019T000000Z-${'f'.repeat(12)}`
  write(path.join(releases.intranet.prefix, 'latest.txt'), `${falseId} ${'f'.repeat(64)}\n`)
  write(path.join(releases.intranet.prefix, 'releases', falseId, 'dist.zip'), publicZip)
  run('bash', [updater], { env: serverEnv, failure: true })
  assert.equal(fs.readlinkSync(path.join(deploy, 'current')), original)

  // A symlink in a correctly hashed archive must be rejected before extraction.
  fs.symlinkSync('/etc/passwd', path.join(modify, 'dist/unsafe-link'))
  publishFixture(modify, ['-y'])
  run('bash', [updater], { env: serverEnv, failure: true })
  assert.equal(fs.readlinkSync(path.join(deploy, 'current')), original)
  assert.ok(!fs.existsSync(path.join(deploy, '.update-lock')))
  assert.ok(!fs.readdirSync(deploy).some((x) => x.startsWith('.update.')))

  const legacy = path.join(root, 'legacy-public')
  fs.mkdirSync(legacy)
  execFileSync('unzip', ['-q', path.join(releases.public.p, 'dist.zip'), '-d', legacy])
  fs.unlinkSync(path.join(legacy, 'dist/.nexofolio-release.tsv'))
  const legacyId = publishFixture(legacy, [], releases.public.prefix)
  const publicDeploy = path.join(root, 'public-server')
  run('bash', [updater], { env: { ...env, DEPLOY_DIR: publicDeploy } })
  assert.equal(fs.readlinkSync(path.join(publicDeploy, 'current')), `releases/${legacyId}`)
  // An existing installation created by the old public updater has no binding.
  // Upgrade it to a new public archive, then roll back to its legacy archive.
  fs.unlinkSync(path.join(publicDeploy, '.environment'))
  write(
    path.join(releases.public.prefix, 'latest.txt'),
    fs.readFileSync(path.join(releases.public.p, 'latest.txt')),
  )
  const publicEnv = { ...env, DEPLOY_DIR: publicDeploy }
  run('bash', [updater, '--env', 'public'], { env: publicEnv })
  assert.equal(fs.readFileSync(path.join(publicDeploy, '.environment'), 'utf8'), 'public\n')
  assert.equal(
    fs.readlinkSync(path.join(publicDeploy, 'current')),
    `releases/${releases.public.id}`,
  )
  assert.equal(fs.readlinkSync(path.join(publicDeploy, 'previous')), `releases/${legacyId}`)
  run('bash', [updater, '--rollback'], { env: publicEnv })
  assert.equal(fs.readlinkSync(path.join(publicDeploy, 'current')), `releases/${legacyId}`)

  const publicationStore = path.join(root, 'publication-oss'),
    publicationLog = path.join(root, 'publication.log')
  write(path.join(source, 'src/message.ts'), 'new-publication-source')
  const publicationEnv = {
    ...env,
    FAKE_OSS: publicationStore,
    PUBLICATION_LOG: publicationLog,
    OSSUTIL_BIN: path.join(bin, 'ossutil'),
  }
  const publicationResult = run('bash', ['upload-server.sh'], { env: publicationEnv })
  assert.ok(publicationResult.stdout.includes('chmod 755 /home/nexofolio/front/update-front.sh'))
  assert.ok(publicationResult.stdout.includes('cd /home/nexofolio/front && ./update-front.sh'))
  const uploads = fs.readFileSync(publicationLog, 'utf8').trim().split('\n')
  assert.deepEqual(uploads.slice(-2), ['latest.txt', 'intranet/latest.txt'])
  assert.ok(uploads.slice(0, -2).every((x) => x !== 'latest.txt' && x !== 'intranet/latest.txt'))
  const published = []
  for (const prefix of ['', 'intranet']) {
    const id = fs
      .readFileSync(path.join(publicationStore, prefix, 'latest.txt'), 'utf8')
      .split(' ')[0]
    published.push(
      tsv(
        fs.readFileSync(
          path.join(publicationStore, prefix, 'releases', id, 'manifest.tsv'),
          'utf8',
        ),
      ),
    )
  }
  assert.equal(published[0].environment, 'public')
  assert.equal(published[1].environment, 'intranet')
  assert.equal(published[0].source_sha, published[1].source_sha)

  const failedStore = path.join(root, 'failed-publication-oss')
  write(path.join(source, 'src/message.ts'), 'upload-failure-source')
  run('bash', ['upload-server.sh'], {
    env: { ...publicationEnv, FAKE_OSS: failedStore, FAIL_UPLOAD: 'intranet/releases/' },
    failure: true,
  })
  assert.ok(!fs.existsSync(path.join(failedStore, 'latest.txt')))
  assert.ok(!fs.existsSync(path.join(failedStore, 'intranet/latest.txt')))
  console.log(
    'PASS: same-source dual builds, private config exclusion, separate publication channels, latest ordering/failure retention, channel binding, direct execution after chmod, repeat update, rollback, legacy public upgrade/rollback, wrong-channel/checksum/symlink rejection.',
  )
} finally {
  fs.rmSync(root, { recursive: true, force: true })
}
