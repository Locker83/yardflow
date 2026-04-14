import { useState, useEffect, useCallback, useMemo, Component, Fragment } from 'react';
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

// ─── FACILITY YARD MAP DATA (positions from Excel) ───
const FACILITY_SPOTS = [[4,39,"N01","N1"],[4,40,"N02","N2"],[4,41,"N03","N3"],[4,42,"N04","N4"],[4,43,"N05","N5"],[4,44,"N06","N6"],[4,45,"N07","N7"],[4,46,"N08","N8"],[4,47,"N09","N9"],[4,48,"N10","N10"],[4,49,"N11","N11"],[4,50,"N12","N12"],[4,51,"N13","N13"],[4,52,"N14","N14"],[4,53,"N15","N15"],[4,54,"N16","N16"],[4,55,"N17","N17"],[6,37,"CC47","CC47"],[7,37,"CC46","CC46"],[7,56,"R01","R1"],[8,37,"CC45","CC45"],[8,47,"M01","M1"],[8,56,"R02","R2"],[9,37,"CC44","CC44"],[9,47,"M02","M2"],[9,56,"R03","R3"],[10,37,"CC43","CC43"],[10,47,"M03","M3"],[10,56,"R04","R4"],[11,11,"D-TATERS1","TATERS1"],[11,30,"X01","X1"],[11,31,"X02","X2"],[11,32,"X03","X3"],[11,33,"X04","X4"],[11,34,"X05","X5"],[11,35,"X06","X6"],[11,37,"CC42","CC42"],[11,47,"M04","M4"],[11,56,"R05","R5"],[12,37,"CC41","CC41"],[12,47,"M05","M5"],[12,56,"R06","R6"],[13,30,"X07","X7"],[13,31,"X08","X8"],[13,32,"X09","X9"],[13,33,"X10","X10"],[13,34,"X11","X11"],[13,35,"X12","X12"],[13,37,"CC40","CC40"],[13,47,"M06","M6"],[13,56,"R07","R7"],[14,11,"D-BF1","BF1"],[14,37,"CC39","CC39"],[14,47,"M07","M7"],[14,56,"R08","R8"],[15,30,"X13","X13"],[15,31,"X14","X14"],[15,32,"X15","X15"],[15,33,"X16","X16"],[15,34,"X17","X17"],[15,35,"X18","X18"],[15,37,"CC38","CC38"],[15,47,"M08","M8"],[15,56,"R09","R9"],[16,37,"CC37","CC37"],[16,47,"M09","M9"],[16,56,"R10","R10"],[17,30,"X19","X19"],[17,31,"X20","X20"],[17,32,"X21","X21"],[17,33,"X22","X22"],[17,34,"X23","X23"],[17,35,"X24","X24"],[17,37,"CC36","CC36"],[17,47,"M10","M10"],[17,56,"R11","R11"],[18,37,"CC35","CC35"],[18,47,"M11","M11"],[18,56,"R12","R12"],[19,37,"CC34","CC34"],[19,47,"M12","M12"],[19,56,"R13","R13"],[20,37,"CC33","CC33"],[20,47,"M13","M13"],[20,56,"R14","R14"],[21,37,"CC32","CC32"],[21,47,"M14","M14"],[21,56,"R15","R15"],[22,12,"D-RD1","RD1"],[22,37,"CC31","CC31"],[22,47,"M15","M15"],[22,56,"R16","R16"],[23,12,"D-RD2","RD2"],[23,37,"CC30","CC30"],[23,47,"M16","M16"],[23,56,"R17","R17"],[24,37,"CC29","CC29"],[24,47,"M17","M17"],[24,56,"R18","R18"],[25,37,"CC28","CC28"],[25,47,"M18","M18"],[25,56,"R19","R19"],[26,37,"CC27","CC27"],[26,47,"M19","M19"],[26,56,"R20","R20"],[27,37,"CC26","CC26"],[27,47,"M20","M20"],[27,56,"R21","R21"],[28,37,"CC25","CC25"],[28,47,"M21","M21"],[28,56,"R22","R22"],[29,37,"CC24","CC24"],[29,47,"M22","M22"],[29,56,"R23","R23"],[30,37,"CC23","CC23"],[30,47,"M23","M23"],[30,56,"R24","R24"],[31,37,"CC22","CC22"],[31,47,"M24","M24"],[31,56,"R25","R25"],[32,37,"CC21","CC21"],[32,47,"M25","M25"],[32,56,"R26","R26"],[33,37,"CC20","CC20"],[33,47,"M26","M26"],[33,56,"R27","R27"],[34,37,"CC19","CC19"],[34,47,"M27","M27"],[34,56,"R28","R28"],[35,3,"LIVE01","LIVE 1"],[35,37,"CC18","CC18"],[35,47,"M28","M28"],[35,56,"R29","R29"],[36,3,"LIVE02","LIVE 2"],[36,37,"CC17","CC17"],[36,47,"M29","M29"],[36,56,"R30","R30"],[37,3,"LIVE03","LIVE 3"],[37,37,"CC16","CC16"],[37,47,"M30","M30"],[37,56,"R31","R31"],[38,3,"LIVE04","LIVE 4"],[38,37,"CC15","CC15"],[38,47,"M31","M31"],[38,56,"R32","R32"],[39,3,"LIVE05","LIVE 5"],[39,37,"CC14","CC14"],[39,47,"M32","M32"],[39,56,"R33","R33"],[40,3,"LIVE06","LIVE 6"],[40,37,"CC13","CC13"],[40,47,"M33","M33"],[40,56,"R34","R34"],[41,3,"LIVE07","LIVE 7"],[41,37,"CC12","CC12"],[41,47,"M34","M34"],[41,56,"R35","R35"],[42,3,"LIVE08","LIVE 8"],[42,37,"CC11","CC11"],[42,47,"M35","M35"],[42,56,"R36","R36"],[43,3,"LIVE09","LIVE 9"],[43,37,"CC10","CC10"],[43,47,"M36","M36"],[43,56,"R37","R37"],[44,3,"LIVE10","LIVE 10"],[44,37,"CC09","CC9"],[44,47,"M37","M37"],[45,3,"LIVE11","LIVE 11"],[45,37,"CC08","CC8"],[45,47,"M38","M38"],[46,3,"LIVE12","LIVE 12"],[46,37,"CC07","CC7"],[46,47,"M39","M39"],[47,3,"LIVE13","LIVE 13"],[47,37,"CC06","CC6"],[47,47,"M40","M40"],[47,55,"R38","R38"],[48,3,"LIVE14","LIVE 14"],[48,37,"CC05","CC5"],[48,47,"M41","M41"],[48,55,"R39","R39"],[49,3,"ZONE01","ZONE 1"],[49,37,"CC04","CC4"],[49,47,"M42","M42"],[49,55,"R40","R40"],[50,3,"ZONE02","ZONE 2"],[50,37,"CC03","CC3"],[50,47,"M43","M43"],[50,55,"R41","R41"],[51,3,"ZONE03","ZONE 3"],[51,37,"CC02","CC2"],[51,47,"M44","M44"],[51,55,"R42","R42"],[52,3,"ZONE04","ZONE 4"],[52,30,"D-KD1","KD 1"],[52,37,"CC01","CC1"],[52,47,"M45","M45"],[52,55,"R43","R43"],[53,3,"ZONE05","ZONE 5"],[53,47,"M46","M46"],[53,55,"R44","R44"],[54,3,"ZONE06","ZONE 6"],[54,12,"D001","1"],[54,47,"M47","M47"],[55,3,"ZONE07","ZONE 7"],[55,12,"D002","2"],[55,36,"D051","51"],[55,47,"M48","M48"],[56,3,"ZONE08","ZONE 8"],[56,12,"D003","3"],[56,36,"D052","52"],[56,47,"M49","M49"],[57,3,"ZONE09","ZONE 9"],[57,12,"D004","4"],[57,36,"D053","53"],[57,47,"M50","M50"],[57,58,"DL01","DL1"],[57,59,"DL02","DL2"],[57,60,"DL03","DL3"],[57,61,"DL04","DL4"],[57,62,"DL05","DL5"],[57,63,"DL06","DL6"],[57,64,"DL07","DL7"],[58,3,"ZONE10","ZONE 10"],[58,12,"D005","5"],[58,36,"D054","54"],[58,47,"M51","M51"],[59,3,"ZONE11","ZONE 11"],[59,12,"D006","6"],[59,36,"D055","55"],[59,47,"M52","M52"],[60,3,"ZONE12","ZONE 12"],[60,12,"D007","7"],[60,36,"D056","56"],[60,47,"M53","M53"],[60,65,"DL08","DL8"],[61,3,"ZONE13","ZONE 13"],[61,12,"D008","8"],[61,36,"D057","57"],[61,47,"M54","M54"],[61,65,"DL09","DL9"],[62,3,"ZONE14","ZONE 14"],[62,12,"D009","9"],[62,36,"D058","58"],[62,47,"M55","M55"],[62,65,"DL10","DL10"],[63,3,"ZONE15","ZONE 15"],[63,12,"D010","10"],[63,36,"D059","59"],[63,47,"M56","M56"],[63,65,"DL11","DL11"],[64,3,"ZONE16","ZONE 16"],[64,12,"D011","11"],[64,36,"D060","60"],[64,47,"M57","M57"],[64,65,"DL12","DL12"],[65,3,"ZONE17","ZONE 17"],[65,12,"D012","12"],[65,36,"D061","61"],[65,47,"M58","M58"],[65,65,"DL13","DL13"],[66,3,"ZONE18","ZONE 18"],[66,12,"D013","13"],[66,36,"D062","62"],[66,47,"M59","M59"],[66,65,"DL14","DL14"],[67,3,"ZONE19","ZONE 19"],[67,12,"D014","14"],[67,36,"D063","63"],[67,47,"M60","M60"],[67,65,"DL15","DL15"],[68,3,"ZONE20","ZONE 20"],[68,12,"D015","15"],[68,36,"D064","64"],[68,47,"M61","M61"],[68,65,"DL16","DL16"],[69,3,"ZONE21","ZONE 21"],[69,12,"D016","16"],[69,36,"W14","W14"],[69,65,"DL17","DL17"],[70,3,"ZONE22","ZONE 22"],[70,12,"D017","17"],[70,36,"W13","W13"],[70,65,"DL18","DL18"],[71,3,"ZONE23","ZONE 23"],[71,12,"D018","18"],[71,36,"W12","W12"],[71,65,"DL19","DL19"],[72,3,"ZONE24","ZONE 24"],[72,12,"D019","19"],[72,36,"W11","W11"],[72,52,"ST01","ST1"],[72,54,"ST02","ST2"],[72,65,"DL20","DL20"],[73,12,"D020","20"],[73,36,"W10","W10"],[73,52,"ST03","ST3"],[73,54,"ST04","ST4"],[73,65,"DL21","DL21"],[74,2,"HOLD9","HOLD 9"],[74,12,"D021","21"],[74,36,"W09","W9"],[74,52,"ST05","ST5"],[74,54,"ST06","ST6"],[74,65,"DL22","DL22"],[75,2,"HOLD8","HOLD 8"],[75,12,"D022","22"],[75,36,"W08","W8"],[75,52,"ST07","ST7"],[75,54,"ST08","ST8"],[75,65,"DL23","DL23"],[76,2,"HOLD7","HOLD 7"],[76,12,"D023","23"],[76,36,"W07","W7"],[76,52,"ST09","ST9"],[76,54,"ST10","ST10"],[76,65,"DL24","DL24"],[77,2,"HOLD6","HOLD 6"],[77,12,"D024","24"],[77,36,"W06","W6"],[77,52,"ST11","ST11"],[77,54,"ST12","ST12"],[77,65,"DL25","DL25"],[78,36,"W05","W5"],[78,52,"BX6","BX 6"],[78,54,"ST13","ST13"],[79,36,"W04","W4"],[79,52,"BX5","BX 5"],[80,12,"D026","26"],[80,36,"W03","W3"],[80,52,"BX4","BX 4"],[81,12,"D027","27"],[81,36,"W02","W2"],[81,52,"BX3","BX 3"],[82,12,"D028","28"],[82,36,"W01","W1"],[82,52,"BX2","BX 2"],[83,12,"D029","29"],[83,52,"BX1","BX 1"],[84,12,"D030","30"],[84,52,"TEMP1","TEMP 1"],[84,54,"TEMP2","TEMP 2"],[85,12,"D031","31"],[86,12,"D032","32"],[87,12,"D033","33"],[88,12,"D034","34"],[89,12,"D035","35"],[90,12,"D036","36"],[91,12,"D037","37"],[92,12,"D038","38"],[93,12,"D039","39"],[94,12,"D040","40"],[95,12,"D041","41"],[96,12,"D042","42"],[97,12,"D043","43"],[98,12,"D044","44"],[99,12,"D045","45"]];
const FACILITY_LONG_HOLDS = [[78,3,5,"HOLD5","HOLD 5"],[83,3,4,"HOLD4","HOLD 4"],[87,3,4,"HOLD3","HOLD 3"],[91,3,4,"HOLD2","HOLD 2"],[95,3,5,"HOLD1","HOLD 1"]];
const FACILITY_BUILDINGS = [[5,13,17,95,"PLANT BUILDING"],[55,30,6,14,""],[22,1,4,3,"DRIVERS LOUNGE"],[42,9,4,4,"OFFICES /\nCONFERENCE"],[102,11,4,3,"GUARD SHACK"],[86,47,7,14,"TRAFFIC CENTER"],[88,48,5,4,"FUEL ISLAND"],[79,55,3,5,"EQUIP SHED"],[78,66,3,5,"EQUIPMENT &\nSTORAGE"]];
const FACILITY_ZONES = [[34,1,7,14,"LIVE LOAD PARKING"],[48,1,7,25,"ZONE PARKING"],[73,1,9,28,"HOLD PARKING"]];

