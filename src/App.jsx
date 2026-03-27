import { useState, useEffect, useCallback, useMemo, Component } from 'react';
import * as db from './lib/supabase';
import { T, ROLE_COLORS, ROLES,
  Badge, Dot, Card, Btn, Input, Modal, Tbl, TTag, Avatar, Spinner } from './components/UI';

// Move type helpers (new simplified types)
const MOVE_TYPES = [
  { id: 'to-dock', label: 'To Dock', icon: '🏗️', desc: 'Bring a trailer to a dock' },
  { id: 'from-dock', label: 'From Dock', icon: '🔄', desc: 'Pull a trailer from a dock' },
  { id: 'yard-move', label: 'Yard Move', icon: '📦', desc: 'Relocate a trailer in the yard' },
];
const mtl = id => MOVE_TYPES.find(m => m.id === id)?.label ?? id;
const mti = id => MOVE_TYPES.find(m => m.id === id)?.icon ?? '📦';
const sc = s => ({ pending: T.wn, 'in-progress': T.in, completed: T.ok, cancelled: T.dg }[s] ?? T.tm);

// ─── ERROR BOUNDARY ─────────────────────────────────────
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null, info: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error('ErrorBoundary caught:', error, info); this.setState({ info }); }
  render() {
    if (this.state.hasError) {
      return (<div style={{ background: '#0F172A', color: '#fff', minHeight: '100vh', padding: 40, fontFamily: 'monospace' }}>
        <h1 style={{ color: '#FF6B6B' }}>⚠️ YardFlow Error</h1>
        <pre style={{ background: '#1E293B', padding: 20, borderRadius: 8, overflow: 'auto', fontSize: 13, color: '#FFA500' }}>{this.state.error?.toString()}</pre>
        <pre style={{ background: '#1E293B', padding: 20, borderRadius: 8, overflow: 'auto', fontSize: 12, color: '#64748B', marginTop: 10 }}>{this.state.info?.componentStack}</pre>
        <button onClick={() => { sessionStorage.removeItem('yf_user'); window.location.reload(); }} style={{ marginTop: 20, padding: '10px 20px', background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>🔄 Clear Session & Reload</button>
      </div>);
    }
    return this.props.children;
  }
}

// ─── LOGIN ──────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    const { user, error: err } = await db.loginUser(username, password);
    setLoading(false);
    if (err) { setError(err); return; }
    onLogin(user);
  };

  return (
    <div style={{ background: T.bg, color: T.tx, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: `radial-gradient(circle at 1px 1px, ${T.bd} 1px, transparent 0)`, backgroundSize: '40px 40px', opacity: 0.4 }} />
      <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 500, height: 500, borderRadius: '50%', background: `radial-gradient(circle, ${T.ac}15 0%, transparent 70%)`, filter: 'blur(60px)' }} />
      <div style={{ position: 'relative', zIndex: 1, width: 420, maxWidth: '90vw' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: `linear-gradient(135deg,${T.ac},#FF8F5C)`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, marginBottom: 16, boxShadow: `0 8px 32px ${T.ac}44` }}>🏭</div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em' }}>YardFlow</h1>
          <p style={{ margin: '6px 0 0', color: T.tm, fontSize: 14 }}>Trailer & Yard Management System</p>
        </div>
        <Card style={{ padding: 32 }}>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Sign In</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: T.tm }}>Enter your credentials to continue</p>
          </div>
          {error && <div style={{ padding: '10px 14px', background: T.dg + '18', border: `1px solid ${T.dg}44`, borderRadius: 8, fontSize: 13, color: T.dg, marginBottom: 16 }}>⚠️ {error}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Input label="Username" value={username} onChange={v => { setUsername(v); setError(''); }} placeholder="Enter username" onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            <div style={{ position: 'relative' }}>
              <Input label="Password" type={showPw ? 'text' : 'password'} value={password} onChange={v => { setPassword(v); setError(''); }} placeholder="Enter password" onKeyDown={e => e.key === 'Enter' && handleLogin()} />
              <button onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: 10, bottom: 8, background: 'none', border: 'none', color: T.tm, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>{showPw ? 'Hide' : 'Show'}</button>
            </div>
            <Btn onClick={handleLogin} disabled={!username || !password || loading} style={{ width: '100%', justifyContent: 'center', padding: '12px 20px', fontSize: 14, marginTop: 4 }}>{loading ? 'Signing in...' : 'Sign In →'}</Btn>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── MAIN APP ───────────────────────────────────────────────
export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = sessionStorage.getItem('yf_user');
      if (!saved) return null;
      const u = JSON.parse(saved);
      if (!u || !u.id || !u.role || !u.name) { sessionStorage.removeItem('yf_user'); return null; }
      return u;
    } catch { sessionStorage.removeItem('yf_user'); return null; }
  });

  const handleLogin = (user) => { setCurrentUser(user); sessionStorage.setItem('yf_user', JSON.stringify(user)); };
  const handleLogout = () => { setCurrentUser(null); sessionStorage.removeItem('yf_user'); };

  if (!currentUser) return <LoginScreen onLogin={handleLogin} />;
  return <ErrorBoundary><AppShell currentUser={currentUser} onLogout={handleLogout} /></ErrorBoundary>;
}

