import React, { useMemo, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { DeadlineProvider } from '../src/features/deadlines/DeadlineProvider';
import { DeadlineNotificationPreview } from '../src/features/deadlines/DeadlineUI';
import { createDeadlineAdapter } from '../src/features/deadlines/adapter.js';
import { deadlineFixture, previewPrograms, previewFaculty } from '../src/features/deadlines/fixtures.js';
import { emptySnapshot } from '../src/features/deadlines/model.js';
import ProgramManagement from '../src/components/ProgramManagement';
import Dashboard from '../src/views/DashboardView';
import Sidebar from '../src/components/Sidebar';
import Topbar from '../src/components/Topbar';
import { navItems } from '../src/data/initialData';
import { getLanguage, setLanguage, subscribeLanguage } from '../src/i18n';
import '../src/styles.css';
import './deadlines-preview.css';
import '../src/features/deadlines/deadlines.css';
// Defense in depth: this dedicated visual fixture cannot call the real backend.
window.fetch = async () => { throw new Error('Network access disabled in deadline preview'); };
function Preview() {
  const language = useSyncExternalStore(subscribeLanguage, getLanguage);
  const [identity, setIdentity] = useState('admin');
  const [scenario, setScenario] = useState('populated');
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState('courses');
  const [collapsed, setCollapsed] = useState(false);
  const [notice, setNotice] = useState('');
  const fixture = useMemo(() => scenario === 'empty' ? { ...emptySnapshot(), assignmentsLoaded: true } : deadlineFixture(), [scenario, revision]);
  const adapter = useMemo(() => createDeadlineAdapter(fixture, { delay: 450 }), [fixture]);
  const user = identity === 'admin' ? { id: 'demo-admin', role: 'admin', name: 'Preview Administrator', initials: 'PA' } : previewFaculty.find(f => f.id === identity);
  const navigate = next => { if (['courses', 'dashboard'].includes(next)) setPage(next); else setNotice('Preview navigation: ' + next + '. No real syllabus is opened or created.'); };
  return <><div className="deadline-preview-controls" style={{ padding: 12, background: '#fff', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
    <strong>UI prototype — isolated sample data; no deliveries or persistence</strong>
    <label>Role <select aria-label="Preview role" value={identity} onChange={e => { setIdentity(e.target.value); setPage(e.target.value === 'admin' ? 'courses' : 'dashboard'); }}><option value="admin">Administrator</option>{previewFaculty.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
    <label>Language <select aria-label="Preview language" value={language} onChange={e => setLanguage(e.target.value)}><option value="en">English</option><option value="tl">Tagalog</option></select></label>
    <label>Data <select aria-label="Preview data" value={scenario} onChange={e => setScenario(e.target.value)}><option value="populated">Populated</option><option value="empty">Empty</option></select></label>
    <button onClick={() => { adapter.failNext(); setNotice('Next adapter operation will fail.'); }}>Fail next action</button>
    <button onClick={() => setRevision(r => r + 1)}>Reset preview</button>
    <button onClick={() => setPage('dashboard')}>Dashboard preview</button>
    <button onClick={() => setPage('courses')}>Program preview</button>
  </div><p role="status" style={{ margin: '4px 16px' }}>{notice}</p>
    <DeadlineProvider key={scenario + revision} adapter={adapter}><div className="app-shell" data-sidebar-collapsed={collapsed}>
      <Sidebar page={page} setPage={navigate} nav={navItems.filter(([, , , role]) => !role || role === user.role)} collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <main className="workspace"><Topbar page={page} user={user} unread={0} threads={[]} msgDrop={false} setMsgDrop={() => {}} notifications={{ items: [], unreadCount: 0 }} onLogout={() => {}} />
        <div className="page-wrap">{page === 'courses' && user.role === 'admin' ? <div className="bld2 catalog-page"><ProgramManagement programs={previewPrograms} subjects={fixture.subjects} onChanged={async () => {}} notify={setNotice} /><DeadlineNotificationPreview user={user} /></div> : <Dashboard user={user} syllabi={[]} logs={[]} clearLogs={() => {}} setConfirm={() => {}} setPage={navigate} />}</div>
      </main>
    </div></DeadlineProvider>
  </>;
}
createRoot(document.getElementById('root')).render(<Preview />);
