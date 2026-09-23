import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const excludedPageDirs = new Set([
  '.git',
  '_includes',
  '_layouts',
  '_sass',
  '_site',
  'assets',
  'lib',
  'node_modules',
  'scripts',
  'test',
  'todo',
  'vendor',
]);

async function walk(directory, files = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!['.git', 'node_modules', '_site', '.jekyll-cache'].includes(entry.name)) {
        await walk(absolute, files);
      }
    } else if (entry.isFile()) {
      files.push(path.relative(root, absolute).split(path.sep).join('/'));
    }
  }
  return files;
}

function isPublishedPage(file) {
  const extension = path.posix.extname(file).toLowerCase();
  if (!['.html', '.md', '.markdown'].includes(extension)) return false;
  if (['README.md', 'AGENTS.md'].includes(path.posix.basename(file))) return false;
  return !file.split('/').some((part) => excludedPageDirs.has(part));
}

function liquidTargets(value) {
  const targets = [];
  for (const match of value.matchAll(/\{\{\s*(['"])(.*?)\1[^}]*\}\}/g)) {
    targets.push(match[2]);
  }
  for (const match of value.matchAll(/\{%\s*link\s+([^\s%]+)\s*%\}/g)) {
    targets.push(match[1]);
  }
  if (targets.length) return targets;
  if (value.includes('{{') || value.includes('{%')) return [];
  return [value];
}

function cssReferences(source) {
  const references = [];
  for (const match of source.matchAll(/url\(\s*(?:(['"])(.*?)\1|([^)]*?))\s*\)/gi)) {
    references.push(...liquidTargets((match[2] ?? match[3] ?? '').trim()));
  }
  for (const match of source.matchAll(/@import\s+(['"])(.*?)\1/gi)) {
    references.push(...liquidTargets(match[2]));
  }
  return references;
}

function documentReferences(file, source) {
  const references = [];
  const withoutScripts = source.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (script) => {
    return script.match(/^<script\b[^>]*>/i)?.[0] ?? '';
  });
  const withoutComments = withoutScripts.replace(/<!--[\s\S]*?-->/g, '');
  for (const match of withoutComments.matchAll(/(?:^|\s)(?:href|src|poster|action|formaction)\s*=\s*(["'])(.*?)\1/gi)) {
    references.push(...liquidTargets(match[2]));
  }
  for (const match of withoutComments.matchAll(/(?:^|\s)(?:href|src)\s*=\s*([^\s>]+)/gi)) {
    if (!match[1].startsWith('"') && !match[1].startsWith("'")) {
      references.push(...liquidTargets(match[1].replace(/\/$/, '')));
    }
  }
  if (/\.(?:md|markdown)$/i.test(file)) {
    for (const match of withoutComments.matchAll(/!?\[[^\]]*\]\(\s*(?:<([^>]+)>|(\{\{[\s\S]*?\}\})|([^\s)]+))/g)) {
      references.push(...liquidTargets(match[1] ?? match[2] ?? match[3]));
    }
  }
  for (const match of withoutComments.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    references.push(...cssReferences(match[1]));
  }
  return references;
}

function cleanPathname(target) {
  const value = target.trim().replaceAll('&amp;', '&');
  if (!value || value.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(value)) return null;
  if (/\{\{|\{%/.test(value)) return null;
  const pathname = value.split(/[?#]/, 1)[0];
  if (!pathname) return '';
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}

function candidatesFor(sourceFile, target) {
  const pathname = cleanPathname(target);
  if (pathname === null) return [];
  if (pathname === '') return [sourceFile];
  const trailingSlash = pathname.endsWith('/');
  const joined = pathname.startsWith('/')
    ? pathname.slice(1)
    : path.posix.join(path.posix.dirname(sourceFile), pathname);
  const normalized = path.posix.normalize(joined).replace(/^\.\//, '');
  if (normalized === '..' || normalized.startsWith('../')) return [normalized];
  if (trailingSlash || !path.posix.extname(normalized)) {
    const base = trailingSlash ? normalized : normalized;
    return [
      normalized,
      `${base}.html`,
      `${base}/index.html`,
      `${base}.md`,
      `${base}/index.md`,
    ];
  }
  if (/\.(?:md|markdown)$/i.test(normalized)) {
    return [normalized.replace(/\.(?:md|markdown)$/i, '.html')];
  }
  if (/\.html$/i.test(normalized)) {
    return [normalized, normalized.replace(/\.html$/i, '.md')];
  }
  return [normalized];
}

function makeRouteMap(pages) {
  const routes = new Map();
  for (const page of pages) {
    const emitted = page.replace(/\.(?:md|markdown)$/i, '.html');
    routes.set(emitted, page);
    if (/\/index\.html$/i.test(emitted)) {
      const directory = emitted.replace(/index\.html$/i, '');
      routes.set(directory, page);
      routes.set(directory.replace(/\/$/, ''), page);
    }
  }
  return routes;
}

async function inspectSite() {
  const files = await walk(root);
  const fileSet = new Set(files);
  const pages = files.filter(isPublishedPage);
  const pageSet = new Set(pages);
  const routeMap = makeRouteMap(pages);
  const contents = new Map();
  const broken = [];
  const graph = new Map(pages.map((page) => [page, new Set()]));

  async function read(file) {
    if (!contents.has(file)) contents.set(file, await readFile(path.join(root, file), 'utf8'));
    return contents.get(file);
  }

  function resolve(sourceFile, target) {
    for (const candidate of candidatesFor(sourceFile, target)) {
      if (routeMap.has(candidate)) {
        return { file: routeMap.get(candidate), page: routeMap.get(candidate) };
      }
      if (fileSet.has(candidate)) {
        if (pageSet.has(candidate) && /\.(?:md|markdown)$/i.test(candidate)) continue;
        return { file: candidate, page: pageSet.has(candidate) ? candidate : null };
      }
    }
    return null;
  }

  for (const page of pages) {
    const source = await read(page);
    const references = documentReferences(page, source);
    for (const target of references) {
      const localPath = cleanPathname(target);
      if (localPath === null) continue;
      const found = resolve(page, target);
      if (!found) {
        broken.push(`${page} -> ${target}`);
      } else if (found.page) {
        graph.get(page).add(found.page);
      }
    }
  }

  const navPath = '_includes/nav.html';
  const navSource = fileSet.has(navPath) ? await read(navPath) : '';
  const menu = navSource.match(/menu_paths\s*=\s*["']([^"']+)["']/);
  const entryPages = pages.filter((page) => ['index.html', 'index.md', 'index.markdown'].includes(page));
  for (const entry of entryPages) {
    for (const menuPath of (menu?.[1] ?? '').split(',').filter(Boolean)) {
      if (pageSet.has(menuPath)) graph.get(entry).add(menuPath);
      else if (routeMap.has(menuPath.replace(/\.(?:md|markdown)$/i, '.html'))) {
        graph.get(entry).add(routeMap.get(menuPath.replace(/\.(?:md|markdown)$/i, '.html')));
      }
    }
  }

  const reachable = new Set(entryPages);
  const queue = [...entryPages];
  while (queue.length) {
    const page = queue.shift();
    for (const next of graph.get(page) ?? []) {
      if (!reachable.has(next)) {
        reachable.add(next);
        queue.push(next);
      }
    }
  }
  const orphans = pages.filter((page) => page !== '404.html' && !reachable.has(page));
  return { broken, orphans };
}

const report = await inspectSite();

test('all local links and asset references resolve', () => {
  assert.equal(report.broken.length, 0, `Broken local references:\n${report.broken.join('\n')}`);
});

test('all published pages are reachable from the home page or site navigation', () => {
  assert.equal(report.orphans.length, 0, `Orphan pages:\n${report.orphans.join('\n')}`);
});