function AppShell({ currentUser, onLogout }) {
  const role = currentUser.role;
  const isAdmin = role === 'admin';

  // ─ ALL useState declarations MUST be before any early returns (React Rules of Hooks)
  const [users, setUsers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [trailers, setTrailers] = useState([]);
  const [moves, setMoves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState(role === 'hostler' ? 'hostler' : 'dashboard');
  const [showNewMove, setShowNewMove] = useState(false);
  const [showNewTrailer, setShowNewTrailer] = useState(false);
  const [editTrailer, setEditTrailer] = useState(null);
  const [selMove, setSelMove] = useState(null);
  const [filter, setFilter] = useState('');
  const [sf, setSf] = useState('');
  const [hf, setHf] = useState('');
  const [clock, setClock] = useState(new Date());
  const [showAddUser, setShowAddUser] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [showPwReset, setShowPwReset] = useState(null);
  const [userFilter, setUserFilter] = useState('');
  const [showAddLoc, setShowAddLoc] = useState(false);
  const [editLoc, setEditLoc] = useState(null);
  const [locFilter, setLocFilter] = useState('');
  // Move form: type is 'to-dock' or 'from-dock'
  const [nm, setNm] = useState({ type: 'to-dock', dock: '', trailerType: '', priority: 'normal', notes: '' });
  const [nt, setNt] = useState({ number: '', type: 'Dry Van', status: 'Empty', location: '', carrier: '', notes: '' });
  const [newUser, setNewUser] = useState({ username: '', password: '', name: '', role: 'hostler', color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0') });
  const [newLoc, setNewLoc] = useState({ id: '', label: '', type: 'dock', zone: '' });
  // Hostler completion/cancel modals
  const [completeModal, setCompleteModal] = useState(null); // move being completed
  const [cmFields, setCmFields] = useState({ trailerNumber: '', yardSpot: '', fromSpot: '' });
  const [cancelModal, setCancelModal] = useState(null); // move being cancelled
  const [cancelReason, setCancelReason] = useState('');
  const [settings, setSettings] = useState(db.DEFAULT_SETTINGS);
  const [newType, setNewType] = useState('');
  const [newStatus, setNewStatus] = useState('');

  // Derived from settings
  const TRAILER_TYPES = settings.trailerTypes || db.DEFAULT_SETTINGS.trailerTypes;
  const TRAILER_STATUSES = settings.trailerStatuses || db.DEFAULT_SETTINGS.trailerStatuses;

  // Screen access controls (admin-configurable, stored in localStorage)
  const DEFAULT_ACCESS = {
    admin: ['dashboard', 'moves', 'trailers', 'yard', 'hostler', 'analytics', 'locations', 'settings', 'users'],
    manager: ['dashboard', 'moves', 'trailers', 'yard', 'analytics'],
    warehouse: ['moves', 'trailers', 'yard'],
    hostler: ['hostler', 'yard'],
  };
  const [screenAccess, setScreenAccess] = useState(() => {
    try {
      const saved = localStorage.getItem('yf_screen_access');
      return saved ? JSON.parse(saved) : DEFAULT_ACCESS;
    } catch { return DEFAULT_ACCESS; }
  });

  // ─ Load data
  useEffect(() => {
    (async () => {
      try {
        const [u, l, t, m, s] = await Promise.all([db.fetchUsers(), db.fetchLocations(), db.fetchTrailers(), db.fetchMoves(), db.fetchSettings()]);
        setUsers(u.data || []); setLocations(l.data || []); setTrailers(t.data || []); setMoves(m.data || []);
        if (s.data) setSettings(s.data);
      } catch (err) { console.error('Failed to load data:', err); }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    const moveSub = db.subscribeToMoves(() => { db.fetchMoves().then(r => setMoves(r.data || [])); });
    const trailerSub = db.subscribeToTrailers(() => { db.fetchTrailers().then(r => setTrailers(r.data || [])); });
    const locSub = db.subscribeToLocations(() => { db.fetchLocations().then(r => setLocations(r.data || [])); });
    const settSub = db.subscribeToSettings(() => { db.fetchSettings().then(r => { if (r.data) setSettings(r.data); }); });
    return () => { moveSub.unsubscribe(); trailerSub.unsubscribe(); locSub.unsubscribe(); settSub.unsubscribe(); };
  }, []);

  useEffect(() => { const t = setInterval(() => setClock(new Date()), 30000); return () => clearInterval(t); }, []);

  // ─ Lookups
  const locLabel = useCallback(id => locations.find(l => l.id === id)?.label ?? (id || '—'), [locations]);
  const userName = useCallback(id => users.find(u => u.id === id)?.name ?? '—', [users]);
  const userColor = useCallback(id => users.find(u => u.id === id)?.color ?? T.tm, [users]);
  const hostlers = useMemo(() => users.filter(u => u.role === 'hostler' && u.active), [users]);
  const trailerMap = useMemo(() => Object.fromEntries(trailers.map(t => [t.number, t])), [trailers]);
  const gtt = useCallback(num => trailerMap[num]?.type ?? '', [trailerMap]);
  const dockLocs = useMemo(() => locations.filter(l => l.type === 'dock'), [locations]);
  const yardLocs = useMemo(() => locations.filter(l => l.type === 'yard'), [locations]);

  // ─ Metrics
  const pending = useMemo(() => moves.filter(m => m.status === 'pending'), [moves]);
  const inProg = useMemo(() => moves.filter(m => m.status === 'in-progress'), [moves]);
  const completed = useMemo(() => moves.filter(m => m.status === 'completed'), [moves]);
  const dkO = useMemo(() => { const o = dockLocs.filter(d => trailers.some(t => t.location_id === d.id)).length; return { o, t: dockLocs.length, p: dockLocs.length ? Math.round(o / dockLocs.length * 100) : 0 }; }, [trailers, dockLocs]);
  const ydO = useMemo(() => { const o = yardLocs.filter(y => trailers.some(t => t.location_id === y.id)).length; return { o, t: yardLocs.length, p: yardLocs.length ? Math.round(o / yardLocs.length * 100) : 0 }; }, [trailers, yardLocs]);

  const hStats = useMemo(() => hostlers.map(h => {
    const hm = moves.filter(m => m.claimed_by === h.id), done = hm.filter(m => m.status === 'completed');
    const avg = done.length > 0 ? done.reduce((a, m) => a + (new Date(m.completed_at) - new Date(m.started_at)) / 60000, 0) / done.length : 0;
    return { ...h, total: hm.length, completed: done.length, inProgress: hm.filter(m => m.status === 'in-progress').length, avgMinutes: Math.round(avg) };
  }), [moves, hostlers]);

  // ─ Actions: Create Move (new flow)
  const handleCreateMove = async () => {
    const moveData = {
      type: nm.type,
      trailer_number: '', // hostler fills this in
      trailer_type: nm.trailerType || '',
      from_location: nm.type === 'from-dock' ? nm.dock : null,
      to_location: nm.type === 'to-dock' ? nm.dock : null,
      requested_by: currentUser.name, // LOCKED to current user
      requested_by_user: currentUser.id,
      priority: nm.priority,
      notes: nm.notes,
      requested_trailer_type: nm.type === 'to-dock' ? nm.trailerType : (nm.requestBackType || ''),
    };
    await db.createMove(moveData);
    setShowNewMove(false);
    setNm({ type: 'to-dock', dock: '', trailerType: '', requestBackType: '', priority: 'normal', notes: '' });
    db.fetchMoves().then(r => setMoves(r.data));
  };

  // Hostler completes — with fields they fill in
  const handleCompleteMove = async () => {
    if (!completeModal) return;
    const m = completeModal;
    const updates = {};
    if (m.type === 'to-dock') {
      // Hostler fills: which trailer they brought + where they pulled it from (yard spot)
      updates.trailer_number = cmFields.trailerNumber;
      updates.trailer_type = gtt(cmFields.trailerNumber) || cmFields.trailerType || '';
      updates.from_location = cmFields.yardSpot;
      updates.to_location = m.to_location; // dock was set by warehouse
    } else if (m.type === 'from-dock') {
      // Hostler fills: where they dropped the trailer (yard spot)
      updates.to_location = cmFields.yardSpot;
      // trailer_number stays from original (trailer at dock) or hostler can specify
      if (cmFields.trailerNumber) updates.trailer_number = cmFields.trailerNumber;
    } else if (m.type === 'yard-move') {
      // Hostler fills: trailer #, from location, to location
      updates.trailer_number = cmFields.trailerNumber;
      updates.trailer_type = gtt(cmFields.trailerNumber) || '';
      updates.from_location = cmFields.fromSpot;
      updates.to_location = cmFields.yardSpot;
    }
    await db.completeMove(m.id, updates);

    // If from-dock had a requested type back, auto-create a to-dock move
    if (m.type === 'from-dock' && m.requested_trailer_type && settings.autoCreateSendBack) {
      await db.createMove({
        type: 'to-dock',
        trailer_number: '',
        trailer_type: m.requested_trailer_type,
        from_location: null,
        to_location: m.from_location, // same dock
        requested_by: m.requested_by || currentUser.name,
        requested_by_user: m.requested_by_user,
        priority: m.priority,
        notes: `Auto-created: ${m.requested_trailer_type} requested back at ${locLabel(m.from_location)}`,
        requested_trailer_type: m.requested_trailer_type,
      });
    }

    setCompleteModal(null);
    setCmFields({ trailerNumber: '', yardSpot: '', fromSpot: '', trailerType: '' });
    db.fetchMoves().then(r => setMoves(r.data));
    db.fetchTrailers().then(r => setTrailers(r.data));
  };

  const handleClaimMove = async (moveId) => {
    await db.claimMove(moveId, currentUser.id);
    db.fetchMoves().then(r => setMoves(r.data));
  };

  const handleReleaseMove = async (moveId) => {
    await db.releaseMove(moveId);
    db.fetchMoves().then(r => setMoves(r.data));
  };

  const handleCancelMove = async () => {
    if (!cancelModal || !cancelReason.trim()) return;
    await db.cancelMove(cancelModal.id, cancelReason);
    setCancelModal(null); setCancelReason('');
    db.fetchMoves().then(r => setMoves(r.data));
  };

  const handleCreateTrailer = async () => {
    await db.createTrailer({ number: nt.number, type: nt.type, status: nt.status, location_id: nt.location || null, carrier: nt.carrier, notes: nt.notes });
    setShowNewTrailer(false); setNt({ number: '', type: 'Dry Van', status: 'Empty', location: '', carrier: '', notes: '' });
    db.fetchTrailers().then(r => setTrailers(r.data));
  };

  const handleEditTrailer = async () => {
    if (!editTrailer) return;
    await db.updateTrailer(editTrailer.id, { type: editTrailer.type, status: editTrailer.status, location_id: editTrailer.location_id, carrier: editTrailer.carrier, notes: editTrailer.notes });
    setEditTrailer(null); db.fetchTrailers().then(r => setTrailers(r.data));
  };

  // User management
  const handleAddUser = async () => {
    const { error } = await db.createUser(newUser);
    if (error) { alert('Error: ' + error.message); return; }
    setShowAddUser(false); setNewUser({ username: '', password: '', name: '', role: 'hostler', color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0') });
    db.fetchUsers().then(r => setUsers(r.data));
  };
  const handleEditUser = async () => {
    if (!editUser) return;
    await db.updateUser(editUser.id, { name: editUser.name, username: editUser.username, role: editUser.role, color: editUser.color });
    setEditUser(null); db.fetchUsers().then(r => setUsers(r.data));
  };
  const handleToggleUser = async (id, active) => { await db.toggleUserActive(id, !active); db.fetchUsers().then(r => setUsers(r.data)); };
  const handleDeleteUser = async (id) => { await db.deleteUser(id); db.fetchUsers().then(r => setUsers(r.data)); };
  const handleResetPw = async (id, pw) => { await db.resetUserPassword(id, pw); setShowPwReset(null); };

  // Location management
  const handleAddLoc = async () => {
    const { error } = await db.createLocation(newLoc);
    if (error) { alert('Error: ' + error.message); return; }
    setShowAddLoc(false); setNewLoc({ id: '', label: '', type: 'dock', zone: '' });
    db.fetchLocations().then(r => setLocations(r.data));
  };
  const handleEditLoc = async () => {
    if (!editLoc) return;
    await db.updateLocation(editLoc.id, { label: editLoc.label, type: editLoc.type, zone: editLoc.zone || null });
    setEditLoc(null); db.fetchLocations().then(r => setLocations(r.data));
  };
  const handleDeleteLoc = async (id) => {
    const { error } = await db.deleteLocation(id);
    if (error) { alert(error.message); return; }
    db.fetchLocations().then(r => setLocations(r.data));
  };
  const autoLocId = (type) => {
    const prefix = type === 'dock' ? 'D' : type === 'yard' ? 'Y' : 'GATE-';
    const existing = locations.filter(l => l.type === type).map(l => parseInt(l.id.replace(/\D/g, ''), 10)).filter(n => !isNaN(n));
    const next = existing.length > 0 ? Math.max(...existing) + 1 : 1;
    return type === 'gate' ? `GATE-${next}` : `${prefix}${String(next).padStart(2, '0')}`;
  };

  if (loading) return <div style={{ background: T.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner /></div>;

  // ─── RENDER: DASHBOARD ──────────────────────────────────────
  const renderDash = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14 }}>
        {[{ l: 'Pending Moves', v: pending.length, c: T.wn, i: '⏳' }, { l: 'In Progress', v: inProg.length, c: T.in, i: '🔄' }, { l: 'Completed Today', v: completed.length, c: T.ok, i: '✅' }, { l: 'Dock Usage', v: `${dkO.p}%`, s: `${dkO.o}/${dkO.t}`, c: T.ac, i: '🏗️' }, { l: 'Yard Usage', v: `${ydO.p}%`, s: `${ydO.o}/${ydO.t}`, c: T.pp, i: '📦' }, { l: 'Trailers on Site', v: trailers.length, c: T.in, i: '🚛' }].map(k => (
          <Card key={k.l}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}><div><div style={{ fontSize: 11, color: T.tm, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{k.l}</div><div style={{ fontSize: 28, fontWeight: 800, color: k.c, lineHeight: 1 }}>{k.v}</div>{k.s && <div style={{ fontSize: 12, color: T.td, marginTop: 4 }}>{k.s}</div>}</div><span style={{ fontSize: 24 }}>{k.i}</span></div></Card>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Card style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.bd}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Open Move Queue</h3><Btn small onClick={() => setShowNewMove(true)}>+ New Move</Btn></div>
          <div style={{ maxHeight: 340, overflow: 'auto' }}>
            <Tbl columns={[{ key: 'p', label: 'Pri', render: r => r.priority === 'urgent' ? <Badge color={T.dg}>URGENT</Badge> : <Badge color={T.td} small>Norm</Badge> }, { key: 't', label: 'Type', render: r => <span>{mti(r.type)} {mtl(r.type)}</span> }, { key: 'dock', label: 'Dock', render: r => locLabel(r.type === 'to-dock' ? r.to_location : r.from_location) }, { key: 'rt', label: 'Trailer Type', render: r => r.requested_trailer_type ? <Badge color={T.in} small>{r.requested_trailer_type}</Badge> : '—' }, { key: 'c', label: 'Claimed By', render: r => r.claimed_by ? <span><Dot color={userColor(r.claimed_by)} />{userName(r.claimed_by)}</span> : <span style={{ color: T.wn, fontWeight: 600, fontSize: 11 }}>⬤ Unclaimed</span> }, { key: 's', label: 'Status', render: r => <Badge color={sc(r.status)}>{r.status}</Badge> }]} data={moves.filter(m => m.status !== 'completed' && m.status !== 'cancelled').slice(0, 12)} onRow={r => setSelMove(r)} />
          </div>
        </Card>
        <Card style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.bd}` }}><h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Hostler Performance</h3></div>
          <div style={{ maxHeight: 340, overflow: 'auto' }}>
            <Tbl columns={[{ key: 'n', label: 'Driver', render: r => <span><Dot color={r.color} />{r.name}</span> }, { key: 'd', label: 'Done', render: r => <span style={{ fontWeight: 700, color: T.ok }}>{r.completed}</span> }, { key: 'a', label: 'Active', render: r => r.inProgress > 0 ? <Badge color={T.in}>{r.inProgress}</Badge> : '0' }, { key: 'av', label: 'Avg', render: r => r.avgMinutes > 0 ? `${r.avgMinutes}m` : '—' }, { key: 'total', label: 'Total' }]} data={hStats} />
          </div>
        </Card>
      </div>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.bd}` }}><h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Recent Activity</h3></div>
        <div style={{ maxHeight: 260, overflow: 'auto', padding: 16 }}>
          {moves.filter(m => m.completed_at).slice(0, 8).map(m => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: `1px solid ${T.bd}11` }}>
              <span style={{ fontSize: 18 }}>{mti(m.type)}</span>
              <div style={{ flex: 1 }}><div style={{ fontSize: 13 }}><strong>{userName(m.claimed_by)}</strong> {m.status === 'cancelled' ? 'cancelled' : 'completed'} <strong>{mtl(m.type)}</strong>{m.trailer_number ? <> — <TTag number={m.trailer_number} type={m.trailer_type || gtt(m.trailer_number)} /></> : null}</div><div style={{ fontSize: 11, color: T.td }}>{locLabel(m.from_location)} → {locLabel(m.to_location)}</div></div>
              <div style={{ fontSize: 11, color: T.tm, whiteSpace: 'nowrap' }}>{db.fmtTime(m.completed_at)}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );

  // ─── RENDER: MOVES ──────────────────────────────────────────
  const renderMoves = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Btn onClick={() => setShowNewMove(true)}>+ New Move Request</Btn>
        <Input placeholder="Search..." value={filter} onChange={setFilter} style={{ width: 180 }} />
        <Input options={[{ value: '', label: 'All Hostlers' }, ...hostlers.map(h => ({ value: h.id, label: h.name }))]} value={hf} onChange={setHf} style={{ width: 160 }} />
        <Input options={[{ value: '', label: 'All Statuses' }, { value: 'pending', label: 'Pending' }, { value: 'in-progress', label: 'In Progress' }, { value: 'completed', label: 'Completed' }, { value: 'cancelled', label: 'Cancelled' }]} value={sf} onChange={setSf} style={{ width: 150 }} />
      </div>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <Tbl columns={[{ key: 'mn', label: '#', render: r => r.move_number }, { key: 'p', label: 'Pri', render: r => r.priority === 'urgent' ? <Badge color={T.dg}>URGENT</Badge> : <Badge color={T.td} small>Norm</Badge> }, { key: 't', label: 'Type', render: r => <span>{mti(r.type)} {mtl(r.type)}</span> }, { key: 'dock', label: 'Dock', render: r => locLabel(r.type === 'to-dock' ? r.to_location : r.from_location) }, { key: 'tr', label: 'Trailer', render: r => r.trailer_number ? <TTag number={r.trailer_number} type={r.trailer_type || gtt(r.trailer_number)} /> : <span style={{ color: T.td }}>TBD</span> }, { key: 'rt', label: 'Req. Type', render: r => r.requested_trailer_type ? <Badge color={T.in} small>{r.requested_trailer_type}</Badge> : '—' }, { key: 'cb', label: 'Hostler', render: r => r.claimed_by ? <span><Dot color={userColor(r.claimed_by)} />{userName(r.claimed_by)}</span> : <span style={{ color: T.td }}>—</span> }, { key: 's', label: 'Status', render: r => <Badge color={sc(r.status)}>{r.status}</Badge> }, { key: 'cr', label: 'Requested', render: r => db.fmtTime(r.created_at) }, { key: 'rb', label: 'Req. By', render: r => r.requested_by || '—' }]}
          data={moves.filter(m => !filter || (m.trailer_number || '').includes(filter) || locLabel(m.from_location).toLowerCase().includes(filter.toLowerCase()) || locLabel(m.to_location).toLowerCase().includes(filter.toLowerCase())).filter(m => !hf || m.claimed_by === hf).filter(m => !sf || m.status === sf)} onRow={r => setSelMove(r)} />
      </Card>
    </div>
  );

  // ─── RENDER: TRAILERS ───────────────────────────────────────
  const renderTrailers = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><Btn onClick={() => setShowNewTrailer(true)}>+ Register Trailer</Btn><Input placeholder="Search..." value={filter} onChange={setFilter} style={{ width: 260 }} /></div>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <Tbl columns={[{ key: 'n', label: 'Trailer #', render: r => <TTag number={r.number} type={r.type} /> }, { key: 't', label: 'Type', render: r => <span style={{ fontWeight: 600 }}>{r.type}</span> }, { key: 'c', label: 'Carrier' }, { key: 's', label: 'Status', render: r => { const c = { Empty: T.td, Loaded: T.ok, Partial: T.wn, Sealed: T.pp, 'Live Load': T.in }[r.status] ?? T.tm; return <Badge color={c}>{r.status}</Badge>; } }, { key: 'l', label: 'Location', render: r => <span style={{ fontWeight: 600 }}>{locLabel(r.location_id)}</span> }, { key: 'lm', label: 'Last Moved', render: r => db.fmtDate(r.last_moved) }, { key: 'e', label: '', render: r => <Btn small variant="ghost" onClick={e => { e.stopPropagation(); setEditTrailer({ ...r }); }}>✏️ Edit</Btn> }]}
          data={trailers.filter(t => !filter || t.number.includes(filter) || (t.carrier || '').toLowerCase().includes(filter.toLowerCase()) || t.type.toLowerCase().includes(filter.toLowerCase()))} />
      </Card>
    </div>
  );

  // ─── RENDER: YARD MAP ───────────────────────────────────────
  const renderYard = () => {
    const at = lid => trailers.find(t => t.location_id === lid);
    const Zone = ({ title, spots, color }) => (<div style={{ marginBottom: 20 }}><div style={{ fontSize: 13, fontWeight: 700, color, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))', gap: 6 }}>{spots.map(s => { const tr = at(s.id); return (
        <div key={s.id} style={{ padding: '8px 10px', borderRadius: 6, background: tr ? color + '18' : T.sa, border: `1px solid ${tr ? color + '55' : T.bd}`, fontSize: 11, minHeight: 58, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontWeight: 700, color: T.tm, fontSize: 10 }}>{s.label}</div>
          {tr ? <><div style={{ fontWeight: 800, color, fontSize: 13, fontFamily: "'JetBrains Mono',monospace" }}>{tr.number}</div><div style={{ fontSize: 9, color: T.td }}>{tr.type} • {tr.status}</div><div style={{ fontSize: 8, color: T.td }}>{tr.carrier || ''}</div></> : <div style={{ fontSize: 10, color: T.td }}>Empty</div>}
        </div>); })}</div></div>);
    return (<div>
      <Zone title="🏗️ Shipping Docks" spots={dockLocs.filter(d => d.zone === 'Shipping')} color={T.ac} />
      <Zone title="📥 Receiving Docks" spots={dockLocs.filter(d => d.zone === 'Receiving')} color={T.in} />
      <Zone title="🔀 Cross-Docks" spots={dockLocs.filter(d => d.zone === 'Cross-Dock')} color={T.pp} />
      <Zone title="📦 Yard Spots" spots={yardLocs} color={T.ok} />
    </div>);
  };

  // ─── RENDER: HOSTLER VIEW ───────────────────────────────────
  const renderHostler = () => {
    const open = moves.filter(m => m.status === 'pending' && !m.claimed_by).sort((a, b) => (a.priority === 'urgent' ? -1 : 1) - (b.priority === 'urgent' ? -1 : 1) || new Date(a.created_at) - new Date(b.created_at));
    const myAct = moves.filter(m => m.claimed_by === currentUser.id && m.status === 'in-progress');
    const myDone = moves.filter(m => m.claimed_by === currentUser.id && (m.status === 'completed' || m.status === 'cancelled'));

    const MC = ({ m, actions }) => (<Card style={{ borderLeft: `4px solid ${m.status === 'in-progress' ? T.in : m.priority === 'urgent' ? T.dg : T.wn}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}><div><div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}><span style={{ fontSize: 20 }}>{mti(m.type)}</span><span style={{ fontSize: 16, fontWeight: 700 }}>{mtl(m.type)}</span>{m.priority === 'urgent' && <Badge color={T.dg}>URGENT</Badge>}<Badge color={sc(m.status)}>{m.status}</Badge></div><div style={{ fontSize: 12, color: T.tm }}>Move #{m.move_number} · Requested by {m.requested_by || '—'} · {db.fmtTime(m.created_at)}</div></div></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16, padding: 14, background: T.sa, borderRadius: 8 }}>
        <div><div style={{ fontSize: 10, color: T.td, textTransform: 'uppercase', fontWeight: 700, marginBottom: 3 }}>Dock</div><div style={{ fontSize: 14, fontWeight: 600 }}>{locLabel(m.type === 'to-dock' ? m.to_location : m.from_location)}</div></div>
        <div><div style={{ fontSize: 10, color: T.td, textTransform: 'uppercase', fontWeight: 700, marginBottom: 3 }}>{m.type === 'to-dock' ? 'Need' : 'Trailer'}</div><div style={{ fontSize: 14, fontWeight: 600 }}>{m.type === 'to-dock' ? (m.requested_trailer_type || 'Any') : (m.trailer_number ? <TTag number={m.trailer_number} type={m.trailer_type} /> : 'At dock')}</div></div>
        <div><div style={{ fontSize: 10, color: T.td, textTransform: 'uppercase', fontWeight: 700, marginBottom: 3 }}>{m.type === 'from-dock' && m.requested_trailer_type ? 'Need Back' : 'Info'}</div><div style={{ fontSize: 14, fontWeight: 600 }}>{m.type === 'from-dock' && m.requested_trailer_type ? <Badge color={T.in}>{m.requested_trailer_type}</Badge> : (m.type === 'to-dock' ? `→ ${locLabel(m.to_location)}` : `← ${locLabel(m.from_location)}`)}</div></div>
      </div>
      {m.notes && <div style={{ fontSize: 12, color: T.tm, marginBottom: 12, padding: '8px 12px', background: T.sa, borderRadius: 6, borderLeft: `3px solid ${T.wn}` }}>📝 {m.notes}</div>}{actions}</Card>);

    return (<div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card style={{ borderLeft: `4px solid ${currentUser.color}` }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div><div style={{ fontSize: 20, fontWeight: 800 }}>{currentUser.name}</div><div style={{ fontSize: 13, color: T.tm }}>{myAct.length} in progress · {myDone.filter(m => m.status === 'completed').length} completed this shift</div></div><div style={{ display: 'flex', gap: 8 }}><Badge color={T.in}>{myAct.length} Active</Badge><Badge color={T.ok}>{myDone.filter(m => m.status === 'completed').length} Done</Badge></div></div></Card>

      {myAct.length > 0 && <><h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.in, textTransform: 'uppercase' }}>🔄 My Active Moves</h3>{myAct.map(m => <MC key={m.id} m={m} actions={
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="success" onClick={() => { setCompleteModal(m); setCmFields({ trailerNumber: '', yardSpot: '', fromSpot: '', trailerType: '' }); }}>✓ Complete</Btn>
          <Btn variant="secondary" onClick={() => handleReleaseMove(m.id)}>↩ Release</Btn>
          <Btn variant="danger" onClick={() => { setCancelModal(m); setCancelReason(''); }}>✕ Cancel</Btn>
          <div style={{ fontSize: 11, color: T.td, marginTop: 8, alignSelf: 'center', marginLeft: 'auto' }}>Started {db.fmtTime(m.started_at)}</div>
        </div>} />)}</>}

      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.wn, textTransform: 'uppercase' }}>⏳ Open Requests ({open.length})</h3>
      {open.length === 0 && <Card style={{ textAlign: 'center', padding: 40 }}><div style={{ fontSize: 36 }}>✅</div><div style={{ fontSize: 16, fontWeight: 700, marginTop: 8 }}>No open requests!</div></Card>}
      {open.map(m => <MC key={m.id} m={m} actions={<Btn variant="primary" onClick={() => handleClaimMove(m.id)}>🙋 Claim This Move</Btn>} />)}

      {myDone.length > 0 && <Card style={{ padding: 0, overflow: 'hidden' }}><div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.bd}` }}><h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.tm }}>My History ({myDone.length})</h4></div>
        <Tbl columns={[{ key: 't', label: 'Type', render: r => <span>{mti(r.type)} {mtl(r.type)}</span> }, { key: 'tr', label: 'Trailer', render: r => r.trailer_number ? <TTag number={r.trailer_number} type={r.trailer_type} /> : '—' }, { key: 'dock', label: 'Dock', render: r => locLabel(r.type === 'to-dock' ? r.to_location : r.from_location) }, { key: 's', label: 'Status', render: r => <Badge color={sc(r.status)}>{r.status}</Badge> }, { key: 'co', label: 'Time', render: r => db.fmtTime(r.completed_at) }]} data={myDone.slice(0, 20)} /></Card>}
    </div>);
  };

  // ─── RENDER: ANALYTICS ──────────────────────────────────────
  const renderAnalytics = () => {
    const mph = hostlers.map(h => ({ ...h, moves: moves.filter(m => m.claimed_by === h.id && m.status === 'completed').length })).sort((a, b) => b.moves - a.moves);
    const maxM = Math.max(...mph.map(h => h.moves), 1);
    const mbt = MOVE_TYPES.map(mt => ({ ...mt, count: moves.filter(m => m.type === mt.id).length }));
    return (<div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Card><h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>Completed Moves per Hostler</h3><div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{mph.map(h => <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ width: 100, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><Dot color={h.color} />{h.name}</div><div style={{ flex: 1, height: 28, background: T.sa, borderRadius: 4, overflow: 'hidden' }}><div style={{ height: '100%', width: `${(h.moves / maxM) * 100}%`, background: `linear-gradient(90deg,${h.color}cc,${h.color})`, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8, minWidth: h.moves > 0 ? 30 : 0 }}><span style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>{h.moves}</span></div></div></div>)}</div></Card>
      <Card><h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>Moves by Type</h3>{mbt.map(mt => <div key={mt.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}><span style={{ fontSize: 18 }}>{mt.icon}</span><div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{mt.label}</div><span style={{ fontSize: 20, fontWeight: 800, color: T.ac }}>{mt.count}</span></div>)}</Card>
      <Card style={{ padding: 0, overflow: 'hidden' }}><div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.bd}` }}><h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Full Move Log</h3></div>
        <Tbl columns={[{ key: 'mn', label: '#', render: r => r.move_number }, { key: 'cr', label: 'Requested', render: r => db.fmtDate(r.created_at) }, { key: 't', label: 'Type', render: r => mtl(r.type) }, { key: 'tr', label: 'Trailer', render: r => r.trailer_number ? <TTag number={r.trailer_number} type={r.trailer_type} /> : '—' }, { key: 'cb', label: 'By', render: r => r.claimed_by ? userName(r.claimed_by) : '—' }, { key: 'co', label: 'Completed', render: r => r.completed_at ? db.fmtTime(r.completed_at) : '—' }, { key: 's', label: 'Status', render: r => <Badge color={sc(r.status)}>{r.status}</Badge> }, { key: 'dur', label: 'Duration', render: r => { if (!r.started_at || !r.completed_at) return '—'; return `${Math.round((new Date(r.completed_at) - new Date(r.started_at)) / 60000)}m`; } }]} data={moves} /></Card>
    </div>);
  };

  // ─── RENDER: USERS ──────────────────────────────────────────
  const renderUsers = () => {
    const filtered = users.filter(u => !userFilter || u.name.toLowerCase().includes(userFilter.toLowerCase()) || u.username.toLowerCase().includes(userFilter.toLowerCase()));
    const configRoles = ['manager', 'warehouse', 'hostler']; // admin always has full access
    const configScreens = allScreens.filter(s => s.id !== 'users' && s.id !== 'locations' && s.id !== 'settings'); // admin-only screens not configurable
    return (<div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}><Btn onClick={() => setShowAddUser(true)}>+ Add User</Btn><Input placeholder="Search..." value={userFilter} onChange={setUserFilter} style={{ width: 260 }} /><div style={{ marginLeft: 'auto', fontSize: 13, color: T.tm }}>{users.filter(u => u.active).length} active · {users.length} total</div></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>{ROLES.map(r => { const count = users.filter(u => u.role === r.id && u.active).length; return (<Card key={r.id} style={{ padding: 14 }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div><div style={{ fontSize: 11, color: T.tm, fontWeight: 600, textTransform: 'uppercase' }}>{r.label}s</div><div style={{ fontSize: 24, fontWeight: 800, color: ROLE_COLORS[r.id], marginTop: 4 }}>{count}</div></div><Badge color={ROLE_COLORS[r.id]}>{r.id}</Badge></div></Card>); })}</div>

      {/* Screen Access Controls */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>🔐 Screen Access by Role</h3>
          <Btn small variant="ghost" onClick={() => updateScreenAccess(DEFAULT_ACCESS)}>Reset to Defaults</Btn>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr>
              <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: `1px solid ${T.bd}`, color: T.tm, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Screen</th>
              {configRoles.map(r => <th key={r} style={{ textAlign: 'center', padding: '10px 12px', borderBottom: `1px solid ${T.bd}`, color: ROLE_COLORS[r], fontWeight: 700, fontSize: 12, textTransform: 'uppercase' }}>{r}</th>)}
            </tr></thead>
            <tbody>
              {configScreens.map(s => (
                <tr key={s.id} style={{ borderBottom: `1px solid ${T.bd}11` }}>
                  <td style={{ padding: '10px 12px', color: T.tx }}><span style={{ marginRight: 8 }}>{s.icon}</span>{s.label}</td>
                  {configRoles.map(r => {
                    const hasAccess = (screenAccess[r] || []).includes(s.id);
                    return <td key={r} style={{ textAlign: 'center', padding: '10px 12px' }}>
                      <button onClick={() => toggleAccess(r, s.id)} style={{ width: 32, height: 32, borderRadius: 6, border: `2px solid ${hasAccess ? T.ok : T.bd}`, background: hasAccess ? T.ok + '22' : 'transparent', color: hasAccess ? T.ok : T.td, cursor: 'pointer', fontSize: 16, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{hasAccess ? '✓' : ''}</button>
                    </td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 12, fontSize: 11, color: T.td }}>Admin always has full access. Users & Locations are admin-only.</div>
      </Card>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <Tbl columns={[{ key: 'av', label: '', render: r => <Avatar name={r.name} color={r.color} size={28} /> }, { key: 'name', label: 'Name', render: r => <div><div style={{ fontWeight: 600 }}>{r.name}</div><div style={{ fontSize: 11, color: T.td, fontFamily: "'JetBrains Mono',monospace" }}>{r.username}</div></div> }, { key: 'role', label: 'Role', render: r => <Badge color={ROLE_COLORS[r.role]}>{r.role}</Badge> }, { key: 'active', label: 'Status', render: r => r.active ? <Badge color={T.ok}>Active</Badge> : <Badge color={T.dg}>Disabled</Badge> }, { key: 'cr', label: 'Created', render: r => db.fmtDate(r.created_at) }, { key: 'actions', label: 'Actions', render: r => (<div style={{ display: 'flex', gap: 6 }}><Btn small variant="ghost" onClick={e => { e.stopPropagation(); setEditUser({ ...r }); }}>✏️</Btn><Btn small variant="ghost" onClick={e => { e.stopPropagation(); setShowPwReset(r); }}>🔑</Btn><Btn small variant="ghost" onClick={e => { e.stopPropagation(); handleToggleUser(r.id, r.active); }}>{r.active ? '🚫' : '✅'}</Btn>{r.id !== currentUser.id && <Btn small variant="ghost" onClick={e => { e.stopPropagation(); if (confirm(`Delete ${r.name}?`)) handleDeleteUser(r.id); }}>🗑️</Btn>}</div>) }]} data={filtered.sort((a, b) => { const ro = { admin: 0, manager: 1, warehouse: 2, hostler: 3 }; return (ro[a.role] ?? 9) - (ro[b.role] ?? 9); })} />
      </Card>
    </div>);
  };

  // ─── RENDER: LOCATIONS ──────────────────────────────────────
  const renderLocations = () => {
    const LOC_COLORS = { dock: T.ac, yard: T.ok, gate: T.pp };
    const filtered = locations.filter(l => !locFilter || l.label.toLowerCase().includes(locFilter.toLowerCase()) || l.id.toLowerCase().includes(locFilter.toLowerCase()) || l.type.includes(locFilter.toLowerCase()));
    const byType = [
      { type: 'dock', label: 'Docks', icon: '🏗️' },
      { type: 'yard', label: 'Yard Spots', icon: '📦' },
      { type: 'gate', label: 'Gates', icon: '🚪' },
    ];
    return (<div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Btn onClick={() => { const t = 'dock'; setNewLoc({ id: autoLocId(t), label: '', type: t, zone: '' }); setShowAddLoc(true); }}>+ Add Location</Btn>
        <Input placeholder="Search locations..." value={locFilter} onChange={setLocFilter} style={{ width: 240 }} />
        <div style={{ marginLeft: 'auto', fontSize: 13, color: T.tm }}>{dockLocs.length} docks · {yardLocs.length} yard · {locations.filter(l => l.type === 'gate').length} gates</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {byType.map(bt => {
          const count = locations.filter(l => l.type === bt.type).length;
          const occupied = trailers.filter(t => locations.some(l => l.type === bt.type && l.id === t.location_id)).length;
          return (<Card key={bt.type} style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div><div style={{ fontSize: 11, color: T.tm, fontWeight: 600, textTransform: 'uppercase' }}>{bt.icon} {bt.label}</div><div style={{ fontSize: 24, fontWeight: 800, color: LOC_COLORS[bt.type], marginTop: 4 }}>{count}</div><div style={{ fontSize: 11, color: T.td }}>{occupied} occupied</div></div>
            </div>
          </Card>);
        })}
      </div>
      {byType.map(bt => {
        const locs = filtered.filter(l => l.type === bt.type);
        if (locs.length === 0) return null;
        return (<Card key={bt.type} style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.bd}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{bt.icon} {bt.label} ({locs.length})</h3>
            <Btn small onClick={() => { setNewLoc({ id: autoLocId(bt.type), label: '', type: bt.type, zone: bt.type === 'dock' ? 'Shipping' : '' }); setShowAddLoc(true); }}>+ Add</Btn>
          </div>
          <Tbl columns={[
            { key: 'id', label: 'ID', render: r => <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: LOC_COLORS[r.type] }}>{r.id}</span> },
            { key: 'label', label: 'Name', render: r => <span style={{ fontWeight: 600 }}>{r.label}</span> },
            { key: 'type', label: 'Type', render: r => <Badge color={LOC_COLORS[r.type]}>{r.type}</Badge> },
            ...(bt.type === 'dock' ? [{ key: 'zone', label: 'Zone', render: r => r.zone ? <Badge color={r.zone === 'Shipping' ? T.ac : r.zone === 'Receiving' ? T.in : T.pp} small>{r.zone}</Badge> : '—' }] : []),
            { key: 'trailer', label: 'Current Trailer', render: r => { const tr = trailers.find(t => t.location_id === r.id); return tr ? <TTag number={tr.number} type={tr.type} /> : <span style={{ color: T.td }}>Empty</span>; } },
            { key: 'actions', label: '', render: r => (<div style={{ display: 'flex', gap: 6 }}>
              <Btn small variant="ghost" onClick={e => { e.stopPropagation(); setEditLoc({ ...r }); }}>✏️</Btn>
              <Btn small variant="ghost" onClick={e => { e.stopPropagation(); if (confirm(`Delete ${r.label}?`)) handleDeleteLoc(r.id); }}>🗑️</Btn>
            </div>) },
          ]} data={locs.sort((a, b) => a.id.localeCompare(b.id))} />
        </Card>);
      })}
    </div>);
  };

  // ─── RENDER: SETTINGS ────────────────────────────────────────
  const saveSetting = async (key, value) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    await db.updateSettings(updated);
  };
  const renderSettings = () => {
    const ListEditor = ({ title, items, onAdd, onRemove, newVal, setNewVal, placeholder }) => (
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.tx, marginBottom: 10 }}>{title}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          {items.map(item => (
            <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: T.sa, border: `1px solid ${T.bd}`, borderRadius: 6, fontSize: 13 }}>
              <span>{item}</span>
              <button onClick={() => onRemove(item)} style={{ background: 'none', border: 'none', color: T.dg, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', padding: 0, lineHeight: 1 }}>✕</button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={newVal} onChange={e => setNewVal(e.target.value)} placeholder={placeholder} onKeyDown={e => { if (e.key === 'Enter' && newVal.trim()) { onAdd(); } }} style={{ flex: 1, padding: '8px 12px', borderRadius: 6, background: T.sa, border: `1px solid ${T.bd}`, color: T.tx, fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
          <Btn small onClick={onAdd} disabled={!newVal.trim()}>+ Add</Btn>
        </div>
      </div>
    );
    return (<div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Card>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>🚛 Trailer Types</h3>
        <ListEditor title="" items={TRAILER_TYPES}
          onAdd={() => { if (newType.trim() && !TRAILER_TYPES.includes(newType.trim())) { saveSetting('trailerTypes', [...TRAILER_TYPES, newType.trim()]); setNewType(''); } }}
          onRemove={item => { if (confirm(`Remove "${item}" trailer type?`)) saveSetting('trailerTypes', TRAILER_TYPES.filter(t => t !== item)); }}
          newVal={newType} setNewVal={setNewType} placeholder="e.g. Intermodal, Container..." />
      </Card>

      <Card>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>📋 Trailer Statuses</h3>
        <ListEditor title="" items={TRAILER_STATUSES}
          onAdd={() => { if (newStatus.trim() && !TRAILER_STATUSES.includes(newStatus.trim())) { saveSetting('trailerStatuses', [...TRAILER_STATUSES, newStatus.trim()]); setNewStatus(''); } }}
          onRemove={item => { if (confirm(`Remove "${item}" status?`)) saveSetting('trailerStatuses', TRAILER_STATUSES.filter(s => s !== item)); }}
          newVal={newStatus} setNewVal={setNewStatus} placeholder="e.g. Damaged, Quarantine..." />
      </Card>

      <Card>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>📊 Performance Targets</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: T.tm, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Moves/Hour Target</label>
            <input type="number" value={settings.movesPerHourTarget} onChange={e => saveSetting('movesPerHourTarget', parseInt(e.target.value) || 0)} style={{ width: '100%', padding: '9px 12px', borderRadius: 6, background: T.sa, border: `1px solid ${T.bd}`, color: T.tx, fontSize: 16, fontWeight: 700, fontFamily: 'inherit', outline: 'none' }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: T.tm, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Max Minutes/Move</label>
            <input type="number" value={settings.maxMoveMinutes} onChange={e => saveSetting('maxMoveMinutes', parseInt(e.target.value) || 0)} style={{ width: '100%', padding: '9px 12px', borderRadius: 6, background: T.sa, border: `1px solid ${T.bd}`, color: T.tx, fontSize: 16, fontWeight: 700, fontFamily: 'inherit', outline: 'none' }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: T.tm, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Shift Hours</label>
            <input type="number" value={settings.shiftHours} onChange={e => saveSetting('shiftHours', parseInt(e.target.value) || 0)} style={{ width: '100%', padding: '9px 12px', borderRadius: 6, background: T.sa, border: `1px solid ${T.bd}`, color: T.tx, fontSize: 16, fontWeight: 700, fontFamily: 'inherit', outline: 'none' }} />
          </div>
        </div>
        <div style={{ marginTop: 14, display: 'flex', gap: 20 }}>
          <div style={{ fontSize: 12, color: T.td }}>Moves flagged <Badge color={T.dg} small>SLOW</Badge> if over {settings.maxMoveMinutes} min</div>
          <div style={{ fontSize: 12, color: T.td }}>Hostler target: {settings.movesPerHourTarget} moves/hr × {settings.shiftHours}hr = <strong style={{ color: T.ok }}>{settings.movesPerHourTarget * settings.shiftHours} moves/shift</strong></div>
        </div>
      </Card>

      <Card>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>⚙️ Move Behavior</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => saveSetting('autoCreateSendBack', !settings.autoCreateSendBack)} style={{ width: 44, height: 24, borderRadius: 12, border: 'none', background: settings.autoCreateSendBack ? T.ok : T.bd, cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: settings.autoCreateSendBack ? 23 : 3, transition: 'left 0.2s' }} />
          </button>
          <div><div style={{ fontSize: 13, fontWeight: 600, color: T.tx }}>Auto-create "To Dock" on From Dock completion</div><div style={{ fontSize: 11, color: T.td }}>When a From Dock request includes a trailer type needed back, automatically create a new To Dock move</div></div>
        </div>
      </Card>

      <Card>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>🏷️ Site Name</h3>
        <Input label="Displayed in header and login screen" value={settings.siteName} onChange={v => saveSetting('siteName', v)} placeholder="YardFlow" />
      </Card>
    </div>);
  };

  // Screen access helper functions
  const updateScreenAccess = (newAccess) => {
    setScreenAccess(newAccess);
    localStorage.setItem('yf_screen_access', JSON.stringify(newAccess));
  };
  const toggleAccess = (roleId, screenId) => {
    if (roleId === 'admin' && (screenId === 'users' || screenId === 'locations' || screenId === 'settings')) return;
    const current = screenAccess[roleId] || [];
    const updated = current.includes(screenId) ? current.filter(s => s !== screenId) : [...current, screenId];
    updateScreenAccess({ ...screenAccess, [roleId]: updated });
  };

  // ─── NAV ────────────────────────────────────────────────────
  const allScreens = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'moves', label: 'Move Requests', icon: '🔄', count: pending.length },
    { id: 'trailers', label: 'Trailer Inventory', icon: '🚛' },
    { id: 'yard', label: 'Yard Map', icon: '🗺️' },
    { id: 'hostler', label: 'Hostler View', icon: '👷' },
    { id: 'analytics', label: 'Analytics', icon: '📈' },
    { id: 'locations', label: 'Locations', icon: '📍' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
    { id: 'users', label: 'Users', icon: '👥' },
  ];
  const myAccess = screenAccess[role] || DEFAULT_ACCESS[role] || [];
  const nav = allScreens.filter(s => myAccess.includes(s.id));

  return (
    <div style={{ background: T.bg, color: T.tx, minHeight: '100vh', display: 'flex' }}>
      <div style={{ width: 240, background: T.sf, borderRight: `1px solid ${T.bd}`, display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'sticky', top: 0, height: '100vh' }}>
        <div style={{ padding: '20px 18px', borderBottom: `1px solid ${T.bd}` }}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div style={{ width: 36, height: 36, borderRadius: 8, background: `linear-gradient(135deg,${T.ac},#FF8F5C)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🏭</div><div><div style={{ fontWeight: 800, fontSize: 15 }}>YardFlow</div><div style={{ fontSize: 10, color: T.tm }}>Trailer Management</div></div></div></div>
        <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {nav.map(item => <button key={item.id} onClick={() => { setView(item.id); setFilter(''); setSf(''); setHf(''); setUserFilter(''); setLocFilter(''); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, background: view === item.id ? T.ag : 'transparent', border: view === item.id ? `1px solid ${T.ac}44` : '1px solid transparent', color: view === item.id ? T.ac : T.tm, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', textAlign: 'left' }}>
            <span style={{ fontSize: 16 }}>{item.icon}</span><span style={{ flex: 1 }}>{item.label}</span>
            {item.count > 0 && <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 10, background: T.dg, color: '#fff' }}>{item.count}</span>}
          </button>)}
        </nav>
        <div style={{ padding: '14px 16px', borderTop: `1px solid ${T.bd}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <Avatar name={currentUser.name} color={currentUser.color} size={32} />
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentUser.name}</div><Badge color={ROLE_COLORS[currentUser.role]} small>{currentUser.role}</Badge></div>
          </div>
          <button onClick={onLogout} style={{ width: '100%', padding: '8px 0', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: T.sa, color: T.tm, border: `1px solid ${T.bd}`, fontFamily: 'inherit' }}>Sign Out</button>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{ padding: '14px 24px', borderBottom: `1px solid ${T.bd}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: T.sf, position: 'sticky', top: 0, zIndex: 100 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>{nav.find(n => n.id === view)?.icon} {nav.find(n => n.id === view)?.label}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 12, color: T.tm }}>{clock.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {clock.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>
            {role !== 'hostler' && <Btn small onClick={() => setShowNewMove(true)}>+ New Move</Btn>}
          </div>
        </header>
        <div style={{ flex: 1, padding: 24, overflow: 'auto' }}>
          {view === 'dashboard' && renderDash()}
          {view === 'moves' && renderMoves()}
          {view === 'trailers' && renderTrailers()}
          {view === 'yard' && renderYard()}
          {view === 'hostler' && renderHostler()}
          {view === 'analytics' && renderAnalytics()}
          {view === 'locations' && isAdmin && renderLocations()}
          {view === 'settings' && isAdmin && renderSettings()}
          {view === 'users' && isAdmin && renderUsers()}
        </div>
      </div>

      {/* ── NEW MOVE MODAL (To Dock / From Dock) ── */}
      <Modal open={showNewMove} onClose={() => setShowNewMove(false)} title="New Move Request" width={520}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {MOVE_TYPES.map(mt => (
              <button key={mt.id} onClick={() => setNm(p => ({ ...p, type: mt.id, dock: '', trailerType: '', requestBackType: '' }))}
                style={{ flex: 1, padding: '14px 16px', borderRadius: 8, background: nm.type === mt.id ? T.ac + '22' : T.sa, border: `2px solid ${nm.type === mt.id ? T.ac : T.bd}`, color: nm.type === mt.id ? T.ac : T.tm, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, textAlign: 'center' }}>
                <div style={{ fontSize: 24, marginBottom: 4 }}>{mt.icon}</div>{mt.label}
                <div style={{ fontSize: 10, fontWeight: 400, marginTop: 2, opacity: 0.7 }}>{mt.desc}</div>
              </button>
            ))}
          </div>

          {nm.type !== 'yard-move' && (
            <Input label={nm.type === 'to-dock' ? 'Destination Dock' : 'Source Dock'} options={dockLocs.map(l => ({ value: l.id, label: l.label }))} value={nm.dock} onChange={v => setNm(p => ({ ...p, dock: v }))} />
          )}

          {nm.type === 'yard-move' && (
            <div style={{ padding: '10px 14px', background: T.in + '15', borderRadius: 8, fontSize: 12, color: T.in }}>ℹ️ Hostler will input trailer #, from location, and to location when completing this move.</div>
          )}

          {nm.type === 'to-dock' && (
            <Input label="Trailer Type Needed" options={[{ value: '', label: '— Any Type —' }, ...TRAILER_TYPES.map(t => ({ value: t, label: t }))]} value={nm.trailerType} onChange={v => setNm(p => ({ ...p, trailerType: v }))} />
          )}

          {nm.type === 'from-dock' && (
            <Input label="Need a Trailer Back? (optional)" options={[{ value: '', label: '— No, just pull —' }, ...TRAILER_TYPES.map(t => ({ value: t, label: t }))]} value={nm.requestBackType || ''} onChange={v => setNm(p => ({ ...p, requestBackType: v }))} />
          )}

          <Input label="Priority" options={[{ value: 'normal', label: 'Normal' }, { value: 'urgent', label: '🔴 Urgent' }]} value={nm.priority} onChange={v => setNm(p => ({ ...p, priority: v }))} />
          <Input label="Notes" value={nm.notes} onChange={v => setNm(p => ({ ...p, notes: v }))} placeholder="Special instructions..." />

          <div style={{ padding: '10px 14px', background: T.sa, borderRadius: 8, fontSize: 12, color: T.tm, display: 'flex', justifyContent: 'space-between' }}>
            <span>Requested by:</span><strong style={{ color: T.tx }}>{currentUser.name}</strong>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <Btn variant="secondary" onClick={() => setShowNewMove(false)}>Cancel</Btn>
            <Btn onClick={handleCreateMove} disabled={nm.type !== 'yard-move' && !nm.dock}>Submit Request</Btn>
          </div>
        </div>
      </Modal>

      {/* ── HOSTLER COMPLETE MODAL ── */}
      <Modal open={!!completeModal} onClose={() => setCompleteModal(null)} title={`Complete Move #${completeModal?.move_number}`} width={480}>
        {completeModal && <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ padding: 14, background: T.sa, borderRadius: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}><span style={{ fontSize: 18 }}>{mti(completeModal.type)}</span><strong>{mtl(completeModal.type)}</strong></div>
            {completeModal.type !== 'yard-move' && <div style={{ fontSize: 13, color: T.tm }}>Dock: <strong style={{ color: T.tx }}>{locLabel(completeModal.type === 'to-dock' ? completeModal.to_location : completeModal.from_location)}</strong></div>}
            {completeModal.type === 'yard-move' && <div style={{ fontSize: 13, color: T.tm }}>Relocate a trailer within the yard</div>}
            {completeModal.requested_trailer_type && <div style={{ fontSize: 13, color: T.tm, marginTop: 4 }}>Requested type: <Badge color={T.in}>{completeModal.requested_trailer_type}</Badge></div>}
          </div>

          {completeModal.type === 'to-dock' && <>
            <Input label="Trailer # You're Bringing" value={cmFields.trailerNumber} onChange={v => setCmFields(p => ({ ...p, trailerNumber: v }))} placeholder="e.g. 4521" />
            {cmFields.trailerNumber && trailerMap[cmFields.trailerNumber] && <div style={{ padding: '8px 12px', background: T.ok + '15', borderRadius: 6, fontSize: 12, color: T.ok }}>✓ Found: {trailerMap[cmFields.trailerNumber].type} — {trailerMap[cmFields.trailerNumber].status} at {locLabel(trailerMap[cmFields.trailerNumber].location_id)}</div>}
            <Input label="Pulled From (Yard Spot)" options={yardLocs.map(l => ({ value: l.id, label: l.label }))} value={cmFields.yardSpot} onChange={v => setCmFields(p => ({ ...p, yardSpot: v }))} />
          </>}

          {completeModal.type === 'from-dock' && <>
            <Input label="Trailer # Being Pulled" value={cmFields.trailerNumber} onChange={v => setCmFields(p => ({ ...p, trailerNumber: v }))} placeholder="e.g. 4521" />
            {cmFields.trailerNumber && trailerMap[cmFields.trailerNumber] && <div style={{ padding: '8px 12px', background: T.ok + '15', borderRadius: 6, fontSize: 12, color: T.ok }}>✓ Found: {trailerMap[cmFields.trailerNumber].type} — {trailerMap[cmFields.trailerNumber].status} at {locLabel(trailerMap[cmFields.trailerNumber].location_id)}</div>}
            <Input label="Dropped At (Yard Spot)" options={yardLocs.map(l => ({ value: l.id, label: l.label }))} value={cmFields.yardSpot} onChange={v => setCmFields(p => ({ ...p, yardSpot: v }))} />
            {completeModal.requested_trailer_type && <div style={{ padding: '8px 12px', background: T.in + '15', borderRadius: 6, fontSize: 12, color: T.in }}>ℹ️ A new "To Dock" request for a <strong>{completeModal.requested_trailer_type}</strong> will be auto-created when you complete this.</div>}
          </>}

          {completeModal.type === 'yard-move' && <>
            <Input label="Trailer #" value={cmFields.trailerNumber} onChange={v => setCmFields(p => ({ ...p, trailerNumber: v }))} placeholder="e.g. 4521" />
            {cmFields.trailerNumber && trailerMap[cmFields.trailerNumber] && <div style={{ padding: '8px 12px', background: T.ok + '15', borderRadius: 6, fontSize: 12, color: T.ok }}>✓ Found: {trailerMap[cmFields.trailerNumber].type} — {trailerMap[cmFields.trailerNumber].status} at {locLabel(trailerMap[cmFields.trailerNumber].location_id)}</div>}
            <Input label="From Location" options={locations.map(l => ({ value: l.id, label: l.label }))} value={cmFields.fromSpot} onChange={v => setCmFields(p => ({ ...p, fromSpot: v }))} />
            <Input label="To Location" options={locations.map(l => ({ value: l.id, label: l.label }))} value={cmFields.yardSpot} onChange={v => setCmFields(p => ({ ...p, yardSpot: v }))} />
          </>}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <Btn variant="secondary" onClick={() => setCompleteModal(null)}>Back</Btn>
            <Btn variant="success" onClick={handleCompleteMove} disabled={!cmFields.trailerNumber || !cmFields.yardSpot || (completeModal.type === 'yard-move' && !cmFields.fromSpot)}>✓ Complete Move</Btn>
          </div>
        </div>}
      </Modal>

      {/* ── CANCEL MOVE MODAL ── */}
      <Modal open={!!cancelModal} onClose={() => setCancelModal(null)} title={`Cancel Move #${cancelModal?.move_number}`} width={420}>
        {cancelModal && <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 13, color: T.tm }}>This will permanently cancel the move and log the reason.</div>
          <Input label="Reason for Cancellation (required)" value={cancelReason} onChange={setCancelReason} placeholder="e.g. Trailer not found, dock blocked..." />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <Btn variant="secondary" onClick={() => setCancelModal(null)}>Back</Btn>
            <Btn variant="danger" onClick={handleCancelMove} disabled={!cancelReason.trim()}>✕ Cancel Move</Btn>
          </div>
        </div>}
      </Modal>

      {/* ── EXISTING MODALS ── */}
      <Modal open={showNewTrailer} onClose={() => setShowNewTrailer(false)} title="Register New Trailer">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label="Trailer Number" value={nt.number} onChange={v => setNt(p => ({ ...p, number: v }))} placeholder="e.g. 9200" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}><Input label="Trailer Type" options={TRAILER_TYPES.map(t => ({ value: t, label: t }))} value={nt.type} onChange={v => setNt(p => ({ ...p, type: v }))} /><Input label="Status" options={TRAILER_STATUSES.map(s => ({ value: s, label: s }))} value={nt.status} onChange={v => setNt(p => ({ ...p, status: v }))} /></div>
          <Input label="Location" options={locations.map(l => ({ value: l.id, label: l.label }))} value={nt.location} onChange={v => setNt(p => ({ ...p, location: v }))} />
          <Input label="Carrier" value={nt.carrier} onChange={v => setNt(p => ({ ...p, carrier: v }))} />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}><Btn variant="secondary" onClick={() => setShowNewTrailer(false)}>Cancel</Btn><Btn onClick={handleCreateTrailer} disabled={!nt.number || !nt.location}>Register</Btn></div>
        </div>
      </Modal>

      <Modal open={!!editTrailer} onClose={() => setEditTrailer(null)} title={`Edit Trailer ${editTrailer?.number}`}>
        {editTrailer && <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}><Input label="Type" options={TRAILER_TYPES.map(t => ({ value: t, label: t }))} value={editTrailer.type} onChange={v => setEditTrailer(p => ({ ...p, type: v }))} /><Input label="Status" options={TRAILER_STATUSES.map(s => ({ value: s, label: s }))} value={editTrailer.status} onChange={v => setEditTrailer(p => ({ ...p, status: v }))} /></div>
          <Input label="Location" options={locations.map(l => ({ value: l.id, label: l.label }))} value={editTrailer.location_id} onChange={v => setEditTrailer(p => ({ ...p, location_id: v }))} />
          <Input label="Carrier" value={editTrailer.carrier || ''} onChange={v => setEditTrailer(p => ({ ...p, carrier: v }))} />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}><Btn variant="secondary" onClick={() => setEditTrailer(null)}>Cancel</Btn><Btn onClick={handleEditTrailer}>Save</Btn></div>
        </div>}
      </Modal>

      <Modal open={!!selMove} onClose={() => setSelMove(null)} title={`Move #${selMove?.move_number}`} width={560}>
        {selMove && <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><span style={{ fontSize: 22 }}>{mti(selMove.type)}</span><span style={{ fontSize: 17, fontWeight: 700 }}>{mtl(selMove.type)}</span>{selMove.priority === 'urgent' && <Badge color={T.dg}>URGENT</Badge>}<Badge color={sc(selMove.status)}>{selMove.status}</Badge></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, padding: 16, background: T.sa, borderRadius: 8 }}>
            <div><div style={{ fontSize: 10, color: T.td, textTransform: 'uppercase', fontWeight: 700 }}>Dock</div><div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{locLabel(selMove.type === 'to-dock' ? selMove.to_location : selMove.from_location)}</div></div>
            <div><div style={{ fontSize: 10, color: T.td, textTransform: 'uppercase', fontWeight: 700 }}>Trailer</div><div style={{ marginTop: 4 }}>{selMove.trailer_number ? <TTag number={selMove.trailer_number} type={selMove.trailer_type} /> : <span style={{ color: T.td }}>TBD by hostler</span>}</div></div>
            <div><div style={{ fontSize: 10, color: T.td, textTransform: 'uppercase', fontWeight: 700 }}>Requested By</div><div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{selMove.requested_by || '—'}</div></div>
            <div><div style={{ fontSize: 10, color: T.td, textTransform: 'uppercase', fontWeight: 700 }}>Completed By</div><div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{selMove.claimed_by ? <span><Dot color={userColor(selMove.claimed_by)} />{userName(selMove.claimed_by)}</span> : <span style={{ color: T.wn }}>Unclaimed</span>}</div></div>
          </div>
          {selMove.requested_trailer_type && <div style={{ padding: '8px 12px', background: T.in + '15', borderRadius: 6, fontSize: 12 }}>Requested trailer type: <Badge color={T.in}>{selMove.requested_trailer_type}</Badge></div>}
          {selMove.cancel_reason && <div style={{ padding: '8px 12px', background: T.dg + '15', borderRadius: 6, fontSize: 12, color: T.dg }}>Cancel reason: {selMove.cancel_reason}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
            {[['Requested', selMove.created_at], ['Claimed', selMove.claimed_at], ['Started', selMove.started_at], ['Completed', selMove.completed_at]].map(([l, v]) => <div key={l}><div style={{ fontSize: 10, color: T.td, textTransform: 'uppercase', fontWeight: 700 }}>{l}</div><div style={{ fontSize: 12 }}>{v ? db.fmtDate(v) : '—'}</div></div>)}
          </div>
        </div>}
      </Modal>

      <Modal open={showAddUser} onClose={() => setShowAddUser(false)} title="Add New User">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}><Input label="Full Name" value={newUser.name} onChange={v => setNewUser(p => ({ ...p, name: v }))} placeholder="John Smith" /><Input label="Username" value={newUser.username} onChange={v => setNewUser(p => ({ ...p, username: v }))} placeholder="john.s" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}><Input label="Password" value={newUser.password} onChange={v => setNewUser(p => ({ ...p, password: v }))} /><Input label="Role" options={ROLES.map(r => ({ value: r.id, label: r.label }))} value={newUser.role} onChange={v => setNewUser(p => ({ ...p, role: v }))} /></div>
          <div><label style={{ fontSize: 11, fontWeight: 600, color: T.tm, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Color</label><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="color" value={newUser.color} onChange={e => setNewUser(p => ({ ...p, color: e.target.value }))} style={{ width: 40, height: 32, border: 'none', borderRadius: 6, cursor: 'pointer' }} /><Avatar name={newUser.name || '?'} color={newUser.color} size={32} /></div></div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}><Btn variant="secondary" onClick={() => setShowAddUser(false)}>Cancel</Btn><Btn onClick={handleAddUser} disabled={!newUser.name || !newUser.username || !newUser.password || !newUser.role}>Create User</Btn></div>
        </div>
      </Modal>

      <Modal open={!!editUser} onClose={() => setEditUser(null)} title={`Edit: ${editUser?.name}`}>
        {editUser && <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label="Name" value={editUser.name} onChange={v => setEditUser(p => ({ ...p, name: v }))} />
          <Input label="Username" value={editUser.username} onChange={v => setEditUser(p => ({ ...p, username: v }))} />
          <Input label="Role" options={ROLES.map(r => ({ value: r.id, label: r.label }))} value={editUser.role} onChange={v => setEditUser(p => ({ ...p, role: v }))} />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}><Btn variant="secondary" onClick={() => setEditUser(null)}>Cancel</Btn><Btn onClick={handleEditUser}>Save</Btn></div>
        </div>}
      </Modal>

      <Modal open={!!showPwReset} onClose={() => setShowPwReset(null)} title={`Reset Password: ${showPwReset?.name}`} width={400}>
        {showPwReset && <PwReset user={showPwReset} onReset={handleResetPw} onCancel={() => setShowPwReset(null)} />}
      </Modal>

      <Modal open={showAddLoc} onClose={() => setShowAddLoc(false)} title="Add Location">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label="Type" options={[{ value: 'dock', label: '🏗️ Dock' }, { value: 'yard', label: '📦 Yard Spot' }, { value: 'gate', label: '🚪 Gate' }]} value={newLoc.type} onChange={v => setNewLoc(p => ({ ...p, type: v, id: autoLocId(v), zone: v === 'dock' ? 'Shipping' : '' }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label="Location ID" value={newLoc.id} onChange={v => setNewLoc(p => ({ ...p, id: v }))} placeholder="e.g. D25, Y41" />
            <Input label="Display Name" value={newLoc.label} onChange={v => setNewLoc(p => ({ ...p, label: v }))} placeholder="e.g. Dock 25" />
          </div>
          {newLoc.type === 'dock' && <Input label="Zone" options={[{ value: 'Shipping', label: 'Shipping' }, { value: 'Receiving', label: 'Receiving' }, { value: 'Cross-Dock', label: 'Cross-Dock' }]} value={newLoc.zone} onChange={v => setNewLoc(p => ({ ...p, zone: v }))} />}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}><Btn variant="secondary" onClick={() => setShowAddLoc(false)}>Cancel</Btn><Btn onClick={handleAddLoc} disabled={!newLoc.id || !newLoc.label || !newLoc.type}>Add Location</Btn></div>
        </div>
      </Modal>

      <Modal open={!!editLoc} onClose={() => setEditLoc(null)} title={`Edit Location: ${editLoc?.label}`}>
        {editLoc && <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label="Location ID" value={editLoc.id} onChange={v => setEditLoc(p => ({ ...p, id: v }))} />
          <Input label="Display Name" value={editLoc.label} onChange={v => setEditLoc(p => ({ ...p, label: v }))} />
          <Input label="Type" options={[{ value: 'dock', label: '🏗️ Dock' }, { value: 'yard', label: '📦 Yard Spot' }, { value: 'gate', label: '🚪 Gate' }]} value={editLoc.type} onChange={v => setEditLoc(p => ({ ...p, type: v }))} />
          {editLoc.type === 'dock' && <Input label="Zone" options={[{ value: 'Shipping', label: 'Shipping' }, { value: 'Receiving', label: 'Receiving' }, { value: 'Cross-Dock', label: 'Cross-Dock' }]} value={editLoc.zone || ''} onChange={v => setEditLoc(p => ({ ...p, zone: v }))} />}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}><Btn variant="secondary" onClick={() => setEditLoc(null)}>Cancel</Btn><Btn onClick={handleEditLoc}>Save</Btn></div>
        </div>}
      </Modal>
    </div>
  );
}

function PwReset({ user, onReset, onCancel }) {
  const [pw, setPw] = useState('');
  const [conf, setConf] = useState('');
  return (<div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Avatar name={user.name} color={user.color} size={36} /><div><div style={{ fontWeight: 700, color: T.tx }}>{user.name}</div><div style={{ fontSize: 12, color: T.td }}>{user.username}</div></div></div>
    <Input label="New Password" type="password" value={pw} onChange={setPw} />
    <Input label="Confirm" type="password" value={conf} onChange={setConf} />
    {pw && conf && pw !== conf && <div style={{ fontSize: 12, color: T.dg }}>Passwords do not match</div>}
    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><Btn variant="secondary" onClick={onCancel}>Cancel</Btn><Btn onClick={() => onReset(user.id, pw)} disabled={!pw || pw !== conf}>Reset</Btn></div>
  </div>);
}
