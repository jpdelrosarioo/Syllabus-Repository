import { createContext, useContext, useEffect, useState } from 'react';
import { createDeadlineAdapter } from './adapter.js';
import { emptySnapshot } from './model.js';

const Context = createContext(null);
export function DeadlineProvider({ children, adapter: supplied }) {
  const [adapter] = useState(() => supplied || createDeadlineAdapter());
  const [snapshot, setSnapshot] = useState(emptySnapshot);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    adapter.load().then(data => { if (active) setSnapshot(data); }).catch(() => { if (active) setError('deadlines.failed'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [adapter, reload]);
  return <Context.Provider value={{ snapshot, loading, error, retry: () => setReload(n => n + 1), save: async form => setSnapshot(await adapter.save(form)), cancel: async id => setSnapshot(await adapter.cancel(id)) }}>{children}</Context.Provider>;
}
export const useDeadlines = () => useContext(Context);
