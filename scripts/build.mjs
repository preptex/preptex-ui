import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'src');
const distDir = path.join(root, 'dist');
const tscBin = path.join(root, 'node_modules/typescript/bin/tsc');

rmSync(distDir, { recursive: true, force: true });

if (!existsSync(tscBin)) {
  throw new Error('TypeScript compiler not found at node_modules/typescript/bin/tsc. Run npm install first.');
}

const tscResult = spawnSync(process.execPath, [tscBin, '-p', 'tsconfig.build.json'], {
  cwd: root,
  stdio: 'inherit',
});
if (tscResult.status !== 0) {
  process.exit(tscResult.status ?? 1);
}

function walkFiles(dir, predicate, relBase = '') {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const relPath = relBase ? `${relBase}/${entry.name}` : entry.name;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(fullPath, predicate, relPath));
    } else if (entry.isFile() && predicate(entry.name)) {
      results.push(relPath);
    }
  }
  return results.sort((a, b) => a.localeCompare(b));
}

function resolveRelativeEsmSpecifier(fileDir, specifier) {
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
    return null;
  }
  if (/\.(?:css|json|m?js|cjs)$/i.test(specifier)) {
    return null;
  }
  const absTarget = path.resolve(fileDir, specifier);
  if (existsSync(`${absTarget}.js`) || existsSync(`${absTarget}.d.ts`)) {
    return `${specifier}.js`;
  }
  if (existsSync(path.join(absTarget, 'index.js')) || existsSync(path.join(absTarget, 'index.d.ts'))) {
    return `${specifier.replace(/\/$/, '')}/index.js`;
  }
  return null;
}

function rewriteRelativeSpecifiersInFile(filePath) {
  const isDts = filePath.endsWith('.d.ts');
  const text = readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.ESNext, false);
  const fileDir = path.dirname(filePath);
  const replacements = [];

  for (const stmt of sourceFile.statements) {
    if (
      isDts &&
      ts.isImportDeclaration(stmt) &&
      !stmt.importClause &&
      stmt.moduleSpecifier &&
      ts.isStringLiteral(stmt.moduleSpecifier) &&
      stmt.moduleSpecifier.text.endsWith('.css')
    ) {
      let end = stmt.getEnd();
      if (text[end] === '\r') end += 1;
      if (text[end] === '\n') end += 1;
      replacements.push({
        start: stmt.getFullStart(),
        end,
        text: '',
      });
      continue;
    }

    let specNode = null;
    if ((ts.isImportDeclaration(stmt) || ts.isExportDeclaration(stmt)) && stmt.moduleSpecifier) {
      specNode = stmt.moduleSpecifier;
    }
    if (!specNode || !ts.isStringLiteral(specNode)) continue;
    const nextSpecifier = resolveRelativeEsmSpecifier(fileDir, specNode.text);
    if (!nextSpecifier) continue;

    const quote = text[specNode.getStart(sourceFile)] === '"' ? '"' : "'";
    replacements.push({
      start: specNode.getStart(sourceFile),
      end: specNode.getEnd(),
      text: `${quote}${nextSpecifier}${quote}`,
    });
  }

  if (replacements.length === 0) return;

  replacements.sort((a, b) => b.start - a.start);
  let nextText = text;
  for (const rep of replacements) {
    nextText = `${nextText.slice(0, rep.start)}${rep.text}${nextText.slice(rep.end)}`;
  }
  writeFileSync(filePath, nextText, 'utf8');
}

const cssFiles = walkFiles(srcDir, (name) => name.endsWith('.css'));
for (const relPath of cssFiles) {
  const from = path.join(srcDir, relPath);
  const to = path.join(distDir, relPath);
  mkdirSync(path.dirname(to), { recursive: true });
  cpSync(from, to);
}

const emittedModuleFiles = walkFiles(distDir, (name) => name.endsWith('.js') || name.endsWith('.d.ts'));
for (const relPath of emittedModuleFiles) {
  rewriteRelativeSpecifiersInFile(path.join(distDir, relPath));
}

const orderedForBundle = [
  'styles/tokens.css',
  'components/PrepTeXWorkspace.css',
  ...cssFiles.filter((f) => f !== 'styles/tokens.css' && f !== 'components/PrepTeXWorkspace.css'),
].filter((rel) => cssFiles.includes(rel));

const bundleChunks = orderedForBundle.map((rel) => {
  const contents = readFileSync(path.join(srcDir, rel), 'utf8').trimEnd();
  return `/* ${rel} */\n${contents}\n`;
});

const stylesDir = path.join(distDir, 'styles');
mkdirSync(stylesDir, { recursive: true });
writeFileSync(path.join(stylesDir, 'bundle.css'), bundleChunks.join('\n'), 'utf8');

const docsSrcDir = path.join(root, 'docs');
if (existsSync(docsSrcDir)) {
  cpSync(docsSrcDir, path.join(distDir, 'docs'), { recursive: true });
}

for (const required of [
  'index.js',
  'index.d.ts',
  'styles/tokens.css',
  'styles/bundle.css',
  'docs/architecture.md',
  'docs/integration.md',
]) {
  if (!existsSync(path.join(distDir, required))) {
    throw new Error(`Expected build output missing: dist/${required}`);
  }
}

console.log(`Built @preptex/ui into dist/ (${cssFiles.length} CSS files + ${emittedModuleFiles.length} JS/DTS files + docs).`);
