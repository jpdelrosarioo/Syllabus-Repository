import test from 'node:test';
import assert from 'node:assert/strict';
import { deadlineFixture } from './fixtures.js';
import { createDeadlineAdapter } from './adapter.js';
import { emptySnapshot, facultyRequirements, parseDue, progressFor, requirementStatus, validateDeadline } from './model.js';
const now = new Date('2026-10-15T12:00:00+08:00');
const fixture = () => deadlineFixture(now);
const form = () => ({ ...fixture().deadlines[0], id: undefined });
test('strict PH datetime parsing rejects impossible dates and invalid times', () => {
  for (const value of ['', '2026-02-30T12:00', '2026-10-15T24:00', '2026-10-15T12:60']) assert.equal(parseDue(value), null);
  assert.equal(parseDue('2028-02-29T00:00'), '2028-02-29T00:00:00+08:00');
});
test('required period and date validation; one active deadline per program/period', () => {
  assert.equal(Object.keys(validateDeadline({})).length, 3);
  assert.ok(validateDeadline({ ...form(), schoolYear: '2026-2028' }).schoolYear);
  assert.ok(validateDeadline(form(), fixture().deadlines).schoolYear);
  assert.deepEqual(validateDeadline(fixture().deadlines[0], fixture().deadlines), {});
  assert.deepEqual(validateDeadline({ ...form(), semester: '2' }, fixture().deadlines), {});
});
test('Philippine midnight boundary independent of host timezone', () => {
  const d = { dueAt: '2026-10-16T00:00:00+08:00' };
  assert.equal(requirementStatus(d, null, '2026-10-15T15:59:59Z'), 'upcoming');
  assert.equal(requirementStatus(d, null, '2026-10-15T16:00:00Z'), 'dueToday');
  assert.equal(requirementStatus(d, null, '2026-10-15T16:00:01Z'), 'overdue');
});
test('submitted at deadline is on time; awaiting review is never overdue', () => {
  const d = fixture().deadlines[0];
  assert.equal(requirementStatus(d, d.dueAt, '2027-01-01'), 'submitted');
  assert.equal(requirementStatus(d, '2026-10-16T00:00:00+08:00', '2027-01-01'), 'submittedLate');
});
test('two faculty on same subject count separately; unassigned subjects do not count', () => {
  const f = fixture(), p = progressFor(f, f.deadlines[0], now);
  assert.equal(p.rows.length, 3); assert.equal(p.submitted, 1); assert.equal(p.pending, 2); assert.equal(p.overdue, 0);
  assert.deepEqual(p.unassigned.map(s => s.id), ['demo-net']);
});
test('program-only assignment creates no requirement and duplicates do not inflate totals', () => {
  const f = fixture(); f.assignments.push(f.assignments[0]);
  assert.equal(facultyRequirements(f, 'demo-none', now).length, 0);
  assert.equal(progressFor(f, f.deadlines[0], now).rows.length, 3);
});
test('periods and programs never mix', () => {
  const f = fixture();
  assert.equal(progressFor(f, f.deadlines[1], now).rows.length, 0);
  assert.equal(progressFor(f, { ...f.deadlines[0], programId: 'other' }, now).rows.length, 0);
  f.submissions[0].semester = '2';
  assert.equal(progressFor(f, f.deadlines[0], now).submitted, 0);
});
test('first initial submission is used; revision submissions do not satisfy requirement', () => {
  const f = fixture();
  f.submissions.push({ ...f.submissions[0], facultyId: 'demo-ana', kind: 'revision' });
  f.submissions.push({ ...f.submissions[0], submittedAt: '2026-10-17T12:00:00+08:00' });
  const p = progressFor(f, f.deadlines[0], now);
  assert.equal(p.submitted, 1); assert.equal(p.rows.find(r => r.facultyId === 'demo-luis').status, 'submitted');
});
test('changed due date recalculates late status and pending/overdue', () => {
  const f = fixture();
  const p = progressFor(f, { ...f.deadlines[0], dueAt: '2026-10-15T07:00:00+08:00' }, now);
  assert.equal(p.overdue, 2); assert.equal(p.rows.find(r => r.facultyId === 'demo-luis').status, 'submittedLate');
});
test('cancellation removes overdue obligations, preserves submission evidence', () => {
  const f = fixture(); const p = progressFor(f, { ...f.deadlines[0], cancelled: true }, now);
  assert.equal(p.overdue, 0); assert.equal(p.pending, 0); assert.ok(p.rows.every(r => r.status === 'cancelled'));
  assert.ok(p.rows.find(r => r.facultyId === 'demo-luis').submittedAt);
});
test('empty adapter never seeds synthetic identities into authenticated accounts', async () => {
  const a = createDeadlineAdapter(undefined, { delay: 0 }); assert.deepEqual(await a.load(), emptySnapshot());
});
test('adapter failure is atomic, retry succeeds and notifications stay in adapter', async () => {
  const a = createDeadlineAdapter(undefined, { delay: 0 }); a.failNext();
  await assert.rejects(a.save(form()), /deadlines.failed/); assert.deepEqual(await a.load(), emptySnapshot());
  const saved = await a.save(form()); assert.equal(saved.deadlines.length, 1); assert.equal(saved.notifications[0].type, 'created');
  const edited = await a.save({ ...saved.deadlines[0], instructions: 'Keep this text' }); assert.equal(edited.notifications[0].type, 'updated');
  const cancelled = await a.cancel(saved.deadlines[0].id); assert.equal(cancelled.notifications[0].type, 'cancelled');
  assert.equal(cancelled.deadlines[0].cancelled, true);
});
test('adapter refuses duplicate period and supports restoring a cancelled period', async () => {
  const a = createDeadlineAdapter(undefined, { delay: 0 }); const first = await a.save(form());
  await assert.rejects(a.save(form()), /deadlines.invalid/);
  await a.cancel(first.deadlines[0].id); const replacement = await a.save(form());
  assert.equal(replacement.deadlines.filter(d => !d.cancelled).length, 1);
});
test('adapter loads are defensive copies', async () => {
  const a = createDeadlineAdapter(fixture(), { delay: 0 }); const one = await a.load(); one.deadlines.length = 0;
  assert.equal((await a.load()).deadlines.length, 2);
});

test('editing preserves deadline order so selected program context stays mounted', async () => {
  const a = createDeadlineAdapter(fixture(), { delay: 0 });
  const before = await a.load(); const after = await a.save({ ...before.deadlines[0], instructions: 'Updated' });
  assert.deepEqual(after.deadlines.map(d => d.id), before.deadlines.map(d => d.id));
});
