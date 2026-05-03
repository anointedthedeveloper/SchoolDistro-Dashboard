import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Receipt, Banknote, Clock, Plus, Trash2, Download, RefreshCw, Shield, Crown, UserRound, KeyRound, Eye, EyeOff, RefreshCcw, Copy, Check } from 'lucide-react';
import { supabase } from '../supabase';
import { getSubscriptionState } from '../utils/subscription';

const ROLES_LIST = [
    { value: 'principal', label: 'Principal', desc: 'Full access — school info, reports, settings, approvals' },
    { value: 'director',  label: 'Director',  desc: 'Reports, parents, view settings, approve changes' },
    { value: 'staff',     label: 'Staff',     desc: 'Receipt generation only' },
];
const ROLE_COLORS = { principal: '#11b37f', director: '#8b5cf6', staff: '#2d6fb5' };
const ROLE_ICONS  = { principal: Crown, director: Shield, staff: UserRound };

function hashPassword(password) {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
        hash = ((hash << 5) - hash) + password.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0').toUpperCase();
}

function generatePassword() {
    const lower = 'abcdefghjkmnpqrstuvwxyz';
    const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ';
    const nums  = '23456789';
    let pw = upper[Math.floor(Math.random() * upper.length)];
    for (let i = 0; i < 6; i++) pw += lower[Math.floor(Math.random() * lower.length)];
    pw += nums[Math.floor(Math.random() * nums.length)];
    pw += nums[Math.floor(Math.random() * nums.length)];
    return pw;
}

function generateUsername(name, schoolName) {
    const slug       = name.trim().toLowerCase().replace(/\s+/g, '.');
    const schoolSlug = (schoolName || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6);
    return `${schoolSlug}.${slug}`;
}

