import { emptySnapshot, parseDue, validateDeadline } from './model.js';

// Replace this boundary with a deadline API later. No fetch, storage, mail or real account notifications.
export function createDeadlineAdapter(seed = emptySnapshot(), { delay = 250 } = {}) {
  let state = structuredClone(seed);
  let failNext = false;
  let sequence = 0;
  const pause = async () => {
    await new Promise(resolve => setTimeout(resolve, delay));
    if (failNext) { failNext = false; throw new Error('deadlines.failed'); }
  };
  const snapshot = () => structuredClone(state);
  return {
    failNext: () => { failNext = true; },
    async load() { await pause(); return snapshot(); },
    async save(form) {
      await pause();
      if (Object.keys(validateDeadline(form, state.deadlines)).length) throw new Error('deadlines.invalid');
      const existing = state.deadlines.find(d => d.id === form.id);
      const deadline = { ...form, id: existing?.id || `preview-deadline-${++sequence}`, dueAt: parseDue(form.dueLocal), cancelled: false };
      state.deadlines = existing ? state.deadlines.map(d => d.id === deadline.id ? deadline : d) : [...state.deadlines, deadline];
      state.notifications.unshift({ id: `preview-notification-${++sequence}`, deadlineId: deadline.id, type: existing ? 'updated' : 'created' });
      return snapshot();
    },
    async cancel(id) {
      await pause();
      state.deadlines = state.deadlines.map(d => d.id === id ? { ...d, cancelled: true } : d);
      state.notifications.unshift({ id: `preview-notification-${++sequence}`, deadlineId: id, type: 'cancelled' });
      return snapshot();
    },
  };
}