// Module-level ListEditor — defined here so it's stable across App renders
// (defining inside App caused inputs to lose focus on every keystroke)
function ListEditor({ title, items, onAdd, onRemove, newVal, setNewVal, placeholder }) {
  return (
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
}

// ─── LOGIN ──────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    const { user, error: err } = await db.loginUser(username, password);
    setLoading(false);
    if (err) { setError(err); return; }
    onLogin(user);
  };

  const handleForgot = async () => {
    if (!forgotEmail.trim()) return;
    setForgotLoading(true);
    setForgotMsg('');
    const { error } = await db.requestPasswordReset(forgotEmail.trim());
    setForgotLoading(false);
    if (error) { setForgotMsg('⚠️ ' + error.message); }
    else { setForgotMsg('✅ Reset link sent! Check your email (including spam folder).'); }
  };

  return (
    <div style={{ background: '#0C1B2E', color: T.tx, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
      {/* Deep navy base with PepsiCo brand gradient sweep */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #0A1628 0%, #0F2341 30%, #122A4E 50%, #0F2341 70%, #0A1628 100%)' }} />
      {/* Subtle grid pattern */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)', backgroundSize: '32px 32px' }} />
      {/* PepsiCo blue glow - top left */}
      <div style={{ position: 'absolute', top: '-10%', left: '-5%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,99,178,0.15) 0%, transparent 65%)', filter: 'blur(40px)' }} />
      {/* PepsiCo red glow - bottom right */}
      <div style={{ position: 'absolute', bottom: '-10%', right: '-5%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(213,0,50,0.1) 0%, transparent 65%)', filter: 'blur(40px)' }} />
      {/* Orange accent glow - center behind card */}
      <div style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translateX(-50%)', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,107,44,0.08) 0%, transparent 70%)', filter: 'blur(60px)' }} />
      {/* Diagonal stripe accent */}
      <div style={{ position: 'absolute', top: 0, right: 0, width: '40%', height: '100%', background: 'linear-gradient(160deg, transparent 40%, rgba(0,99,178,0.04) 40%, rgba(0,99,178,0.04) 42%, transparent 42%, transparent 44%, rgba(213,0,50,0.03) 44%, rgba(213,0,50,0.03) 45.5%, transparent 45.5%)', pointerEvents: 'none' }} />
      {/* Bottom accent bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #0063B2, #D50032, #FF6B2C)' }} />
      <div style={{ position: 'relative', zIndex: 1, width: 420, maxWidth: '90vw' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <img src="/logo.png" alt="Fayetteville Yard Flow" style={{ width: 220, height: 220, borderRadius: 20, objectFit: 'contain', marginBottom: 20 }} />
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: '-0.03em' }}>Fayetteville Yard Flow</h1>
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
            <button onClick={() => { setShowForgot(true); setForgotEmail(''); setForgotMsg(''); }} style={{ background: 'none', border: 'none', color: T.tm, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', marginTop: 6, textAlign: 'center', textDecoration: 'underline' }}>Forgot password?</button>
          </div>
        </Card>
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: T.td }}>
          <div>Owner: <strong style={{ color: T.tm }}>Joshua Locker</strong></div>
          <div style={{ marginTop: 4 }}>Feedback & Support: <a href="mailto:Joshua.Locker@Pepsico.com" style={{ color: T.ac, textDecoration: 'none' }}>Joshua.Locker@Pepsico.com</a></div>
        </div>
      </div>
      <Modal open={showForgot} onClose={() => setShowForgot(false)} title="🔑 Reset Password" width={440}>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: T.tm }}>Enter the email associated with your account. We'll send you a link to reset your password.</p>
        <Input label="Email Address" type="email" value={forgotEmail} onChange={setForgotEmail} placeholder="your.email@pepsico.com" onKeyDown={e => e.key === 'Enter' && handleForgot()} />
        {forgotMsg && <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 8, fontSize: 13, background: forgotMsg.startsWith('✅') ? T.ok + '18' : T.dg + '18', border: `1px solid ${forgotMsg.startsWith('✅') ? T.ok : T.dg}44`, color: forgotMsg.startsWith('✅') ? T.ok : T.dg }}>{forgotMsg}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
          <Btn variant="secondary" onClick={() => setShowForgot(false)}>Cancel</Btn>
          <Btn onClick={handleForgot} disabled={!forgotEmail.trim() || forgotLoading}>{forgotLoading ? 'Sending...' : 'Send Reset Link'}</Btn>
        </div>
      </Modal>
    </div>
  );
}

// ─── PASSWORD RESET SCREEN ──────────────────────────────────
function ResetPasswordScreen({ onDone }) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (pw.length < 6) { setMsg('⚠️ Password must be at least 6 characters'); return; }
    if (pw !== pw2) { setMsg('⚠️ Passwords do not match'); return; }
    setLoading(true);
    // Get user info from Supabase Auth (set when they clicked the reset link)
    const { data: { user: authUser } } = await db.supabase.auth.getUser();
    const email = authUser?.email;
    let username = null;
    if (email) {
      const { data } = await db.supabase.from('users').select('username').eq('email', email).single();
      username = data?.username;
    }
    const { error } = await db.updateOwnPassword(pw, username);
    setLoading(false);
    if (error) { setMsg('⚠️ ' + error.message); return; }
    setMsg('✅ Password updated! Redirecting to login...');
    setTimeout(() => { window.history.replaceState({}, '', window.location.pathname); onDone(); }, 1500);
  };

  return (
    <div style={{ background: '#0C1B2E', color: T.tx, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #0A1628 0%, #0F2341 30%, #122A4E 50%, #0F2341 70%, #0A1628 100%)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #0063B2, #D50032, #FF6B2C)' }} />
      <div style={{ position: 'relative', zIndex: 1, width: 420, maxWidth: '90vw' }}>
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <img src="/logo.png" alt="Logo" style={{ width: 140, height: 140, borderRadius: 16, objectFit: 'contain', marginBottom: 12 }} />
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Set Your Password</h1>
        </div>
        <Card style={{ padding: 28 }}>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: T.tm }}>Choose a new password for your Yard Flow account.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Input label="New Password" type="password" value={pw} onChange={setPw} placeholder="At least 6 characters" />
            <Input label="Confirm Password" type="password" value={pw2} onChange={setPw2} placeholder="Re-enter password" onKeyDown={e => e.key === 'Enter' && handleReset()} />
            {msg && <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, background: msg.startsWith('✅') ? T.ok + '18' : T.dg + '18', border: `1px solid ${msg.startsWith('✅') ? T.ok : T.dg}44`, color: msg.startsWith('✅') ? T.ok : T.dg }}>{msg}</div>}
            <Btn onClick={handleReset} disabled={!pw || !pw2 || loading} style={{ width: '100%', justifyContent: 'center', padding: '12px 20px', fontSize: 14, marginTop: 4 }}>{loading ? 'Updating...' : 'Update Password'}</Btn>
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
  const [resetMode, setResetMode] = useState(() => {
    // Detect Supabase password recovery link (one-time check, no persistent listener)
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    return hash.includes('type=recovery') || hash.includes('access_token') || search.includes('reset=1');
  });

  const handleLogin = (user) => { setCurrentUser(user); sessionStorage.setItem('yf_user', JSON.stringify(user)); };
  const handleLogout = () => { setCurrentUser(null); sessionStorage.removeItem('yf_user'); };

  if (resetMode) return <ResetPasswordScreen onDone={() => { setResetMode(false); try { db.supabase.auth.signOut(); } catch {} window.history.replaceState({}, '', window.location.pathname); }} />;
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
  const [view, setView] = useState(role === 'hostler' ? 'hostler' : role === 'guard' ? 'guard' : 'dashboard');
  const [showNewMove, setShowNewMove] = useState(false);
  const [showNewTrailer, setShowNewTrailer] = useState(false);
  const [editTrailer, setEditTrailer] = useState(null);
  const [selMove, setSelMove] = useState(null);
  const [filter, setFilter] = useState('');
  const [sf, setSf] = useState('');
  const [hf, setHf] = useState('');
  const [clock, setClock] = useState(new Date());
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);
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
  const [newUser, setNewUser] = useState({ username: '', password: '', name: '', email: '', role: 'hostler', color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0') });
  const [newLoc, setNewLoc] = useState({ id: '', label: '', type: 'dock', zone: '' });
  // Hostler completion/cancel modals
  const [completeModal, setCompleteModal] = useState(null); // move being completed
  const [cmFields, setCmFields] = useState({ trailerNumber: '', yardSpot: '', fromSpot: '' });
  const [cancelModal, setCancelModal] = useState(null); // move being cancelled
  const [cancelReason, setCancelReason] = useState('');
  const [settings, setSettings] = useState(db.DEFAULT_SETTINGS);
  const [newType, setNewType] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [newCarrier, setNewCarrier] = useState('');
  const [newLoadType, setNewLoadType] = useState('');
  // Gate log
  const [gateLog, setGateLog] = useState([]);
  const [gateEntry, setGateEntry] = useState({ direction: 'in', load_id: '', trailer_number: '', carrier: '', load_type: '', notes: '' });
  const [gateFilter, setGateFilter] = useState('');
  const [archiveCount, setArchiveCount] = useState(0);
  const [selectedYardLoc, setSelectedYardLoc] = useState(null);

  // Derived from settings
  const TRAILER_TYPES = settings.trailerTypes || db.DEFAULT_SETTINGS.trailerTypes;
  const TRAILER_STATUSES = settings.trailerStatuses || db.DEFAULT_SETTINGS.trailerStatuses;
  const CARRIERS = settings.carriers || db.DEFAULT_SETTINGS.carriers;
  const LOAD_TYPES = settings.loadTypes || db.DEFAULT_SETTINGS.loadTypes;

  // Screen access controls (admin-configurable, stored in localStorage)
  const DEFAULT_ACCESS = {
    admin: ['dashboard', 'moves', 'trailers', 'yard', 'hostler', 'analytics', 'guard', 'locations', 'settings', 'users'],
    manager: ['dashboard', 'moves', 'trailers', 'yard', 'analytics', 'guard'],
    warehouse: ['moves', 'trailers', 'yard'],
    hostler: ['hostler', 'yard'],
    guard: ['guard'],
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
        db.fetchGateLog().then(r => setGateLog(r.data || []));
        db.fetchArchiveCount().then(setArchiveCount);
      } catch (err) { console.error('Failed to load data:', err); }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    const moveSub = db.subscribeToMoves(() => { db.fetchMoves().then(r => setMoves(r.data || [])); });
    const trailerSub = db.subscribeToTrailers(() => { db.fetchTrailers().then(r => setTrailers(r.data || [])); });
    const locSub = db.subscribeToLocations(() => { db.fetchLocations().then(r => setLocations(r.data || [])); });
    const settSub = db.subscribeToSettings(() => { db.fetchSettings().then(r => { if (r.data) setSettings(r.data); }); });
    const gateSub = db.subscribeToGateLog(() => { db.fetchGateLog().then(r => setGateLog(r.data || [])); });
    return () => { moveSub.unsubscribe(); trailerSub.unsubscribe(); locSub.unsubscribe(); settSub.unsubscribe(); gateSub.unsubscribe(); };
  }, []);

  useEffect(() => { const t = setInterval(() => setClock(new Date()), 30000); return () => clearInterval(t); }, []);

  // Responsive: detect mobile and auto-collapse sidebar
  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
    };
    window.addEventListener('resize', onResize);
    onResize();
    return () => window.removeEventListener('resize', onResize);
  }, []);

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
  const completedToday = useMemo(() => moves.filter(m => m.status === 'completed' && db.isToday(m.completed_at)), [moves]);
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
    setShowAddUser(false); setNewUser({ username: '', password: '', name: '', email: '', role: 'hostler', color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0') });
    db.fetchUsers().then(r => setUsers(r.data));
  };
  const handleEditUser = async () => {
    if (!editUser) return;
    await db.updateUser(editUser.id, { name: editUser.name, username: editUser.username, email: editUser.email, role: editUser.role, color: editUser.color });
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
        {[{ l: 'Pending Moves', v: pending.length, c: T.wn, i: '⏳' }, { l: 'In Progress', v: inProg.length, c: T.in, i: '🔄' }, { l: 'Completed Today', v: completedToday.length, c: T.ok, i: '✅' }, { l: 'Dock Usage', v: `${dkO.p}%`, s: `${dkO.o}/${dkO.t}`, c: T.ac, i: '🏗️' }, { l: 'Yard Usage', v: `${ydO.p}%`, s: `${ydO.o}/${ydO.t}`, c: T.pp, i: '📦' }, { l: 'Trailers on Site', v: trailers.length, c: T.in, i: '🚛' }].map(k => (
          <Card key={k.l}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}><div><div style={{ fontSize: 11, color: T.tm, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{k.l}</div><div style={{ fontSize: 28, fontWeight: 800, color: k.c, lineHeight: 1 }}>{k.v}</div>{k.s && <div style={{ fontSize: 12, color: T.td, marginTop: 4 }}>{k.s}</div>}</div><span style={{ fontSize: 24 }}>{k.i}</span></div></Card>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
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
    const EMPTY = T.ok;
    const OCCUPIED = T.in;
    const BUILDING_BG = '#5C4A38';
    const BUILDING_BORDER = '#8B6F4E';
    const BUILDING_TEXT = '#E8D9C4';
    const FUEL_BG = '#7A5C3A';
    const FUEL_BORDER = '#A88560';
    const ZONE_BG = '#3A332A';
    const ZONE_BORDER = '#5C4A38';
    const ZONE_TEXT = '#A89580';
    const CELL_W = 38, CELL_H = 26;
    const ROWS = 110, COLS = 69;

    const allYardSpots = locations.filter(l => l.type === 'yard');
    const allDocks = locations.filter(l => l.type === 'dock');
    const occupiedYard = allYardSpots.filter(s => at(s.id)).length;
    const occupiedDocks = allDocks.filter(s => at(s.id)).length;

    const handleSpotClick = (id) => {
      const loc = locations.find(l => l.id === id);
      if (loc) setSelectedYardLoc({ loc, trailer: at(id) });
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card style={{ padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <div><div style={{ fontSize: 10, color: T.tm, textTransform: 'uppercase', fontWeight: 700 }}>Docks</div><div style={{ fontSize: 16, fontWeight: 800 }}><span style={{ color: OCCUPIED }}>{occupiedDocks}</span> <span style={{ color: T.tm }}>/ {allDocks.length}</span></div></div>
              <div><div style={{ fontSize: 10, color: T.tm, textTransform: 'uppercase', fontWeight: 700 }}>Yard Spots</div><div style={{ fontSize: 16, fontWeight: 800 }}><span style={{ color: OCCUPIED }}>{occupiedYard}</span> <span style={{ color: T.tm }}>/ {allYardSpots.length}</span></div></div>
              <div><div style={{ fontSize: 10, color: T.tm, textTransform: 'uppercase', fontWeight: 700 }}>Total Trailers</div><div style={{ fontSize: 16, fontWeight: 800, color: T.ac }}>{trailers.length}</div></div>
            </div>
            <div style={{ display: 'flex', gap: 14, fontSize: 11, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 14, height: 14, background: EMPTY + '22', border: `1.5px solid ${EMPTY}`, borderRadius: 3 }} /><span style={{ color: T.tm }}>Empty</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 14, height: 14, background: OCCUPIED + '44', border: `1.5px solid ${OCCUPIED}`, borderRadius: 3 }} /><span style={{ color: T.tm }}>Occupied</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 14, height: 14, background: BUILDING_BG, border: `1.5px solid ${BUILDING_BORDER}`, borderRadius: 3 }} /><span style={{ color: T.tm }}>Building</span></div>
              <div style={{ color: T.td, fontSize: 10 }}>Tap any spot for details</div>
            </div>
          </div>
        </Card>

        <Card style={{ padding: 16, overflow: 'auto', maxHeight: '75vh' }}>
          <div style={{ position: 'relative', width: COLS * CELL_W, height: ROWS * CELL_H }}>
            {FACILITY_ZONES.map(([r, c, w, h, text], i) => (
              <Fragment key={'zone-' + i}>
                <div style={{ position: 'absolute', left: c * CELL_W, top: r * CELL_H, width: w * CELL_W - 2, height: h * CELL_H - 2, background: ZONE_BG, border: `1px dashed ${ZONE_BORDER}`, borderRadius: 4 }} />
                <div style={{ position: 'absolute', left: c * CELL_W + 4, top: r * CELL_H + 6, height: h * CELL_H - 12, width: 24, color: ZONE_TEXT, fontSize: 14, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', writingMode: 'vertical-rl', transform: 'rotate(180deg)', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>{text}</div>
              </Fragment>
            ))}

            {FACILITY_BUILDINGS.map(([r, c, w, h, text], i) => {
              const isFuel = text === 'FUEL ISLAND';
              const isTC = text === 'TRAFFIC CENTER';
              return (
                <div key={'bldg-' + i} style={{ position: 'absolute', left: c * CELL_W, top: r * CELL_H, width: w * CELL_W - 2, height: h * CELL_H - 2, background: isFuel ? FUEL_BG : BUILDING_BG, border: `2px solid ${isFuel ? FUEL_BORDER : BUILDING_BORDER}`, borderRadius: 6, color: BUILDING_TEXT, fontSize: 15, fontWeight: 800, padding: 10, textTransform: 'uppercase', letterSpacing: '0.12em', display: 'flex', alignItems: isTC ? 'flex-start' : 'center', justifyContent: 'center', textAlign: 'center', whiteSpace: 'pre-line', lineHeight: 1.3 }}>{text}</div>
              );
            })}

            {FACILITY_LONG_HOLDS.map(([r, c, h, id, label]) => {
              const tr = at(id);
              const color = tr ? OCCUPIED : EMPTY;
              const bg = tr ? OCCUPIED + '44' : EMPTY + '22';
              return (
                <div key={id} onClick={() => handleSpotClick(id)} title={label + (tr ? ': ' + tr.number : ': Empty')} style={{ position: 'absolute', left: c * CELL_W, top: r * CELL_H, width: CELL_W * 2 - 2, height: h * CELL_H - 2, background: bg, border: `2px solid ${color}`, borderRadius: 4, color, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', lineHeight: 1.2 }}>
                  <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 12, opacity: 0.8, fontWeight: 700 }}>{label}</div>
                  {tr && <div style={{ marginTop: 6, fontWeight: 800, fontSize: 14 }}>{tr.number}</div>}
                </div>
              );
            })}

            {FACILITY_SPOTS.map(([r, c, id, label]) => {
              const tr = at(id);
              const color = tr ? OCCUPIED : EMPTY;
              const bg = tr ? OCCUPIED + '44' : EMPTY + '22';
              return (
                <div key={id} onClick={() => handleSpotClick(id)} title={label + (tr ? ': ' + tr.number : ': Empty')} style={{ position: 'absolute', left: c * CELL_W, top: r * CELL_H, width: CELL_W - 3, height: CELL_H - 2, background: bg, border: `1.5px solid ${color}`, borderRadius: 3, color, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', lineHeight: 1.1 }}>
                  {tr ? (
                    <Fragment>
                      <div style={{ fontSize: 9, opacity: 0.8 }}>{label}</div>
                      <div style={{ fontSize: 11, fontWeight: 800 }}>{tr.number}</div>
                    </Fragment>
                  ) : (
                    <div style={{ fontSize: 11 }}>{label}</div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <Modal open={!!selectedYardLoc} onClose={() => setSelectedYardLoc(null)} title={selectedYardLoc ? `${selectedYardLoc.loc.label} (${selectedYardLoc.loc.id})` : ''} width={460}>
          {selectedYardLoc && <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ padding: 14, background: T.sa, borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: T.tm, textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Type</div>
              <Badge color={selectedYardLoc.loc.type === 'dock' ? T.ac : selectedYardLoc.loc.type === 'gate' ? T.wn : T.in}>{selectedYardLoc.loc.type}</Badge>
            </div>
            {selectedYardLoc.trailer ? (
              <div style={{ padding: 14, background: OCCUPIED + '15', border: `1px solid ${OCCUPIED}44`, borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: T.tm, textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>Trailer Currently Here</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: OCCUPIED, fontFamily: "'JetBrains Mono', monospace", marginBottom: 8 }}>{selectedYardLoc.trailer.number}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {selectedYardLoc.trailer.type && <Badge color={T.in}>{selectedYardLoc.trailer.type}</Badge>}
                  {selectedYardLoc.trailer.status && <Badge color={T.pp}>{selectedYardLoc.trailer.status}</Badge>}
                  {selectedYardLoc.trailer.carrier && <Badge color={T.tm}>{selectedYardLoc.trailer.carrier}</Badge>}
                </div>
                {selectedYardLoc.trailer.notes && <div style={{ marginTop: 10, fontSize: 12, color: T.tm }}>📝 {selectedYardLoc.trailer.notes}</div>}
                {selectedYardLoc.trailer.last_moved && <div style={{ marginTop: 10, fontSize: 11, color: T.td }}>Last moved: {db.fmtDate(selectedYardLoc.trailer.last_moved)}</div>}
              </div>
            ) : (
              <div style={{ padding: 20, background: EMPTY + '15', border: `1px solid ${EMPTY}44`, borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>✓</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: EMPTY }}>Empty / Available</div>
              </div>
            )}
          </div>}
        </Modal>
      </div>
    );
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
    const configRoles = ['manager', 'warehouse', 'hostler', 'guard'];
    const configScreens = allScreens.filter(s => s.id !== 'users' && s.id !== 'locations' && s.id !== 'settings'); // admin-only screens not configurable
    return (<div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}><Btn onClick={() => setShowAddUser(true)}>+ Add User</Btn><Input placeholder="Search..." value={userFilter} onChange={setUserFilter} style={{ width: 260 }} /><div style={{ marginLeft: 'auto', fontSize: 13, color: T.tm }}>{users.filter(u => u.active).length} active · {users.length} total</div></div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12 }}>{ROLES.map(r => { const count = users.filter(u => u.role === r.id && u.active).length; return (<Card key={r.id} style={{ padding: 14 }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div><div style={{ fontSize: 11, color: T.tm, fontWeight: 600, textTransform: 'uppercase' }}>{r.label}s</div><div style={{ fontSize: 24, fontWeight: 800, color: ROLE_COLORS[r.id], marginTop: 4 }}>{count}</div></div><Badge color={ROLE_COLORS[r.id]}>{r.id}</Badge></div></Card>); })}</div>

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
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 12 }}>
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
  // ListEditor is defined at module level (below the App function) to prevent
  // re-mounting on every render, which destroys input state and breaks the Add button.

  const renderSettings = () => {
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
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 14 }}>
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

      <Card>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>🚚 Carriers</h3>
        <ListEditor title="" items={CARRIERS}
          onAdd={() => { if (newCarrier.trim() && !CARRIERS.includes(newCarrier.trim())) { saveSetting('carriers', [...CARRIERS, newCarrier.trim()]); setNewCarrier(''); } }}
          onRemove={item => { if (confirm(`Remove "${item}" carrier?`)) saveSetting('carriers', CARRIERS.filter(c => c !== item)); }}
          newVal={newCarrier} setNewVal={setNewCarrier} placeholder="e.g. USPS, Old Dominion..." />
      </Card>

      <Card>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>📦 Load Types</h3>
        <ListEditor title="" items={LOAD_TYPES}
          onAdd={() => { if (newLoadType.trim() && !LOAD_TYPES.includes(newLoadType.trim())) { saveSetting('loadTypes', [...LOAD_TYPES, newLoadType.trim()]); setNewLoadType(''); } }}
          onRemove={item => { if (confirm(`Remove "${item}" load type?`)) saveSetting('loadTypes', LOAD_TYPES.filter(lt => lt !== item)); }}
          newVal={newLoadType} setNewVal={setNewLoadType} placeholder="e.g. Transfer, Shuttle..." />
      </Card>

      <Card>
        <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700 }}>🗄️ Reset Analytics Data</h3>
        <p style={{ margin: '0 0 16px', fontSize: 12, color: T.tm }}>Clear completed/cancelled moves and gate log entries. Active (pending/in-progress) moves are NOT affected. Trailer inventory, locations, users, and settings are NOT affected.</p>
        {archiveCount > 0 && <div style={{ padding: 12, background: T.in + '15', border: `1px solid ${T.in}33`, borderRadius: 8, marginBottom: 14, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span><strong style={{ color: T.in }}>{archiveCount}</strong> moves currently archived</span>
          <Btn small variant="ghost" onClick={async () => {
            if (!confirm(`Restore all ${archiveCount} archived moves back to the active log?`)) return;
            const r = await db.restoreArchivedMoves();
            if (r.error) alert('Error: ' + r.error.message);
            else { alert(`Restored ${r.restored} moves`); db.fetchArchiveCount().then(setArchiveCount); db.fetchMoves().then(x => setMoves(x.data || [])); }
          }}>Restore Archive</Btn>
        </div>}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Btn variant="secondary" onClick={async () => {
            if (!confirm('Archive all completed and cancelled moves?\n\nThis moves them to a backup table. They will no longer appear in dashboards or analytics, but can be restored later.')) return;
            const r = await db.archiveCompletedMoves();
            if (r.error) alert('Error: ' + r.error.message);
            else { alert(`Archived ${r.archived} moves`); db.fetchArchiveCount().then(setArchiveCount); db.fetchMoves().then(x => setMoves(x.data || [])); }
          }}>📦 Archive Completed Moves</Btn>
          <Btn variant="danger" onClick={async () => {
            if (!confirm('⚠️ PERMANENT DELETE ⚠️\n\nThis will permanently delete:\n• All completed/cancelled moves\n• All gate log entries\n\nThis CANNOT be undone. Continue?')) return;
            if (!confirm('Are you absolutely sure? This is your last chance to cancel.')) return;
            const r = await db.deleteAnalyticsData();
            if (r.error) alert('Error: ' + r.error.message);
            else { alert(`Permanently deleted ${r.deleted} records`); db.fetchMoves().then(x => setMoves(x.data || [])); db.fetchGateLog().then(x => setGateLog(x.data || [])); }
          }}>🗑️ Permanently Delete</Btn>
        </div>
      </Card>
    </div>);
  };

  // ─── RENDER: GUARD SHACK ─────────────────────────────────────
  const handleGateSubmit = async () => {
    await db.createGateEntry({ ...gateEntry, logged_by: currentUser.id, logged_by_name: currentUser.name });
    setGateEntry({ direction: 'in', load_id: '', trailer_number: '', carrier: '', load_type: '', notes: '' });
    db.fetchGateLog().then(r => setGateLog(r.data || []));
  };

  const renderGuard = () => {
    const filtered = gateLog.filter(g => !gateFilter || g.trailer_number.includes(gateFilter) || g.load_id.toLowerCase().includes(gateFilter.toLowerCase()) || (g.carrier || '').toLowerCase().includes(gateFilter.toLowerCase()));
    const todayIn = gateLog.filter(g => g.direction === 'in' && new Date(g.created_at).toDateString() === new Date().toDateString()).length;
    const todayOut = gateLog.filter(g => g.direction === 'out' && new Date(g.created_at).toDateString() === new Date().toDateString()).length;

    return (<div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: 12 }}>
        <Card style={{ padding: 14 }}><div style={{ fontSize: 11, color: T.tm, fontWeight: 600, textTransform: 'uppercase' }}>Checked In Today</div><div style={{ fontSize: 28, fontWeight: 800, color: T.ok, marginTop: 4 }}>{todayIn}</div></Card>
        <Card style={{ padding: 14 }}><div style={{ fontSize: 11, color: T.tm, fontWeight: 600, textTransform: 'uppercase' }}>Checked Out Today</div><div style={{ fontSize: 28, fontWeight: 800, color: T.in, marginTop: 4 }}>{todayOut}</div></Card>
        <Card style={{ padding: 14 }}><div style={{ fontSize: 11, color: T.tm, fontWeight: 600, textTransform: 'uppercase' }}>Total Today</div><div style={{ fontSize: 28, fontWeight: 800, color: T.ac, marginTop: 4 }}>{todayIn + todayOut}</div></Card>
        <Card style={{ padding: 14 }}><div style={{ fontSize: 11, color: T.tm, fontWeight: 600, textTransform: 'uppercase' }}>On Site</div><div style={{ fontSize: 28, fontWeight: 800, color: T.pp, marginTop: 4 }}>{trailers.length}</div></Card>
      </div>

      {/* Entry Form */}
      <Card>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>🚪 New Gate Entry</h3>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {['in', 'out'].map(d => (
            <button key={d} onClick={() => setGateEntry(p => ({ ...p, direction: d }))}
              style={{ flex: 1, padding: '14px 16px', borderRadius: 8, background: gateEntry.direction === d ? (d === 'in' ? T.ok : T.in) + '22' : T.sa, border: `2px solid ${gateEntry.direction === d ? (d === 'in' ? T.ok : T.in) : T.bd}`, color: gateEntry.direction === d ? (d === 'in' ? T.ok : T.in) : T.tm, cursor: 'pointer', fontFamily: 'inherit', fontSize: 16, fontWeight: 700, textAlign: 'center' }}>
              <div style={{ fontSize: 24, marginBottom: 4 }}>{d === 'in' ? '📥' : '📤'}</div>Check {d === 'in' ? 'In' : 'Out'}
            </button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
          <Input label="Load ID" value={gateEntry.load_id} onChange={v => setGateEntry(p => ({ ...p, load_id: v }))} placeholder="e.g. LD-20241" />
          <Input label="Trailer Number" value={gateEntry.trailer_number} onChange={v => setGateEntry(p => ({ ...p, trailer_number: v }))} placeholder="e.g. 4521" />
          <Input label="Carrier" options={CARRIERS.map(c => ({ value: c, label: c }))} value={gateEntry.carrier} onChange={v => setGateEntry(p => ({ ...p, carrier: v }))} />
          <Input label="Load Type" options={LOAD_TYPES.map(lt => ({ value: lt, label: lt }))} value={gateEntry.load_type} onChange={v => setGateEntry(p => ({ ...p, load_type: v }))} />
        </div>
        <div style={{ marginTop: 12 }}>
          <Input label="Notes (optional)" value={gateEntry.notes} onChange={v => setGateEntry(p => ({ ...p, notes: v }))} placeholder="Seal #, special instructions..." />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
          <Btn variant="secondary" onClick={() => setGateEntry({ direction: 'in', load_id: '', trailer_number: '', carrier: '', load_type: '', notes: '' })}>Clear</Btn>
          <Btn variant={gateEntry.direction === 'in' ? 'success' : 'primary'} onClick={handleGateSubmit} disabled={!gateEntry.trailer_number || !gateEntry.carrier || !gateEntry.load_type}>
            {gateEntry.direction === 'in' ? '📥 Check In' : '📤 Check Out'}
          </Btn>
        </div>
      </Card>

      {/* Log */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.bd}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Gate Log</h3>
          <Input placeholder="Search..." value={gateFilter} onChange={setGateFilter} style={{ width: 200 }} />
        </div>
        <Tbl columns={[
          { key: 'dir', label: '', render: r => <span style={{ fontSize: 18 }}>{r.direction === 'in' ? '📥' : '📤'}</span> },
          { key: 'direction', label: 'Type', render: r => <Badge color={r.direction === 'in' ? T.ok : T.in}>{r.direction === 'in' ? 'CHECK IN' : 'CHECK OUT'}</Badge> },
          { key: 'load_id', label: 'Load ID', render: r => <span style={{ fontWeight: 600, fontFamily: "'JetBrains Mono',monospace" }}>{r.load_id || '—'}</span> },
          { key: 'trailer_number', label: 'Trailer #', render: r => <span style={{ fontWeight: 700, color: T.ac, fontFamily: "'JetBrains Mono',monospace" }}>{r.trailer_number}</span> },
          { key: 'carrier', label: 'Carrier', render: r => r.carrier || '—' },
          { key: 'load_type', label: 'Load Type', render: r => r.load_type ? <Badge color={T.pp} small>{r.load_type}</Badge> : '—' },
          { key: 'by', label: 'Logged By', render: r => r.logged_by_name || '—' },
          { key: 'time', label: 'Time', render: r => db.fmtDate(r.created_at) },
        ]} data={filtered} />
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
    { id: 'guard', label: 'Guard Shack', icon: '🚪' },
    { id: 'locations', label: 'Locations', icon: '📍' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
    { id: 'users', label: 'Users', icon: '👥' },
  ];
  const myAccess = screenAccess[role] || DEFAULT_ACCESS[role] || [];
  const nav = allScreens.filter(s => myAccess.includes(s.id));

  // Close sidebar on mobile when navigating
  const navTo = (id) => { setView(id); setFilter(''); setSf(''); setHf(''); setUserFilter(''); setLocFilter(''); setGateFilter(''); if (isMobile) setSidebarOpen(false); };

  const sidebarW = sidebarOpen ? 240 : 60;

  return (
    <div style={{ background: T.bg, color: T.tx, minHeight: '100vh', display: 'flex' }}>
      {/* Mobile overlay backdrop */}
      {isMobile && sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 199, backdropFilter: 'blur(2px)' }} />}

      {/* Sidebar */}
      <div style={{
        width: isMobile ? 260 : sidebarW,
        background: T.sf,
        borderRight: `1px solid ${T.bd}`,
        display: 'flex', flexDirection: 'column', flexShrink: 0,
        position: isMobile ? 'fixed' : 'sticky',
        top: 0, height: '100vh',
        zIndex: isMobile ? 200 : 10,
        transform: isMobile && !sidebarOpen ? 'translateX(-100%)' : 'translateX(0)',
        transition: 'width 0.2s ease, transform 0.25s ease',
        overflow: 'hidden',
      }}>
        {/* Logo area */}
        <div style={{ padding: sidebarOpen || isMobile ? '16px 14px' : '16px 10px', borderBottom: `1px solid ${T.bd}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 64 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
            <img src="/logo.png" alt="Logo" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
            {(sidebarOpen || isMobile) && <div><div style={{ fontWeight: 800, fontSize: 13, whiteSpace: 'nowrap' }}>Fayetteville</div><div style={{ fontSize: 10, color: T.tm, whiteSpace: 'nowrap' }}>Yard Flow</div></div>}
          </div>
          {!isMobile && <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: 'none', border: 'none', color: T.tm, cursor: 'pointer', fontSize: 16, padding: '4px', fontFamily: 'inherit', flexShrink: 0 }} title={sidebarOpen ? 'Collapse' : 'Expand'}>{sidebarOpen ? '◀' : '▶'}</button>}
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: sidebarOpen || isMobile ? '8px 8px' : '8px 6px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          {nav.map(item => <button key={item.id} onClick={() => navTo(item.id)} title={!sidebarOpen && !isMobile ? item.label : undefined} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: sidebarOpen || isMobile ? '10px 12px' : '10px 0', justifyContent: sidebarOpen || isMobile ? 'flex-start' : 'center', borderRadius: 8, background: view === item.id ? T.ag : 'transparent', border: view === item.id ? `1px solid ${T.ac}44` : '1px solid transparent', color: view === item.id ? T.ac : T.tm, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', textAlign: 'left', whiteSpace: 'nowrap', position: 'relative' }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
            {(sidebarOpen || isMobile) && <span style={{ flex: 1 }}>{item.label}</span>}
            {item.count > 0 && (sidebarOpen || isMobile) && <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 10, background: T.dg, color: '#fff' }}>{item.count}</span>}
            {item.count > 0 && !sidebarOpen && !isMobile && <span style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: '50%', background: T.dg }} />}
          </button>)}
        </nav>

        {/* User info */}
        <div style={{ padding: sidebarOpen || isMobile ? '12px 14px' : '12px 6px', borderTop: `1px solid ${T.bd}` }}>
          {(sidebarOpen || isMobile) ? <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <Avatar name={currentUser.name} color={currentUser.color} size={30} />
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentUser.name}</div><Badge color={ROLE_COLORS[currentUser.role]} small>{currentUser.role}</Badge></div>
            </div>
            <button onClick={onLogout} style={{ width: '100%', padding: '7px 0', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: T.sa, color: T.tm, border: `1px solid ${T.bd}`, fontFamily: 'inherit' }}>Sign Out</button>
          </> : <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Avatar name={currentUser.name} color={currentUser.color} size={30} />
          </div>}
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, marginLeft: isMobile ? 0 : undefined }}>
        <header style={{ padding: isMobile ? '10px 14px' : '14px 24px', borderBottom: `1px solid ${T.bd}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: T.sf, position: 'sticky', top: 0, zIndex: 100, gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isMobile && <button onClick={() => setSidebarOpen(true)} style={{ background: 'none', border: 'none', color: T.tm, cursor: 'pointer', fontSize: 22, padding: '2px 6px', fontFamily: 'inherit' }}>☰</button>}
            <h1 style={{ margin: 0, fontSize: isMobile ? 16 : 20, fontWeight: 800, whiteSpace: 'nowrap' }}>{nav.find(n => n.id === view)?.icon} {nav.find(n => n.id === view)?.label}</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 16, flexShrink: 0 }}>
            {!isMobile && <div style={{ fontSize: 12, color: T.tm }}>{clock.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {clock.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>}
            {role !== 'hostler' && <Btn small onClick={() => setShowNewMove(true)}>+ {isMobile ? 'Move' : 'New Move'}</Btn>}
          </div>
        </header>
        <div style={{ flex: 1, padding: isMobile ? 14 : 24, overflow: 'auto' }}>
          {view === 'dashboard' && renderDash()}
          {view === 'moves' && renderMoves()}
          {view === 'trailers' && renderTrailers()}
          {view === 'yard' && renderYard()}
          {view === 'hostler' && renderHostler()}
          {view === 'analytics' && renderAnalytics()}
          {view === 'guard' && renderGuard()}
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
          <Input label="Email (for password reset)" type="email" value={newUser.email} onChange={v => setNewUser(p => ({ ...p, email: v }))} placeholder="john.smith@pepsico.com" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}><Input label="Password" value={newUser.password} onChange={v => setNewUser(p => ({ ...p, password: v }))} /><Input label="Role" options={ROLES.map(r => ({ value: r.id, label: r.label }))} value={newUser.role} onChange={v => setNewUser(p => ({ ...p, role: v }))} /></div>
          <div><label style={{ fontSize: 11, fontWeight: 600, color: T.tm, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Color</label><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="color" value={newUser.color} onChange={e => setNewUser(p => ({ ...p, color: e.target.value }))} style={{ width: 40, height: 32, border: 'none', borderRadius: 6, cursor: 'pointer' }} /><Avatar name={newUser.name || '?'} color={newUser.color} size={32} /></div></div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}><Btn variant="secondary" onClick={() => setShowAddUser(false)}>Cancel</Btn><Btn onClick={handleAddUser} disabled={!newUser.name || !newUser.username || !newUser.password || !newUser.role}>Create User</Btn></div>
        </div>
      </Modal>

      <Modal open={!!editUser} onClose={() => setEditUser(null)} title={`Edit: ${editUser?.name}`}>
        {editUser && <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label="Name" value={editUser.name} onChange={v => setEditUser(p => ({ ...p, name: v }))} />
          <Input label="Username" value={editUser.username} onChange={v => setEditUser(p => ({ ...p, username: v }))} />
          <Input label="Email" type="email" value={editUser.email || ''} onChange={v => setEditUser(p => ({ ...p, email: v }))} placeholder="user@pepsico.com" />
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
