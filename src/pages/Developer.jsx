import { useState, useEffect } from 'react';
import { Terminal, RefreshCw, Trash2, KeyRound, Users, FileText, ShieldAlert, Eye, EyeOff, Copy, Check } from 'lucide-react';
import { supabase } from '../supabase';

const DEV_PASSWORD = 'anobyte-dev-2025'; // change this

function hashPassword(password) {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
        hash = ((hash << 5) - hash) + password.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0').toUpperCase();
}

export default function Developer() {
    const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem('dev_unlocked') === '1');
    const [devPass, setDevPass]   = useState('');
    const [passErr, setPassErr]   = useState('');
    const [tab, setTab]           = useState('audit');

    // Audit logs
    const [logs, setLogs]         = useState([]);
    const [logsLoading, setLogsLoading] = useState(false);
    const [logSearch, setLogSearch] = useState('');

    // All users
    const [allUsers, setAllUsers] = useState([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [schools, setSchools]   = useState([]);
    const [schoolFilter, setSchoolFilter] = useState('');
    const [resetTarget, setResetTarget] = useState(null);
    const [newPass, setNewPass]   = useState('');
    const [showNewPass, setShowNewPass] = useState(false);
    const [copied, setCopied]     = useState(null);
    const [saving, setSaving]     = useState(false);

    function unlock(e) {
        e.preventDefault();
        if (devPass === DEV_PASSWORD) {
            sessionStorage.setItem('dev_unlocked', '1');
            setUnlocked(true);
        } else {
            setPassErr('Incorrect developer password.');
        }
    }

    useEffect(() => {
        if (!unlocked) return;
        supabase.from('schools').select('id, name').order('name').then(({ data }) => setSchools(data || []));
    }, [unlocked]);

    useEffect(() => {
        if (!unlocked) return;
        if (tab === 'audit') loadLogs();
        if (tab === 'users') loadUsers();
    }, [tab, unlocked, schoolFilter]);

    async function loadLogs() {
        setLogsLoading(true);
        const { data } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200);
        setLogs(data || []);
        setLogsLoading(false);
    }

    async function loadUsers() {
        setUsersLoading(true);
        let q = supabase.from('school_users').select('*, schools(name)').order('created_at', { ascending: false });
        if (schoolFilter) q = q.eq('school_id', schoolFilter);
        const { data } = await q;
        setAllUsers(data || []);
        setUsersLoading(false);
    }

    async function handleResetPassword(e) {
        e.preventDefault();
        if (!newPass || !resetTarget) return;
        setSaving(true);
        const hash = hashPassword(newPass);
        const { error } = await supabase.from('school_users').update({ password_hash: hash }).eq('id', resetTarget.id);
        if (error) { alert(error.message); setSaving(false); return; }
        await supabase.from('audit_logs').insert({
            action: 'admin_action',
            description: `[DEV] Password overridden for "${resetTarget.name}" (${resetTarget.username})`,
            school_name: resetTarget.schools?.name || '—', actor: 'developer',
        });
        setResetTarget(null);
        setNewPass('');
        setSaving(false);
        loadUsers();
    }

    async function handleDeleteUser(userId, name, schoolName) {
        if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
        await supabase.from('school_users').delete().eq('id', userId);
        await supabase.from('audit_logs').insert({
            action: 'admin_action',
            description: `[DEV] User "${name}" deleted`,
            school_name: schoolName || '—', actor: 'developer',
        });
        loadUsers();
    }

    async function clearAuditLogs() {
        if (!confirm('Clear ALL audit logs? This cannot be undone.')) return;
        await supabase.from('audit_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        loadLogs();
    }

    const copyText = (text, key) => { navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 2000); };
    const CopyBtn  = ({ text, id }) => (
        <button className="btn-icon" onClick={() => copyText(text, id)} style={{ padding: '3px 6px' }}>
            {copied === id ? <Check size={12} color="#11b37f" /> : <Copy size={12} />}
        </button>
    );

    const filteredLogs = logs.filter(l =>
        !logSearch ||
        (l.description || '').toLowerCase().includes(logSearch.toLowerCase()) ||
        (l.actor || '').toLowerCase().includes(logSearch.toLowerCase()) ||
        (l.school_name || '').toLowerCase().includes(logSearch.toLowerCase())
    );

    const ACTION_COLORS = { school_created: '#11b37f', school_disabled: '#ef4444', admin_action: '#2d6fb5', payment_received: '#f59e0b' };

    // ── Lock screen ──
    if (!unlocked) return (
        <div className="page-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: '32px 28px', width: 'min(94vw, 360px)', boxShadow: '0 32px 64px rgba(0,0,0,0.4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#1a1a2e,#16213e)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Terminal size={18} color="#8fa8c8" />
                    </div>
                    <div>
                        <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>Developer Access</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Restricted — Anobyte internal only</div>
                    </div>
                </div>
                <form onSubmit={unlock}>
                    <div className="field">
                        <label>Developer Password</label>
                        <input type="password" value={devPass} onChange={e => { setDevPass(e.target.value); setPassErr(''); }} placeholder="••••••••" autoFocus />
                    </div>
                    {passErr && <div className="error-msg">{passErr}</div>}
                    <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: 4 }}>
                        <Terminal size={14} /> Unlock
                    </button>
                </form>
            </div>
        </div>
    );

    return (
        <div className="page-wrap">
            <div className="page-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Terminal size={18} color="#8fa8c8" />
                    <div>
                        <h2>Developer Console</h2>
                        <p className="sub">Anobyte internal — override controls</p>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.72rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', borderRadius: 20, padding: '3px 10px', fontWeight: 700 }}>
                        <ShieldAlert size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                        DEV MODE
                    </span>
                    <button className="btn-secondary btn-sm" onClick={() => { sessionStorage.removeItem('dev_unlocked'); setUnlocked(false); }}>Lock</button>
                </div>
            </div>

            <div className="tab-bar">
                <button className={`tab-btn ${tab === 'audit' ? 'active' : ''}`} onClick={() => setTab('audit')}>
                    <FileText size={13} /> Audit Trail
                </button>
                <button className={`tab-btn ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>
                    <Users size={13} /> All Users
                </button>
            </div>

            {/* ── AUDIT TRAIL ── */}
            {tab === 'audit' && (
                <div style={{ marginTop: 16 }}>
                    <div className="toolbar">
                        <input className="search-input" placeholder="Search logs…" value={logSearch} onChange={e => setLogSearch(e.target.value)} />
                        <button className="btn-secondary btn-sm" onClick={loadLogs}><RefreshCw size={13} /></button>
                        <button className="btn-danger btn-sm" onClick={clearAuditLogs}><Trash2 size={13} /> Clear All</button>
                    </div>
                    {logsLoading ? (
                        <div className="loading-state"><RefreshCw size={22} className="spin" /></div>
                    ) : filteredLogs.length === 0 ? (
                        <div className="empty-state"><FileText size={36} strokeWidth={1.2} /><p>No audit logs.</p></div>
                    ) : (
                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr><th>Time</th><th>Action</th><th>Description</th><th>School</th><th>Actor</th></tr>
                                </thead>
                                <tbody>
                                    {filteredLogs.map(l => (
                                        <tr key={l.id}>
                                            <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                                {new Date(l.created_at).toLocaleString()}
                                            </td>
                                            <td>
                                                <span className="badge" style={{ background: (ACTION_COLORS[l.action] || '#8fa8c8') + '18', color: ACTION_COLORS[l.action] || '#8fa8c8', fontSize: '0.7rem' }}>
                                                    {l.action}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: '0.82rem', maxWidth: 300 }}>{l.description}</td>
                                            <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{l.school_name || '—'}</td>
                                            <td style={{ fontSize: '0.78rem' }}><code className="license-code">{l.actor || '—'}</code></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ── ALL USERS ── */}
            {tab === 'users' && (
                <div style={{ marginTop: 16 }}>
                    <div className="toolbar">
                        <select value={schoolFilter} onChange={e => setSchoolFilter(e.target.value)}>
                            <option value="">All Schools</option>
                            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <button className="btn-secondary btn-sm" onClick={loadUsers}><RefreshCw size={13} /></button>
                    </div>
                    {usersLoading ? (
                        <div className="loading-state"><RefreshCw size={22} className="spin" /></div>
                    ) : allUsers.length === 0 ? (
                        <div className="empty-state"><Users size={36} strokeWidth={1.2} /><p>No users found.</p></div>
                    ) : (
                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr><th>Name</th><th>Username</th><th>Role</th><th>School</th><th>Status</th><th>Actions</th></tr>
                                </thead>
                                <tbody>
                                    {allUsers.map(u => (
                                        <tr key={u.id}>
                                            <td><strong>{u.name}</strong></td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <code className="license-code" style={{ fontSize: '0.75rem' }}>{u.username}</code>
                                                    <CopyBtn text={u.username} id={u.id + 'u'} />
                                                </div>
                                            </td>
                                            <td><span className="badge" style={{ background: 'rgba(139,92,246,0.12)', color: '#a78bfa' }}>{u.role}</span></td>
                                            <td style={{ fontSize: '0.82rem' }}>{u.schools?.name || '—'}</td>
                                            <td>
                                                <span className="badge" style={{ background: u.is_active ? 'rgba(17,179,127,0.12)' : 'rgba(239,68,68,0.12)', color: u.is_active ? '#11b37f' : '#ef4444' }}>
                                                    {u.is_active ? 'Active' : 'Disabled'}
                                                </span>
                                            </td>
                                            <td className="actions">
                                                <button className="btn-icon" title="Override password" onClick={() => { setResetTarget(u); setNewPass(''); setShowNewPass(true); }}>
                                                    <KeyRound size={13} />
                                                </button>
                                                <button className="btn-icon danger" title="Delete user" onClick={() => handleDeleteUser(u.id, u.name, u.schools?.name)}>
                                                    <Trash2 size={13} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ── Password Override Modal ── */}
            {resetTarget && (
                <div className="modal-overlay" onClick={() => setResetTarget(null)}>
                    <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Override Password</h3>
                            <button className="modal-close" onClick={() => setResetTarget(null)}>✕</button>
                        </div>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
                            Setting new password for <strong style={{ color: 'var(--text-primary)' }}>{resetTarget.name}</strong>
                            <br /><code style={{ fontSize: '0.75rem', color: '#7ab3e8' }}>{resetTarget.username}</code>
                        </p>
                        <form onSubmit={handleResetPassword}>
                            <div className="field">
                                <label>New Password</label>
                                <div className="input-row">
                                    <input type={showNewPass ? 'text' : 'password'} value={newPass} onChange={e => setNewPass(e.target.value)} required placeholder="Enter new password" style={{ fontFamily: 'monospace', flex: 1 }} autoFocus />
                                    <button type="button" className="btn-icon" onClick={() => setShowNewPass(v => !v)}>
                                        {showNewPass ? <EyeOff size={13} /> : <Eye size={13} />}
                                    </button>
                                    {newPass && <CopyBtn text={newPass} id="rp" />}
                                </div>
                                {newPass && <small style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>Hash: <code style={{ color: '#7ab3e8' }}>{hashPassword(newPass)}</code></small>}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-secondary" onClick={() => setResetTarget(null)}>Cancel</button>
                                <button type="submit" className="btn-primary" disabled={saving || !newPass}>
                                    <KeyRound size={13} /> {saving ? 'Saving…' : 'Override Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
