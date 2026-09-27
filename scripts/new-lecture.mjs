#!/usr/bin/env node
// Creates demos/pde-lecture-<N>/ from demos/_template/ and links it from the course page.
// Development helper only; the site itself never runs Node.
//
//   node scripts/new-lecture.mjs 6 "Название лекции" "Lecture title"
//        [--question-ru "…" --question-en "…" --summary-ru "…" --summary-en "…"] [--course pages/cfd2026.md]

import { cp, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ROOT = new URL('../', import.meta.url);
export const PLACEHOLDERS = ['N', 'TITLE_RU', 'TITLE_EN', 'QUESTION_RU', 'QUESTION_EN', 'SUMMARY_RU', 'SUMMARY_EN'];

export function fillTemplate(text, values) {
  return text.replace(/\{\{([A-Z_]+)\}\}/g, (match, name) => {
    if (!(name in values)) throw new Error(`No value for placeholder ${match}`);
    return values[name];
  });
}

// Inserts a markdown list link after the last existing lecture demo link, keeping the list ordered.
export function addCourseLink(markdown, n, titleRu) {
  const link = `- [Лекция ${n}: ${titleRu.charAt(0).toLowerCase()}${titleRu.slice(1)}]({{ '/demos/pde-lecture-${n}/' | relative_url }})`;
  if (markdown.includes(`/demos/pde-lecture-${n}/`)) return markdown;
  const lines = markdown.split('\n');
  const last = lines.findLastIndex((line) => line.includes('/demos/pde-lecture-'));
  if (last === -1) return null;
  lines.splice(last + 1, 0, link);
  return lines.join('\n');
}

function parseArgs(argv) {
  const [n, titleRu, titleEn, ...rest] = argv;
  const options = { course: 'pages/cfd2026.md' };
  for (let i = 0; i < rest.length; i += 2) options[rest[i].replace(/^--/, '').replace(/-(\w)/g, (_, c) => c.toUpperCase())] = rest[i + 1];
  if (!/^\d+$/.test(n ?? '') || !titleRu || !titleEn) {
    throw new Error('Usage: node scripts/new-lecture.mjs <N> "<title ru>" "<title en>" [--question-ru …] [--course pages/cfd2026.md]');
  }
  return {
    n, options,
    values: {
      N: n, TITLE_RU: titleRu, TITLE_EN: titleEn,
      QUESTION_RU: options.questionRu ?? 'Главный вопрос лекции', QUESTION_EN: options.questionEn ?? 'The main question of the lecture',
      SUMMARY_RU: options.summaryRu ?? 'Краткое описание опытов.', SUMMARY_EN: options.summaryEn ?? 'A short description of the experiments.',
    },
  };
}

async function main() {
  const { n, options, values } = parseArgs(process.argv.slice(2));
  const target = new URL(`demos/pde-lecture-${n}/`, ROOT);
  if (await stat(target).then(() => true, () => false)) throw new Error(`${fileURLToPath(target)} already exists`);

  await cp(new URL('demos/_template/', ROOT), target, { recursive: true });
  const files = ['index.html', ...(await readdir(new URL('src/', target))).map((name) => `src/${name}`)];
  for (const file of files) {
    const url = new URL(file, target);
    await writeFile(url, fillTemplate(await readFile(url, 'utf8'), values));
  }

  const course = new URL(options.course, ROOT);
  const updated = addCourseLink(await readFile(course, 'utf8'), n, values.TITLE_RU);
  if (updated) await writeFile(course, updated);

  console.log(`Created demos/pde-lecture-${n}/ from the template.`);
  console.log(updated ? `Linked it from ${options.course}.` : `Add a link to it in ${options.course} by hand.`);
  console.log('Next: replace the two example experiments in src/catalog.js, src/labs.js and src/kernels.js,');
  console.log('then run `npm test` and open the page through ./preview.sh (see demos/README.md).');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
