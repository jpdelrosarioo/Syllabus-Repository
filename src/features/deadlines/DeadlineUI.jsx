import { useEffect, useId, useRef, useState } from 'react';
import CatalogModalPortal from '../../components/CatalogModalPortal';
import StableButton from '../../components/StableButton';
import { useModalLayer } from '../../components/useModalLayer';
import { useActionExit, useSurfaceMotion } from '../../lib/catalogMotion';
import { Icon } from '../../components/ui';
import { t } from '../../i18n';
import { phDateTime } from '../../lib/phTime';
import { useDeadlines } from './DeadlineProvider';
import { facultyRequirements, progressFor, validateDeadline } from './model.js';

const semesterLabel = semester => t('deadlines.semester.' + semester);
const periodLabel = d => `${d.schoolYear} · ${semesterLabel(d.semester)}`;
const tone = { upcoming: 'blue', dueToday: 'gold', overdue: 'red', submitted: 'green', submittedLate: 'gold', cancelled: '' };
export function DeadlineStatus({ status }) { return <span className={`badge ${tone[status] || ''}`}>{t('deadlines.status.' + status)}</span>; }
function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 10000); return () => clearInterval(timer); }, []);
  return now;
}
function LoadState({ store }) {
  return store.loading ? <p role="status">{t('deadlines.loading')}</p> : store.error ? <div role="alert"><p>{t(store.error)}</p><StableButton className="btn outline" onClick={store.retry}>{t('deadlines.retry')}</StableButton></div> : null;
}
export function DeadlineDialog({ title, description, onClose, busy = false, children }) {
  const ref = useRef(null);
  const id = useId();
  const motion = useActionExit(ref);
  const close = () => { if (!busy) motion.dismiss(onClose); };
  useModalLayer(ref, close);
  useSurfaceMotion(ref, title);
  return <CatalogModalPortal><div className="overlay overlay-confirm catalog-overlay bld2 catalog-page deadline-overlay" onClick={close}>
    <section ref={ref} className="modal confirm-modal program-dialog catalog-surface deadline-dialog" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={id} aria-describedby={`${id}-description`} aria-busy={busy} inert={motion.closing || undefined} onClick={e => e.stopPropagation()}>
      <div className="deadline-dialog-head"><h3 id={id}>{title}</h3><StableButton className="btn outline" disabled={busy} onClick={close}>{t('deadlines.close')}</StableButton></div>
      <p id={`${id}-description`}>{description}</p>{children}
    </section>
  </div></CatalogModalPortal>;
}
export function DeadlineForm({ program, deadline, subjects = [], onClose }) {
  const store = useDeadlines();
  const id = useId();
  const [form, setForm] = useState(() => ({ id: deadline?.id, programId: program.id, programCode: program.code, programName: program.name, schoolYear: deadline?.schoolYear || '', semester: deadline?.semester || '', dueLocal: deadline?.dueLocal || '', instructions: deadline?.instructions || '' }));
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const inFlight = useRef(false);
  const formRef = useRef(null);
  const preview = progressFor({ ...store.snapshot, subjects: subjects.length ? subjects : store.snapshot.subjects }, form);
  const change = (key, value) => { setForm(f => ({ ...f, [key]: value })); setErrors(e => ({ ...e, [key]: undefined })); setError(''); };
  const save = async event => {
    event.preventDefault();
    if (inFlight.current) return;
    const errors = validateDeadline(form, store.snapshot.deadlines);
    setErrors(errors);
    if (Object.keys(errors).length) { requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus()); return; }
    inFlight.current = true; setBusy(true); setError('');
    try { await store.save(form); setSaved(true); }
    catch (e) { setError(e.message === 'deadlines.invalid' ? e.message : 'deadlines.failed'); }
    finally { inFlight.current = false; setBusy(false); }
  };
  const controlProps = key => ({ id: `${id}-${key}`, disabled: busy, value: form[key], 'aria-invalid': !!errors[key], 'aria-describedby': errors[key] ? `${id}-${key}-error` : undefined, onChange: e => change(key, e.target.value) });
  const field = (key, label, control) => <div className="field"><label htmlFor={`${id}-${key}`}>{t(label)}</label>{control}{errors[key] && <span className="form-error" id={`${id}-${key}-error`}>{t(errors[key])}</span>}</div>;
  return <DeadlineDialog title={t(deadline ? 'deadlines.edit' : 'deadlines.set')} description={`${program.code} · ${program.name}`} onClose={onClose} busy={busy}>
    {saved ? <div role="status"><p className="info-banner">{t('deadlines.saved')}</p><StableButton className="btn primary" onClick={onClose}>{t('deadlines.done')}</StableButton></div> : <form ref={formRef} onSubmit={save} noValidate>
      <p className="info-banner">{t('deadlines.scope')}</p>
      <div className="deadline-form-grid">
        {field('schoolYear', 'deadlines.schoolYear', <input {...controlProps('schoolYear')} placeholder="2026-2027" maxLength={9} required />)}
        {field('semester', 'deadlines.semester', <select {...controlProps('semester')} required><option value="">{t('deadlines.chooseSemester')}</option>{['1', '2', 'summer'].map(s => <option key={s} value={s}>{semesterLabel(s)}</option>)}</select>)}
        {field('dueLocal', 'deadlines.duePH', <input {...controlProps('dueLocal')} type="datetime-local" required />)}
        {field('instructions', 'deadlines.instructions', <textarea {...controlProps('instructions')} rows={3} maxLength={2000} />)}
      </div>
      <details className="deadline-impact" open><summary>{t('deadlines.affected')}</summary>
        <p>{t('deadlines.affectedCounts', { subjects: preview.unassigned.length + new Set(preview.rows.map(r => r.courseId)).size, faculty: new Set(preview.rows.map(r => r.facultyId)).size, requirements: preview.rows.length })}</p>
        {!store.snapshot.assignmentsLoaded && <p>{t('deadlines.assignmentUnavailable')}</p>}
        <ul>{[...preview.unassigned, ...preview.rows.map(r => r.subject)].filter((s, i, all) => all.findIndex(a => a.id === s.id) === i).map(s => <li key={s.id}>{s.code} · {s.title}{preview.rows.filter(r => r.courseId === s.id).map(r => <span className="deadline-faculty" key={r.facultyId}>{r.facultyName}</span>)}</li>)}</ul>
      </details>
      {error && <p className="form-error" role="alert">{t(error)}</p>}
      <div className="confirm-actions"><StableButton className="btn outline" type="button" disabled={busy} onClick={onClose}>{t('deadlines.back')}</StableButton><StableButton className="btn primary" type="submit" disabled={busy}>{t(busy ? 'deadlines.saving' : 'deadlines.save')}</StableButton></div>
      <span className="deadline-live" role="status">{busy ? t('deadlines.saving') : ''}</span>
    </form>}
  </DeadlineDialog>;
}
export function DeadlineProgress({ deadline, subjects = [], onClose, facultyId, onStart }) {
  const store = useDeadlines();
  const now = useClock();
  const progress = progressFor({ ...store.snapshot, subjects: subjects.length ? subjects : store.snapshot.subjects }, deadline, now);
  const rows = facultyId ? progress.rows.filter(r => r.facultyId === facultyId) : progress.rows;
  return <DeadlineDialog title={t('deadlines.progress')} description={`${deadline.programCode} · ${periodLabel(deadline)}`} onClose={onClose}>
    <p><strong>{t('deadlines.duePH')}</strong> · {phDateTime(deadline.dueAt)}</p>
    {deadline.cancelled && <p className="info-banner" role="status">{t('deadlines.cancelledNote')}</p>}
    {deadline.instructions && <p className="deadline-instructions">{deadline.instructions}</p>}
    {!facultyId && !deadline.cancelled && <div className="deadline-summary">{['submitted', 'pending', 'overdue'].map(key => <div key={key}><strong>{progress[key]}</strong><span>{t('deadlines.status.' + key)}</span></div>)}</div>}
    {!store.snapshot.assignmentsLoaded && <p className="info-banner">{t('deadlines.assignmentUnavailable')}</p>}
    <div className="table-wrap deadline-table" role="region" aria-label={t('deadlines.progress')} tabIndex={0}><table><thead><tr>{['subjectCode', 'subjectName', 'faculty', 'status', 'submissionDate', 'deadline'].map(key => <th key={key}>{t('deadlines.' + key)}</th>)}</tr></thead><tbody>
      {rows.map(row => <tr key={`${row.facultyId}/${row.courseId}`}><td>{row.subject.code}</td><td>{row.subject.title}</td><td>{row.facultyName}</td><td><DeadlineStatus status={row.status} /></td><td>{row.submittedAt ? phDateTime(row.submittedAt) : t('deadlines.notSubmitted')}</td><td>{phDateTime(deadline.dueAt)}</td></tr>)}
      {!rows.length && <tr><td colSpan={6}>{t('deadlines.noAssignments')}</td></tr>}
    </tbody></table></div>
    {!facultyId && store.snapshot.assignmentsLoaded && <div className="deadline-impact"><h4>{t('deadlines.unassigned')}</h4><p>{t('deadlines.unassignedNote')}</p>{progress.unassigned.length ? <ul>{progress.unassigned.map(s => <li key={s.id}>{s.code} · {s.title}</li>)}</ul> : <p>{t('deadlines.noneUnassigned')}</p>}</div>}
    {facultyId && !deadline.cancelled && onStart && <><p>{t('deadlines.builderNote')}</p><StableButton className="btn primary" onClick={onStart}>{t('deadlines.openBuilder')}</StableButton></>}
  </DeadlineDialog>;
}
function CancelDeadline({ deadline, onClose }) {
  const store = useDeadlines();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const cancel = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await store.cancel(deadline.id); onClose(); }
    catch { setError('deadlines.failed'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <DeadlineDialog title={t('deadlines.cancel')} description={`${deadline.programCode} · ${periodLabel(deadline)}`} busy={busy} onClose={onClose}><p>{t('deadlines.cancelConfirm')}</p>{error && <p role="alert" className="form-error">{t(error)}</p>}<div className="confirm-actions"><StableButton className="btn outline" disabled={busy} onClick={onClose}>{t('deadlines.keep')}</StableButton><StableButton className="btn danger" disabled={busy} onClick={cancel}>{t(busy ? 'deadlines.cancelling' : 'deadlines.cancel')}</StableButton></div></DeadlineDialog>;
}
export function ProgramDeadlineActions({ program, subjects = [] }) {
  const store = useDeadlines();
  const [selected, setSelected] = useState('');
  const [mode, setMode] = useState(null);
  const id = useId();
  if (!store) return null;
  const deadlines = store.snapshot.deadlines.filter(d => d.programId === program.id);
  const deadline = deadlines.find(d => d.id === selected) || deadlines[0];
  return <div className="program-deadlines"><LoadState store={store} />{!store.loading && !store.error && <>
    {deadline && <><div className="field"><label htmlFor={id}>{t('deadlines.period')}</label><select id={id} value={deadline.id} onChange={e => setSelected(e.target.value)}>{deadlines.map(d => <option key={d.id} value={d.id}>{periodLabel(d)}{d.cancelled ? ` · ${t('deadlines.status.cancelled')}` : ''}</option>)}</select></div><p className="deadline-due">{phDateTime(deadline.dueAt)} · {t('deadlines.phTime')}</p></>}
    <div className="program-management-actions"><StableButton className="btn outline" onClick={() => setMode('new')}>{t('deadlines.set')}</StableButton>{deadline && <>
      {!deadline.cancelled && <StableButton className="btn outline" onClick={() => setMode('edit')}>{t('deadlines.edit')}</StableButton>}
      <StableButton className="btn outline" onClick={() => setMode('progress')}>{t('deadlines.viewProgress')}</StableButton>
      {!deadline.cancelled && <StableButton className="btn danger" onClick={() => setMode('cancel')}>{t('deadlines.cancel')}</StableButton>}
    </>}</div>
  </>}
    {(mode === 'new' || mode === 'edit') && <DeadlineForm key={mode === 'new' ? 'new' : `edit-${deadline?.id}`} program={program} deadline={mode === 'edit' ? deadline : null} subjects={subjects} onClose={() => setMode(null)} />}
    {mode === 'progress' && deadline && <DeadlineProgress deadline={deadline} subjects={subjects} onClose={() => setMode(null)} />}
    {mode === 'cancel' && deadline && <CancelDeadline deadline={deadline} onClose={() => setMode(null)} />}
  </div>;
}
export function UpcomingProgramDeadlines({ user, setPage }) {
  const store = useDeadlines();
  const [open, setOpen] = useState(null);
  const now = useClock();
  if (!store) return null;
  const faculty = user.role === 'faculty';
  const entries = faculty ? facultyRequirements(store.snapshot, user.id, now).filter(r => !r.deadline.cancelled) : store.snapshot.deadlines.filter(d => !d.cancelled).map(deadline => ({ deadline }));
  const deadline = store.snapshot.deadlines.find(d => d.id === open);
  return <div className="upcoming-program-deadlines"><LoadState store={store} />{!store.loading && !store.error && <>
    {!entries.length && <p className="empty">{t(faculty ? 'deadlines.emptyFaculty' : 'deadlines.emptyAdmin')}</p>}
    {entries.map(({ deadline, subject, status, courseId }) => <button type="button" className="deadline-entry" key={`${deadline.id}/${courseId || ''}`} onClick={() => setOpen(deadline.id)}><Icon name="clockBack" size={20} /><span><strong>{deadline.programCode}{subject && ` · ${subject.code}`}</strong>{subject && <span>{subject.title}</span>}<span>{periodLabel(deadline)}</span><time dateTime={deadline.dueAt}>{phDateTime(deadline.dueAt)} · {t('deadlines.phTime')}</time>{status && <DeadlineStatus status={status} />}</span></button>)}
    <DeadlineNotificationPreview user={user} />
  </>}{deadline && <DeadlineProgress deadline={deadline} facultyId={faculty ? user.id : null} onClose={() => setOpen(null)} onStart={setPage ? () => { setOpen(null); setPage('builder'); } : undefined} />}</div>;
}
export function DeadlineNotificationPreview({ user }) {
  const store = useDeadlines();
  const [show, setShow] = useState(false);
  const [open, setOpen] = useState(null);
  if (!store) return null;
  const eligible = new Set(user?.role === 'faculty' ? facultyRequirements(store.snapshot, user.id).map(r => r.deadline.id) : store.snapshot.deadlines.map(d => d.id));
  const notifications = store.snapshot.notifications.filter(n => eligible.has(n.deadlineId));
  const deadline = store.snapshot.deadlines.find(d => d.id === open);
  return <><StableButton className="btn ghost" onClick={() => setShow(true)}>{t('deadlines.previewNotifications')}</StableButton>{show && <DeadlineDialog title={t('deadlines.previewNotifications')} description={t('deadlines.previewNote')} onClose={() => setShow(false)}><div className="notif-list">{notifications.map(n => { const d = store.snapshot.deadlines.find(d => d.id === n.deadlineId); return <button className="thread notif-item unread" key={n.id} onClick={() => setOpen(d.id)}><span className="notif-icon"><Icon name="bell" size={18} /></span><span className="thread-body deadline-notification-body"><strong>{t('deadlines.notification.' + n.type)}</strong><span>{d.programCode} · {periodLabel(d)}</span><small>{phDateTime(d.dueAt)}</small></span></button>; })}{!notifications.length && <p className="msg-empty">{t('deadlines.noNotifications')}</p>}</div></DeadlineDialog>}{deadline && <DeadlineProgress deadline={deadline} facultyId={user?.role === 'faculty' ? user.id : null} onClose={() => setOpen(null)} />}</>;
}
