import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npmCli = process.env.npm_execpath;
assert.ok(npmCli, 'Run via npm run verify:package or npm run consumer:check.');

const runConsumerCheck = process.argv.includes('--consumer');

function run(args, cwd = root, capture = false) {
  const result = spawnSync(process.execPath, args, {
    cwd,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `Command failed: ${args.join(' ')}`);
  return result.stdout ?? '';
}

async function walkFiles(dir, relBase = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await walkFiles(full, rel)));
    } else if (entry.isFile()) {
      results.push(rel);
    }
  }
  return results;
}

// 1. Audit dist/ for zero runtime @preptex/core imports and zero CSS imports in .d.ts
const distDir = path.join(root, 'dist');
const distFiles = await walkFiles(distDir);
const jsFiles = distFiles.filter((f) => f.endsWith('.js'));
const dtsFiles = distFiles.filter((f) => f.endsWith('.d.ts'));

assert.ok(jsFiles.length > 0, 'Expected compiled .js files in dist/');
assert.ok(dtsFiles.length > 0, 'Expected emitted .d.ts files in dist/');

const distFileSet = new Set(distFiles);

for (const rel of jsFiles) {
  const fullPath = path.join(distDir, rel);
  const code = await readFile(fullPath, 'utf8');
  assert.ok(
    !code.includes('@preptex/core'),
    `Runtime JS file dist/${rel} must not import @preptex/core (UI package must be pure React UI).`,
  );
  const sf = ts.createSourceFile(fullPath, code, ts.ScriptTarget.ESNext, false);
  const fileDir = path.dirname(fullPath);
  for (const stmt of sf.statements) {
    if (!(ts.isImportDeclaration(stmt) || ts.isExportDeclaration(stmt)) || !stmt.moduleSpecifier) {
      continue;
    }
    if (!ts.isStringLiteral(stmt.moduleSpecifier)) continue;
    const spec = stmt.moduleSpecifier.text;
    if (!spec.startsWith('./') && !spec.startsWith('../')) continue;
    assert.ok(
      spec.endsWith('.js') || spec.endsWith('.css'),
      `Relative specifier "${spec}" in dist/${rel} must include explicit .js or .css extension for strict ESM.`,
    );
    const resolvedRel = path.relative(distDir, path.resolve(fileDir, spec)).replaceAll('\\', '/');
    assert.ok(
      distFileSet.has(resolvedRel),
      `Broken relative import "${spec}" in dist/${rel} -> missing dist/${resolvedRel}.`,
    );
  }
}

for (const rel of dtsFiles) {
  const dts = await readFile(path.join(distDir, rel), 'utf8');
  assert.ok(
    !/import\s+['"][^'"]+\.css['"]/.test(dts),
    `Declaration file dist/${rel} must not contain side-effect .css imports.`,
  );
}

// 2. Verify npm pack contents
const packDryOut = run([npmCli, 'pack', '--ignore-scripts', '--dry-run', '--json'], root, true);
const packDryJson = JSON.parse(packDryOut);
const packedMeta = Array.isArray(packDryJson) ? packDryJson[0] : Object.values(packDryJson)[0];
assert.equal(packedMeta.name, '@preptex/ui');

const fileSet = new Set(packedMeta.files.map((f) => f.path));
const required = [
  'package.json',
  'README.md',
  'LICENSE',
  'dist/index.js',
  'dist/index.d.ts',
  'dist/styles/tokens.css',
  'dist/styles/bundle.css',
  'dist/docs/architecture.md',
  'dist/docs/integration.md',
  'dist/components/PrepTeXWorkspace.css',
  'dist/components/WorkspaceHeader.css',
];
for (const req of required) {
  assert.ok(fileSet.has(req), `Missing expected package file: ${req}`);
}

for (const name of fileSet) {
  assert.ok(
    !/^(src|scripts|type-tests|docs|node_modules|\.git)(\/|$)/.test(name) &&
      !/\.test\./.test(name),
    `Unexpected non-dist or test file in package: ${name}`,
  );
}

console.log(
  `Verified @preptex/ui package contents (${fileSet.size} files, 0 runtime @preptex/core imports).`,
);

