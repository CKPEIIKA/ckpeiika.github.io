#!/usr/bin/env node
// Local grading registry for the ML course: what to check, what is checked, what is graded.
// The registry lives in grading/registry.csv (gitignored, never published); the roster
// (_data/ml_students.csv) only seeds it. Run `node scripts/grading.mjs help`.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const rosterPath = resolve(root, '_data/ml_students.csv')
const registryPath = resolve(root, 'grading/registry.csv')
const studentsPath = resolve(root, 'grading/students.csv')

export const STATUSES = ['todo', 'checked', 'graded']
export const COLUMNS = ['student_id', 'task', 'status', 'grade', 'repo', 'github', 'variant', 'note', 'updated']
export const STUDENT_COLUMNS = ['student_id', 'github', 'via', 'note']
const SYMBOL = { todo: '·', checked: '✓', graded: '★' }

// Minimal CSV for our own files: quoted fields, doubled quotes, commas and newlines inside quotes.
export function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      rows.push(row); row = []
    } else field += c
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  const [header = [], ...body] = rows.filter((r) => r.length > 1 || r[0] !== '')
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])))
}

export function toCsv(records, columns = COLUMNS) {
  const cell = (v) => (/[",\n\r]/.test(String(v)) ? `"${String(v).replaceAll('"', '""')}"` : String(v))
  return [columns.join(','), ...records.map((r) => columns.map((c) => cell(r[c] ?? '')).join(','))].join('\n') + '\n'
}

// Roster -> registry rows. A task marked completed in the roster is already graded;
// an assigned one is waiting to be checked; closed or missing tasks get no row.
export function seedFromRoster(roster, today) {
  const out = []
  for (const s of roster) {
    if (!s.student_id || s.student_id === 'stxxxxx') continue
    for (let n = 0; n <= 5; n++) {
      const status = s[`task${n}_status`]
      if (status !== 'completed' && status !== 'assigned') continue
      out.push({
        student_id: s.student_id,
        task: String(n),
        status: status === 'completed' ? 'graded' : 'todo',
        grade: status === 'completed' ? '+' : '',
        repo: '',
        github: '',
        variant: n === 0 ? 'ознакомительная' : s[`task${n}_title`] ?? '',
        note: '',
        updated: today,
      })
    }
  }
  return out
}

// Adds rows that are missing and never touches existing ones.
export function mergeRows(existing, seeded) {
  const key = (r) => `${r.student_id}/${r.task}`
  const have = new Set(existing.map(key))
  return [...existing, ...seeded.filter((r) => !have.has(key(r)))]
}

export function setStatus(rows, { student, task, status, grade, repo, note }, today) {
  if (!STATUSES.includes(status)) throw new Error(`status must be one of ${STATUSES.join(', ')}`)
  let row = rows.find((r) => r.student_id === student && r.task === String(task))
  if (!row) {
    row = { student_id: student, task: String(task), status, grade: '', repo: '', github: '', variant: '', note: '', updated: today }
    rows.push(row)
  }
  row.status = status
  if (grade !== undefined) row.grade = grade
  if (repo !== undefined) row.repo = repo
  if (note !== undefined) row.note = note
  row.updated = today
  return row
}

// Which task a repository name belongs to: "ML-task1", "zadanie-1", "problem_2", "задание 3".
// Per-student facts: GitHub account and how they hand work in (github / zip / other).
export function setStudent(rows, { student, github, via, note }) {
  let row = rows.find((r) => r.student_id === student)
  if (!row) {
    row = { student_id: student, github: '', via: '', note: '' }
    rows.push(row)
  }
  if (github !== undefined) row.github = github
  if (via !== undefined) row.via = via
  if (note !== undefined) row.note = note
  return row
}

export function taskOfRepo(name) {
  if (/(?:task|zadanie|задани[ея])[-_ ]?(?:zero|ноль)/i.test(name)) return '0'
  const m = /(?:task|zadanie|problem|задани[ея]|задача)[-_ ]?(\d)\b/i.exec(name)
  return m ? m[1] : null
}

// Fills the GitHub profile of every row of a student and the repo link of the matching task.
// Returns the ML-looking repositories that matched no task so the caller can show them.
export function applyGithub(rows, student, repos, today) {
  const unmatched = []
  for (const r of rows.filter((x) => x.student_id === student)) r.github = `https://github.com/${student}`
  for (const repo of repos) {
    const task = taskOfRepo(repo.name)
    const row = task && rows.find((r) => r.student_id === student && r.task === task)
    if (row) {
      if (!row.repo) row.repo = repo.html_url
      row.updated = today
    } else if (/ml|task|zadan|задан|mechanic|hw\d|rul|aero/i.test(repo.name)) unmatched.push(repo.html_url)
  }
  return unmatched
}

export function matrix(rows) {
  const students = [...new Set(rows.map((r) => r.student_id))].sort()
  const tasks = [...new Set(rows.map((r) => r.task))].sort()
  const lines = [`${'student'.padEnd(10)} ${tasks.map((t) => `T${t}`.padEnd(3)).join('')}`]
  for (const s of students) {
    const cells = tasks.map((t) => {
      const r = rows.find((x) => x.student_id === s && x.task === t)
      return (r ? SYMBOL[r.status] ?? '?' : '-').padEnd(3)
    })
    lines.push(`${s.padEnd(10)} ${cells.join('')}`)
  }
  lines.push('', `${SYMBOL.todo} to check   ${SYMBOL.checked} checked   ${SYMBOL.graded} graded   - none`)
  return lines.join('\n')
}

const readRegistry = () => (existsSync(registryPath) ? parseCsv(readFileSync(registryPath, 'utf8')) : [])
const writeRegistry = (rows) => {
  mkdirSync(dirname(registryPath), { recursive: true })
  writeFileSync(registryPath, toCsv(rows))
}
const todayIso = () => new Date().toISOString().slice(0, 10)

function flags(args) {
  const out = { _: [] }
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) out[args[i].slice(2)] = args[++i]
    else out._.push(args[i])
  }
  return out
}

