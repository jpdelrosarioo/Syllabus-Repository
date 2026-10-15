import { phDayStart, toDate } from '../../lib/phTime.js';

export const emptySnapshot = () => ({ deadlines: [], subjects: [], assignments: [], submissions: [], notifications: [], assignmentsLoaded: false });
export const samePeriod = (a, b) => a.schoolYear === b.schoolYear && a.semester === b.semester;
export const periodKey = row => `${row.schoolYear}/${row.semester}`;
export const phDay = value => new Date(toDate(value).getTime() + 8 * 3600000).toISOString().slice(0, 10);
export function parseDue(value) {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value || '');
  if (!match || !phDayStart(match[1]) || +match[2] > 23 || +match[3] > 59) return null;
  return `${value}:00+08:00`;
}
export function validateDeadline(form, deadlines = []) {
  const errors = {};
  const years = /^(\d{4})-(\d{4})$/.exec(form.schoolYear || '');
  if (!years || +years[2] !== +years[1] + 1) errors.schoolYear = 'deadlines.errorYear';
  if (!['1', '2', 'summer'].includes(form.semester)) errors.semester = 'deadlines.errorSemester';
  if (!parseDue(form.dueLocal)) errors.dueLocal = 'deadlines.errorDue';
  if (deadlines.some(d => d.id !== form.id && d.programId === form.programId && samePeriod(d, form) && !d.cancelled)) errors.schoolYear = 'deadlines.errorDuplicate';
  return errors;
}
export function requirementStatus(deadline, submittedAt, now = new Date()) {
  if (deadline.cancelled) return 'cancelled';
  const due = toDate(deadline.dueAt);
  if (!due) return 'upcoming';
  const submitted = toDate(submittedAt);
  if (submitted) return submitted <= due ? 'submitted' : 'submittedLate';
  if (toDate(now) > due) return 'overdue';
  return phDay(now) === phDay(due) ? 'dueToday' : 'upcoming';
}
export function progressFor(snapshot, deadline, now = new Date()) {
  const subjects = snapshot.subjects.filter(s => s.programId === deadline.programId);
  const seen = new Set();
  const rows = snapshot.assignments.filter(a => a.courseId && subjects.some(s => s.id === a.courseId) && samePeriod(a, deadline)).flatMap(a => {
    const key = `${a.facultyId}/${a.courseId}`;
    if (seen.has(key)) return [];
    seen.add(key);
    // Only the first initial submission for this exact period/pair counts. Revisions never reset it.
    const submission = snapshot.submissions.filter(s => s.facultyId === a.facultyId && s.courseId === a.courseId && samePeriod(s, deadline) && s.kind === 'initial' && toDate(s.submittedAt)).sort((a, b) => toDate(a.submittedAt) - toDate(b.submittedAt))[0];
    return [{ ...a, subject: subjects.find(s => s.id === a.courseId), submittedAt: submission?.submittedAt, status: requirementStatus(deadline, submission?.submittedAt, now) }];
  });
  return { rows, unassigned: subjects.filter(s => !rows.some(r => r.courseId === s.id)), submitted: rows.filter(r => ['submitted', 'submittedLate'].includes(r.status)).length, pending: rows.filter(r => ['upcoming', 'dueToday'].includes(r.status)).length, overdue: rows.filter(r => r.status === 'overdue').length };
}
export function facultyRequirements(snapshot, facultyId, now = new Date()) {
  return snapshot.deadlines.flatMap(deadline => progressFor(snapshot, deadline, now).rows.filter(r => r.facultyId === facultyId).map(r => ({ ...r, deadline })));
}
