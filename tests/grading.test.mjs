import test from 'node:test'
import assert from 'node:assert/strict'
import { parseCsv, toCsv, seedFromRoster, mergeRows, setStatus, matrix, taskOfRepo, applyGithub, setStudent, STUDENT_COLUMNS } from '../scripts/grading.mjs'

test('csv round-trips quotes, commas and newlines', () => {
  const rows = [{ student_id: 'st1', task: '1', status: 'todo', grade: '', repo: '', github: '', variant: 'a, "b"', note: 'x\ny', updated: '2026-11-17' }]
  assert.deepEqual(parseCsv(toCsv(rows)), rows)
})

test('roster seeding skips placeholders and closed tasks, and grades completed ones', () => {
  const roster = [
    { student_id: 'st1', task0_status: 'completed', task1_status: 'assigned', task1_title: 'T', task2_status: 'closed' },
    { student_id: 'stxxxxx', task0_status: 'assigned' },
  ]
  const seeded = seedFromRoster(roster, '2026-11-17')
  assert.deepEqual(seeded.map((r) => [r.student_id, r.task, r.status, r.grade]), [['st1', '0', 'graded', '+'], ['st1', '1', 'todo', '']])
})

test('merging never overwrites existing rows and is idempotent', () => {
  const existing = [{ student_id: 'st1', task: '1', status: 'graded', grade: '5' }]
  const seeded = [{ student_id: 'st1', task: '1', status: 'todo' }, { student_id: 'st2', task: '1', status: 'todo' }]
  const once = mergeRows(existing, seeded)
  assert.equal(once[0].status, 'graded')
  assert.equal(once.length, 2)
  assert.equal(mergeRows(once, seeded).length, 2)
})

test('setStatus validates, creates and updates', () => {
  const rows = []
  setStatus(rows, { student: 'st1', task: 3, status: 'checked', note: 'repo ok' }, 'd')
  setStatus(rows, { student: 'st1', task: 3, status: 'graded', grade: '+' }, 'd')
  assert.equal(rows.length, 1)
  assert.deepEqual([rows[0].status, rows[0].grade, rows[0].note], ['graded', '+', 'repo ok'])
  assert.throws(() => setStatus(rows, { student: 'st1', task: 3, status: 'done' }, 'd'), /status must be/)
})

test('matrix marks missing tasks', () => {
  const text = matrix([{ student_id: 'st1', task: '0', status: 'graded' }, { student_id: 'st2', task: '1', status: 'todo' }])
  assert.match(text, /st1\s+★\s+-/)
  assert.match(text, /st2\s+-\s+·/)
})

test('repository names map to tasks', () => {
  assert.equal(taskOfRepo('ML-task1'), '1')
  assert.equal(taskOfRepo('zadanie-1'), '1')
  assert.equal(taskOfRepo('Problem_2'), '2')
  assert.equal(taskOfRepo('ML_task_zero'), '0')
  assert.equal(taskOfRepo('dotfiles'), null)
})

test('applyGithub links the matching task, keeps an existing link and reports the rest', () => {
  const rows = [{ student_id: 'st1', task: '1', repo: '' }, { student_id: 'st1', task: '2', repo: 'kept' }, { student_id: 'st2', task: '1', repo: '' }]
  const unmatched = applyGithub(rows, 'st1', [{ name: 'ML-task1', html_url: 'u1' }, { name: 'task2', html_url: 'u2' }, { name: 'ml-mechanics-hw2', html_url: 'u3' }, { name: '2023-cpp-autumn', html_url: 'u4' }], 'd')
  assert.deepEqual(unmatched, ['u3'])
  assert.deepEqual(rows.map((r) => [r.repo, r.github ?? '']), [['u1', 'https://github.com/st1'], ['kept', 'https://github.com/st1'], ['', '']])
})

test('setStudent adds a student once and updates only the given fields', () => {
  const rows = []
  setStudent(rows, { student: 'st1', github: 'https://github.com/st1', via: 'github' })
  setStudent(rows, { student: 'st1', via: 'zip' })
  assert.equal(rows.length, 1)
  assert.deepEqual(rows[0], { student_id: 'st1', github: 'https://github.com/st1', via: 'zip', note: '' })
  assert.deepEqual(parseCsv(toCsv(rows, STUDENT_COLUMNS)), rows)
})