const HELP = `grading registry (${registryPath})

  init                         add roster students/tasks that are not in the registry yet
  matrix                       students x tasks: · to check, ✓ checked, ★ graded
  list [status] [--student id] rows, default: everything not graded yet
  set <student> <task> <status> [--grade X] [--repo URL] [--note TEXT]
                               status: ${STATUSES.join(' | ')}; task: 0-4, or "course"
  student <id> [--github URL] [--via github|zip|...] [--note TEXT]
                               per-student GitHub account and how work arrives
  who                          one line per student: GitHub, delivery channel
  links                        look up each student's GitHub account and repos (public API, no token)
  summary                      counts per status
`

async function main(argv) {
  const [cmd = 'help', ...rest] = argv
  const f = flags(rest)
  if (cmd === 'init') {
    const roster = parseCsv(readFileSync(rosterPath, 'utf8'))
    const before = readRegistry()
    const after = mergeRows(before, seedFromRoster(roster, todayIso()))
    writeRegistry(after)
    console.log(`registry: ${before.length} -> ${after.length} rows`)
  } else if (cmd === 'matrix') {
    console.log(matrix(readRegistry()))
  } else if (cmd === 'list') {
    const want = f._[0]
    const rows = readRegistry().filter((r) => (want ? r.status === want : r.status !== 'graded') && (!f.student || r.student_id === f.student))
    for (const r of rows) console.log([r.student_id, `T${r.task}`, r.status, r.grade, r.variant, r.repo || r.github, r.note].filter((x) => x !== '').join('  '))
    console.log(`${rows.length} rows`)
  } else if (cmd === 'set') {
    const [student, task, status] = f._
    if (!student || task === undefined || !status) throw new Error('usage: set <student> <task> <status> [--grade X] [--repo URL] [--note TEXT]')
    const rows = readRegistry()
    const row = setStatus(rows, { student, task, status, grade: f.grade, repo: f.repo, note: f.note }, todayIso())
    writeRegistry(rows)
    console.log(`${row.student_id} T${row.task}: ${row.status}${row.grade ? ` (${row.grade})` : ''}`)
  } else if (cmd === 'student') {
    const [student] = f._
    if (!student) throw new Error('usage: student <id> [--github URL] [--via github|zip|...] [--note TEXT]')
    const rows = existsSync(studentsPath) ? parseCsv(readFileSync(studentsPath, 'utf8')) : []
    const row = setStudent(rows, { student, github: f.github, via: f.via, note: f.note })
    mkdirSync(dirname(studentsPath), { recursive: true })
    writeFileSync(studentsPath, toCsv(rows, STUDENT_COLUMNS))
    console.log([row.student_id, row.via, row.github].filter((x) => x !== '').join('  '))
  } else if (cmd === 'who') {
    const rows = existsSync(studentsPath) ? parseCsv(readFileSync(studentsPath, 'utf8')) : []
    const byId = new Map(rows.map((r) => [r.student_id, r]))
    for (const id of [...new Set(readRegistry().map((r) => r.student_id))].sort()) {
      const r = byId.get(id) || {}
      console.log([id.padEnd(9), (r.via || '?').padEnd(7), r.github || '', r.note || ''].join(' ').trimEnd())
    }
  } else if (cmd === 'links') {
    // Unauthenticated GitHub allows 60 requests an hour; GITHUB_TOKEN (optional) raises that.
    const headers = process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}
    const rows = readRegistry()
    for (const student of [...new Set(rows.map((r) => r.student_id))].sort()) {
      const response = await fetch(`https://api.github.com/users/${student}/repos?per_page=100`, { headers })
      if (response.status === 404) { console.log(`${student}  no GitHub account`); continue }
      if (response.status === 403 || response.status === 429) {
        console.error('GitHub rate limit reached; the links found so far are saved. Retry later or set GITHUB_TOKEN.')
        process.exitCode = 1
        break
      }
      if (!response.ok) throw new Error(`${student}: GitHub answered HTTP ${response.status}`)
      const unmatched = applyGithub(rows, student, await response.json(), todayIso())
      writeRegistry(rows)
      console.log(`${student}  https://github.com/${student}${unmatched.length ? `  other repos: ${unmatched.join(' ')}` : ''}`)
    }
  } else if (cmd === 'summary') {
    const rows = readRegistry()
    for (const s of STATUSES) console.log(`${s.padEnd(8)} ${rows.filter((r) => r.status === s).length}`)
  } else console.log(HELP)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main(process.argv.slice(2))
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