function downloadCredentials(creds, filename = 'credentials') {
    const blob = new Blob([JSON.stringify(creds, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `${filename}.json`; a.click();
    URL.revokeObjectURL(url);
}

export default function SchoolDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [tab, setTab]         = useState('info');
    const [school, setSchool]   = useState(null);
    const [stats, setStats]     = useState({ users: 0, receipts: 0, revenue: 0, lastActivity: null });
    const [recentReceipts, setRecentReceipts] = useState([]);
    const [loading, setLoading] = useState(true);

    const [schoolUsers, setSchoolUsers]   = useState([]);
    const [activations, setActivations]   = useState([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [addModal, setAddModal]         = useState(false);
    const [newUser, setNewUser]           = useState({ name: '', username: '', password: generatePassword(), role: 'staff' });
    const [showPass, setShowPass]         = useState(true);
    const [createdUser, setCreatedUser]   = useState(null);
    const [copied, setCopied]             = useState(null);
    const [saving, setSaving]             = useState(false);
    const [deleteUserId, setDeleteUserId] = useState(null);
    const [resetUser, setResetUser]       = useState(null);

    const loadInfo = useCallback(async () => {
        const [{ data: s }, { data: receipts }, { count: userCount }] = await Promise.all([
            supabase.from('schools').select('*').eq('id', id).single(),
            supabase.from('receipts').select('*').eq('school_id', id).order('synced_at', { ascending: false }),
            supabase.from('school_users').select('*', { count: 'exact', head: true }).eq('school_id', id),
        ]);
        setSchool(s);
        const revenue = (receipts || []).reduce((sum, r) => sum + Number(r.amount || 0), 0);
        setStats({ users: userCount || 0, receipts: (receipts || []).length, revenue, lastActivity: receipts?.[0]?.synced_at || null });
        setRecentReceipts((receipts || []).slice(0, 10));
        setLoading(false);
    }, [id]);

    const loadUsers = useCallback(async () => {
        setUsersLoading(true);
        const [{ data: u }, { data: a }] = await Promise.all([
            supabase.from('school_users').select('*').eq('school_id', id).order('created_at'),
            supabase.from('license_activations').select('*').eq('school_id', id).order('activated_at', { ascending: false }),
        ]);
        setSchoolUsers(u || []);
        setActivations(a || []);
        setUsersLoading(false);
    }, [id]);

    useEffect(() => { loadInfo(); }, [loadInfo]);
    useEffect(() => { if (tab === 'users') loadUsers(); }, [tab, loadUsers]);

    async function handleAddUser(e) {
        e.preventDefault();
        if (!school) return;
        setSaving(true);
        const plainPassword = newUser.password;
        const username      = newUser.username || generateUsername(newUser.name, school.name);
        const { error } = await supabase.from('school_users').insert({
            school_id:     id,
            name:          newUser.name.trim(),
            username:      username.trim().toLowerCase(),
            role:          newUser.role,
            password_hash: hashPassword(plainPassword),
            is_active:     true,
        });
        if (error) { alert(error.message); setSaving(false); return; }
        await supabase.from('audit_logs').insert({
            action: 'admin_action',
            description: `User "${newUser.name}" (${newUser.role}) created for ${school.name}`,
            school_name: school.name, actor: 'admin',
        });
        setCreatedUser({ name: newUser.name.trim(), username: username.trim().toLowerCase(), plainPassword, role: newUser.role, school: school.name, license_key: school.license_key });
        setAddModal(false);
        setNewUser({ name: '', username: '', password: generatePassword(), role: 'staff' });
        setSaving(false);
        loadUsers(); loadInfo();
    }

    async function handleResetPassword() {
        if (!resetUser) return;
        const newPassword = generatePassword();
        const hash = hashPassword(newPassword);
        const { error } = await supabase
            .from('school_users')
            .update({ password_hash: hash })
            .eq('id', resetUser.id);
        if (error) { alert(error.message); return; }
        await supabase.from('audit_logs').insert({
            action: 'admin_action',
            description: `Password reset for "${resetUser.name}" at ${school.name}`,
            school_name: school.name, actor: 'admin',
        });
        downloadCredentials(
            [{ username: resetUser.username, password: newPassword, role: resetUser.role, school: school.name, license_key: school.license_key, note: 'Password reset' }],
            `${resetUser.username}-new-credentials`
        );
        setResetUser(null);
    }

    async function handleDeleteUser() {
        await supabase.from('school_users').delete().eq('id', deleteUserId);
        setDeleteUserId(null);
        loadUsers(); loadInfo();
    }

    async function revokeActivation(activationId) {
        await supabase.from('license_activations').delete().eq('id', activationId);
        loadUsers();
    }

    function downloadAllCredentials() {
        const data = schoolUsers.map(u => ({
            username:    u.username,
            role:        u.role,
            school:      school?.name,
            license_key: school?.license_key,
            note:        'Use reset password to get a new credential file with plain password',
        }));
        downloadCredentials(data, `${school?.name}-all-users`);
    }

    const roleColor   = ROLE_COLORS;
    const copyText = (text, key) => { navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 2000); };
    const CopyBtn  = ({ text, id }) => (
        <button className="btn-icon" onClick={() => copyText(text, id)} style={{ padding: '3px 6px' }}>
            {copied === id ? <Check size={12} color="#11b37f" /> : <Copy size={12} />}
        </button>
    );

    if (loading) return <div className="page-wrap"><div className="loading-state">Loading…</div></div>;
    if (!school)  return <div className="page-wrap"><div className="empty-state"><p>School not found.</p></div></div>;

    const subState      = getSubscriptionState(school);
    const usedSlots     = schoolUsers.length;
    const maxUsers      = school.max_users === -1 ? Infinity : (school.max_users || 3);
    const totalSlots    = maxUsers === Infinity ? '∞' : maxUsers;
    const activeDevices = activations.length;

    return (
        <div className="page-wrap">
            <div className="page-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button className="btn-secondary btn-sm" onClick={() => navigate('/schools')}>
                        <ArrowLeft size={14} />
                    </button>
                    <div>
                        <h2>{school.name}</h2>
                        <p className="sub">{school.email || 'No email on record'}</p>
                    </div>
                </div>
                <span className="badge" style={{ background: subState.color + '22', color: subState.color, fontSize: '0.82rem', padding: '4px 12px', fontWeight: subState.urgent ? 700 : 500 }}>
                    {subState.label}
                </span>
            </div>

            <div className="tab-bar">
                <button className={`tab-btn ${tab === 'info' ? 'active' : ''}`} onClick={() => setTab('info')}>
                    <Receipt size={14} /> Info & Receipts
                </button>
                <button className={`tab-btn ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>
                    <Users size={14} /> Users & Devices
                    {usedSlots > 0 && <span className="badge" style={{ background: 'rgba(45,111,181,0.2)', color: '#7ab3e8', marginLeft: 6, fontSize: '0.68rem' }}>{usedSlots}</span>}
                </button>
            </div>

            {/* ── INFO TAB ── */}
            {tab === 'info' && (
                <>
                    <div className="detail-info-grid" style={{ marginTop: 16 }}>
                        <div className="detail-info-item"><span>Plan</span><strong>{school.plan || '—'}</strong></div>
                        <div className="detail-info-item"><span>License Key</span><code className="license-code">{school.license_key}</code></div>
                        <div className="detail-info-item"><span>Expires</span><strong>{school.expires_at ? new Date(school.expires_at).toLocaleDateString() : '—'}</strong></div>
                        <div className="detail-info-item"><span>Registered</span><strong>{new Date(school.created_at).toLocaleDateString()}</strong></div>
                    </div>

                    <div className="stats-grid" style={{ marginTop: 20 }}>
                        {[
                            { label: 'Total Users',    value: stats.users,                                  Icon: Users,    color: '#2d6fb5' },
                            { label: 'Receipts',       value: stats.receipts,                               Icon: Receipt,  color: '#8b5cf6' },
                            { label: 'School Revenue', value: `₦${stats.revenue.toLocaleString()}`,         Icon: Banknote, color: '#11b37f' },
                            { label: 'Last Activity',  value: stats.lastActivity ? new Date(stats.lastActivity).toLocaleDateString() : 'Never', Icon: Clock, color: '#f59e0b' },
                        ].map(({ label, value, Icon, color }) => (
                            <div className="stat-card" key={label} style={{ borderTopColor: color }}>
                                <Icon size={20} color={color} style={{ marginBottom: 8 }} />
                                <div className="stat-value" style={{ fontSize: '1.4rem' }}>{value}</div>
                                <div className="stat-label">{label}</div>
                            </div>
                        ))}
                    </div>

                    <div className="section-title" style={{ marginTop: 28 }}>Recent Receipts</div>
                    {recentReceipts.length === 0 ? (
                        <div className="empty-state"><Receipt size={36} strokeWidth={1.2} /><p>No receipts yet.</p></div>
                    ) : (
                        <div className="table-wrap">
                            <table>
                                <thead><tr><th>Serial</th><th>Parent</th><th>Amount</th><th>Purpose</th><th>Date</th></tr></thead>
                                <tbody>
                                    {recentReceipts.map(r => (
                                        <tr key={r.id}>
                                            <td><code className="license-code">{r.serial_number}</code></td>
                                            <td>{r.parent_name}</td>
                                            <td style={{ fontWeight: 700, color: 'var(--accent-green)' }}>₦{Number(r.amount).toLocaleString()}</td>
                                            <td>{r.purpose}</td>
                                            <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{new Date(r.synced_at).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}

            {/* ── USERS TAB ── */}
            {tab === 'users' && (
                <div style={{ marginTop: 16 }}>
                    <div className="slot-bar">
                        <div className="slot-bar-info">
                            <span style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                                {ROLES_LIST.map(r => {
                                    const count = schoolUsers.filter(u => u.role === r.value).length;
                                    const RIcon = ROLE_ICONS[r.value];
                                    return (
                                        <span key={r.value}>
                                            <RIcon size={12} style={{ color: ROLE_COLORS[r.value], marginRight: 4, verticalAlign: 'middle' }} />
                                            {r.label}: <strong>{count}</strong>
                                        </span>
                                    );
                                })}
                            </span>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                                Active devices: <strong style={{ color: 'var(--text-primary)' }}>{activeDevices}</strong>
                            </span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div className="section-title" style={{ margin: 0 }}>Staff Accounts</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {schoolUsers.length > 0 && (
                                <button className="btn-secondary btn-sm" onClick={downloadAllCredentials}>
                                    <Download size={13} /> Export All
                                </button>
                            )}
                            <button className="btn-secondary btn-sm" onClick={loadUsers}><RefreshCw size={13} /></button>
                            <button className="btn-primary btn-sm" onClick={() => {
                                setNewUser({ name: '', username: '', password: generatePassword(), role: 'staff' });
                                setShowPass(true);
                                setAddModal(true);
                            }}>
                                <Plus size={13} /> Add User
                            </button>
                        </div>
                    </div>

                    {usersLoading ? (
                        <div className="loading-state"><RefreshCw size={22} className="spin" /></div>
                    ) : schoolUsers.length === 0 ? (
                        <div className="empty-state" style={{ padding: '32px 0' }}>
                            <Users size={36} strokeWidth={1.2} />
                            <p>No users yet. Add a Principal account first.</p>
                        </div>
                    ) : (
                        <div className="table-wrap" style={{ marginBottom: 28 }}>
                            <table>
                                <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
                                <tbody>
                                    {schoolUsers.map(u => {
                                        const RIcon = ROLE_ICONS[u.role] || UserRound;
                                        return (
                                        <tr key={u.id}>
                                            <td><strong>{u.name}</strong></td>
                                            <td><code className="license-code" style={{ fontSize: '0.75rem' }}>{u.username}</code></td>
                                            <td>
                                                <span className="badge" style={{ background: (ROLE_COLORS[u.role] || '#8fa8c8') + '22', color: ROLE_COLORS[u.role] || '#8fa8c8', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                    <RIcon size={11} />
                                                    {ROLES_LIST.find(r => r.value === u.role)?.label || u.role}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="badge" style={{ background: u.is_active ? 'rgba(17,179,127,0.12)' : 'rgba(239,68,68,0.12)', color: u.is_active ? '#11b37f' : '#ef4444' }}>
                                                    {u.is_active ? 'Active' : 'Disabled'}
                                                </span>
                                            </td>
                                            <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                                            <td className="actions">
                                                <button className="btn-icon" onClick={() => setResetUser(u)} title="Reset password"><KeyRound size={13} /></button>
                                                <button className="btn-icon danger" onClick={() => setDeleteUserId(u.id)} title="Delete"><Trash2 size={13} /></button>
                                            </td>
                                        </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="section-title" style={{ marginBottom: 10 }}>
                        <Shield size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                        Active Device Activations ({activeDevices} / {totalSlots})
                    </div>
                    {activations.length === 0 ? (
                        <div className="empty-state" style={{ padding: '24px 0' }}>
                            <Shield size={32} strokeWidth={1.2} />
                            <p>No devices activated yet.</p>
                        </div>
                    ) : (
                        <div className="table-wrap">
                            <table>
                                <thead><tr><th>Device ID</th><th>Activated</th><th>Last Seen</th><th></th></tr></thead>
                                <tbody>
                                    {activations.map(a => (
                                        <tr key={a.id}>
                                            <td><code className="license-code" style={{ fontSize: '0.75rem' }}>{a.device_id}</code></td>
                                            <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{new Date(a.activated_at).toLocaleString()}</td>
                                            <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{a.last_seen ? new Date(a.last_seen).toLocaleString() : new Date(a.activated_at).toLocaleString()}</td>
                                            <td className="actions">
                                                <button className="btn-icon danger" onClick={() => revokeActivation(a.id)} title="Revoke"><Trash2 size={13} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ── Add User Modal ── */}
            {addModal && (
                <div className="modal-overlay" onClick={() => setAddModal(false)}>
                    <div className="modal" style={{ width: 'min(94vw,460px)' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Add User</h3>
                            <button className="modal-close" onClick={() => setAddModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleAddUser}>
                            <div className="field">
                                <label>Full Name</label>
                                <input value={newUser.name} onChange={e => {
                                    const name = e.target.value;
                                    setNewUser(u => ({ ...u, name, username: generateUsername(name, school?.name) }));
                                }} required placeholder="e.g. Mrs. Adaeze Obi" />
                            </div>
                            <div className="field">
                                <label>Username <span style={{ fontWeight:400, color:'var(--text-secondary)', fontSize:'0.7rem' }}>(auto-generated, editable)</span></label>
                                <div className="input-row">
                                    <input value={newUser.username} onChange={e => setNewUser(u => ({ ...u, username: e.target.value.toLowerCase().replace(/\s/g,'') }))} required placeholder="school.name" style={{ fontFamily:'monospace' }} />
                                    <CopyBtn text={newUser.username} id="nu" />
                                </div>
                            </div>
                            <div className="field">
                                <label>Password <span style={{ fontWeight:400, color:'var(--text-secondary)', fontSize:'0.7rem' }}>(auto-generated, editable)</span></label>
                                <div className="input-row">
                                    <input type={showPass ? 'text' : 'password'} value={newUser.password} onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))} required style={{ fontFamily:'monospace', flex:1 }} />
                                    <button type="button" className="btn-icon" onClick={() => setShowPass(v => !v)}>{showPass ? <EyeOff size={13}/> : <Eye size={13}/>}</button>
                                    <CopyBtn text={newUser.password} id="np" />
                                    <button type="button" className="btn-icon" title="Regenerate" onClick={() => setNewUser(u => ({ ...u, password: generatePassword() }))}><RefreshCcw size={13}/></button>
                                </div>
                            </div>
                            <div className="field">
                                <label>Role</label>
                                <select value={newUser.role} onChange={e => setNewUser(u => ({ ...u, role: e.target.value }))}>
                                    {ROLES_LIST.map(r => <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>)}
                                </select>
                            </div>
                            <div style={{ background:'rgba(45,111,181,0.07)', border:'1px solid rgba(45,111,181,0.18)', borderRadius:10, padding:'10px 14px', fontSize:'0.78rem', color:'var(--text-secondary)', marginBottom:14 }}>
                                <div style={{ fontWeight:700, color:'var(--text-primary)', marginBottom:5 }}>What happens next</div>
                                <ul style={{ paddingLeft:16, display:'flex', flexDirection:'column', gap:3 }}>
                                    <li>User saved to database for <strong>{school?.name}</strong></li>
                                    <li>Credentials shown immediately — copy or download as JSON</li>
                                    <li>Give the credentials to the user to log in</li>
                                    <li>{ROLES_LIST.find(r => r.value === newUser.role)?.label}: {ROLES_LIST.find(r => r.value === newUser.role)?.desc}</li>
                                </ul>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-secondary" onClick={() => setAddModal(false)}>Cancel</button>
                                <button type="submit" className="btn-primary" disabled={saving}>
                                    <Download size={13} /> {saving ? 'Creating…' : 'Create & Download'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Created Success Modal ── */}
            {createdUser && (
                <div className="modal-overlay">
                    <div className="modal" style={{ width:'min(94vw,440px)' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 style={{ color:'#11b37f' }}>✓ User Created</h3>
                            <button className="modal-close" onClick={() => setCreatedUser(null)}>✕</button>
                        </div>
                        <div style={{ background:'rgba(17,179,127,0.07)', border:'1px solid rgba(17,179,127,0.2)', borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:'0.8rem', color:'#11b37f', fontWeight:600 }}>
                            Share these credentials with <strong>{createdUser.name}</strong>.
                        </div>
                        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
                            {[
                                { label:'Name',     value: createdUser.name,          id:'cc1' },
                                { label:'Username', value: createdUser.username,      id:'cc2', mono:true },
                                { label:'Password', value: createdUser.plainPassword, id:'cc3', mono:true },
                                { label:'Role',     value: ROLES_LIST.find(r=>r.value===createdUser.role)?.label || createdUser.role, id:'cc4' },
                                { label:'School',   value: createdUser.school,        id:'cc5' },
                            ].map(({ label, value, id, mono }) => (
                                <div key={id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:'var(--bg-secondary)', borderRadius:8, border:'1px solid var(--border-color)' }}>
                                    <div>
                                        <div style={{ fontSize:'0.62rem', fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2 }}>{label}</div>
                                        <div style={{ fontSize:'0.88rem', fontWeight:600, fontFamily: mono ? 'monospace' : 'inherit' }}>{value}</div>
                                    </div>
                                    <CopyBtn text={value} id={id} />
                                </div>
                            ))}
                        </div>
                        <div style={{ display:'flex', gap:10 }}>
                            <button className="btn-secondary" style={{ flex:1 }} onClick={() => setCreatedUser(null)}>Close</button>
                            <button className="btn-primary" style={{ flex:1, display:'inline-flex', alignItems:'center', justifyContent:'center', gap:7 }}
                                onClick={() => downloadCredentials({ ...createdUser, password: createdUser.plainPassword }, `${createdUser.username}-credentials`)}>
                                <Download size={14} /> Download JSON
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Reset Password Modal ── */}
            {resetUser && (
                <div className="modal-overlay" onClick={() => setResetUser(null)}>
                    <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Reset Password</h3>
                            <button className="modal-close" onClick={() => setResetUser(null)}>✕</button>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 16 }}>
                            A new password will be generated for <strong style={{ color: 'var(--text-primary)' }}>{resetUser.name}</strong> ({resetUser.role}).
                            A new credentials file will download automatically.
                        </p>
                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={() => setResetUser(null)}>Cancel</button>
                            <button className="btn-primary" onClick={handleResetPassword}>
                                <KeyRound size={13} /> Reset & Download
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Delete User confirm ── */}
            {deleteUserId && (
                <div className="modal-overlay" onClick={() => setDeleteUserId(null)}>
                    <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
                        <h3>Delete User?</h3>
                        <p style={{ color: 'var(--text-secondary)', margin: '8px 0 20px' }}>This removes the account permanently.</p>
                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={() => setDeleteUserId(null)}>Cancel</button>
                            <button className="btn-danger" onClick={handleDeleteUser}>Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