// 3. Optional isolated consumer check (packs real tarball and verifies exports & TS 4.9.5 consumer)
if (runConsumerCheck) {
  const tempBase = path.resolve(tmpdir());
  const consumer = await mkdtemp(path.join(tempBase, 'preptex-ui-consumer-'));
  try {
    const packOut = run(
      [npmCli, 'pack', '--ignore-scripts', '--pack-destination', consumer, '--json'],
      root,
      true,
    );
    const packJson = JSON.parse(packOut);
    const packed = Array.isArray(packJson) ? packJson[0] : Object.values(packJson)[0];
    const archivePath = path.join(consumer, packed.filename);
    const integrity = `sha512-${createHash('sha512')
      .update(await readFile(archivePath))
      .digest('base64')}`;
    assert.equal(integrity, packed.integrity, 'Tarball SHA-512 integrity mismatch.');

    await writeFile(
      path.join(consumer, 'package.json'),
      JSON.stringify(
        {
          name: 'preptex-ui-isolated-consumer',
          private: true,
          type: 'module',
        },
        null,
        2,
      ),
    );

    const installedUiDir = path.join(consumer, 'node_modules/@preptex/ui');
    await mkdir(installedUiDir, { recursive: true });
    const tarResult = spawnSync(
      'tar',
      ['-xzf', archivePath, '-C', installedUiDir, '--strip-components=1'],
      { cwd: consumer, encoding: 'utf8', stdio: 'inherit' },
    );
    if (tarResult.error) throw tarResult.error;
    assert.equal(tarResult.status, 0, 'Failed to extract packed tarball.');

    for (const dep of [
      '@preptex/core',
      '@codemirror',
      '@lezer',
      '@types',
      'csstype',
      'react',
      'react-dom',
      'typescript',
    ]) {
      const target = path.join(root, 'node_modules', dep);
      const linkPath = path.join(consumer, 'node_modules', dep);
      await mkdir(path.dirname(linkPath), { recursive: true });
      await symlink(target, linkPath, 'dir');
    }

    const installedManifest = JSON.parse(
      await readFile(path.join(consumer, 'node_modules/@preptex/ui/package.json'), 'utf8'),
    );
    assert.deepEqual(Object.keys(installedManifest.exports), [
      '.',
      './tokens.css',
      './styles.css',
      './package.json',
    ]);

    // Verify package exports boundary blocks deep imports into dist/
    await writeFile(
      path.join(consumer, 'boundary-check.mjs'),
      [
        "import assert from 'node:assert/strict';",
        "await assert.rejects(",
        "  import('@preptex/ui/dist/components/PrepTeXWorkspace.js'),",
        "  { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' }",
        ");",
      ].join('\n'),
    );
    run(['boundary-check.mjs'], consumer);

    // Run TypeScript 4.9.5 consumer type-tests against installed @preptex/ui tarball
    await mkdir(path.join(consumer, 'type-tests'), { recursive: true });
    await cp(
      path.join(root, 'type-tests/public-contract.tsx'),
      path.join(consumer, 'type-tests/public-contract.tsx'),
    );
    await writeFile(
      path.join(consumer, 'tsconfig.json'),
      JSON.stringify(
        {
          compilerOptions: {
            target: 'es2020',
            lib: ['dom', 'dom.iterable', 'esnext'],
            module: 'esnext',
            moduleResolution: 'node',
            strict: true,
            noUncheckedIndexedAccess: true,
            skipLibCheck: false,
            noEmit: true,
            jsx: 'react-jsx',
          },
          include: ['type-tests/*.tsx'],
        },
        null,
        2,
      ),
    );
    run([path.join(consumer, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json'], consumer);
    console.log('Isolated consumer check passed (TypeScript 4.9.5, skipLibCheck: false, exports boundary).');
  } finally {
    const relative = path.relative(tempBase, path.resolve(consumer));
    if (relative.startsWith('preptex-ui-consumer-') && !relative.includes(path.sep)) {
      await rm(consumer, { recursive: true, force: true });
    }
  }
}
