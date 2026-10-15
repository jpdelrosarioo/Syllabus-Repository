import { emptySnapshot, phDay } from './model.js';

// Synthetic identities are only used by tests/deadlines-preview.html; never loaded into authenticated accounts.
export const previewPrograms = [{ id: 'demo-it', code: 'BSIT', name: 'Bachelor of Science in Information Technology' }];
export const previewFaculty = [{ id: 'demo-ana', name: 'Ana Reyes', role: 'faculty' }, { id: 'demo-luis', name: 'Luis Santos', role: 'faculty' }, { id: 'demo-none', name: 'Mika Cruz', role: 'faculty' }];
export function deadlineFixture(now = new Date()) {
  const today = phDay(now);
  const period = { schoolYear: '2026-2027', semester: '1' };
  const program = previewPrograms[0];
  const deadline = { id: 'demo-deadline', programId: program.id, programCode: program.code, programName: program.name, ...period, dueLocal: `${today}T23:59`, dueAt: `${today}T23:59:00+08:00`, instructions: '' };
  return { ...emptySnapshot(), assignmentsLoaded: true,
    subjects: [ ['demo-web', 'IT 201', 'Web Development'], ['demo-db', 'IT 202', 'Database Systems'], ['demo-net', 'IT 203', 'Networking'] ].map(([id, code, title]) => ({ id, code, title, programId: program.id })),
    assignments: [ ['demo-ana', 'Ana Reyes', 'demo-web'], ['demo-luis', 'Luis Santos', 'demo-web'], ['demo-ana', 'Ana Reyes', 'demo-db'], ['demo-none', 'Mika Cruz', null] ].map(([facultyId, facultyName, courseId]) => ({ facultyId, facultyName, courseId, programId: program.id, ...period })),
    deadlines: [deadline, { ...deadline, id: 'demo-prior', semester: '2', schoolYear: '2025-2026', dueLocal: '2026-05-01T00:00', dueAt: '2026-05-01T00:00:00+08:00', cancelled: true }],
    submissions: [{ facultyId: 'demo-luis', courseId: 'demo-web', ...period, kind: 'initial', submittedAt: `${today}T08:00:00+08:00` }],
    notifications: ['created', 'updated', 'cancelled', 'reminder'].map(type => ({ id: `demo-${type}`, type, deadlineId: type === 'cancelled' ? 'demo-prior' : deadline.id })),
  };
}
