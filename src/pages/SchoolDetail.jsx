import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Receipt, Banknote, Clock, Plus, Trash2, Download, RefreshCw, Shield, Crown, UserRound, KeyRound } from 'lucide-react';
import { supabase } from '../supabase';
import { getSubscriptionState } from '../utils/subscription';

const PLAN_STAFF_LIMITS = { trial: 0, basic: 3, standard: 10, premium: Infinity };
const getStaffLimit = plan => PLAN_STAFF_LIMITS[plan] ?? 3;

function hashPassword(password) {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
        hash = ((hash << 5) - hash) + password.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0').toUpperCase();
}

function generatePassword() {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
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
    const [newUser, setNewUser]           = useState({ name: '', role: 'staff' });
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
        const ceoCount   = schoolUsers.filter(u => u.role === 'ceo').length;
        const staffCount = schoolUsers.filter(u => u.role === 'staff').length;
        const staffLimit = getStaffLimit(school.plan);
        if (newUser.role === 'ceo' && ceoCount >= 1) { alert('Only one CEO account allowed per school.'); return; }
        if (newUser.role === 'staff' && staffCount >= staffLimit) { alert(`Plan allows max ${staffLimit} staff.`); return; }
        setSaving(true);
        await createUser(newUser.name, newUser.role);
        setAddModal(false);
        setNewUser({ name: '', role: 'staff' });
        setSaving(false);
        loadUsers(); loadInfo();
    }

    async function createUser(name, role) {
        const password   = generatePassword();
        const slug       = name.trim().toLowerCase().replace(/\s+/g, '.');
        const schoolSlug = school.name.toLowerCase().replace(/\s+/g, '.');
        const username   = `${schoolSlug}.${slug}`;

        const { error } = await supabase.from('school_users').insert({
            school_id:     id,
            name:          name.trim(),
            username,
            role,
            password_hash: password,  // plain stored in DB; hashed in download
            is_active:     true,
        });
        if (error) { alert(error.message); return null; }

        await supabase.from('audit_logs').insert({
            action: 'admin_action',
            description: `User "${name}" (${role}) created for ${school.name}`,
            school_name: school.name, actor: 'admin',
        });

        downloadCredentials(
            [{ username, password_hash: hashPassword(password), role, school: school.name, license_key: school.license_key }],
            `${username}-credentials`
        );
        return { username, password };
    }

    async function handleResetPassword() {
        if (!resetUser) return;
        const newPassword = generatePassword();
        const { error } = await supabase
            .from('school_users')
            .update({ password_hash: newPassword })
            .eq('id', resetUser.id);
        if (error) { alert(error.message); return; }
        await supabase.from('audit_logs').insert({
            action: 'admin_action',
            description: `Password reset for "${resetUser.name}" at ${school.name}`,
            school_name: school.name, actor: 'admin',
        });
        downloadCredentials(
            [{ username: resetUser.username, password_hash: hashPassword(newPassword), role: resetUser.role, school: school.name, license_key: school.license_key, note: 'Password reset' }],
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
            username:      u.username,
            password_hash: hashPassword(u.password_hash),
            role:          u.role,
            school:        school?.name,
            license_key:   school?.license_key,
        }));
        downloadCredentials(data, `${school?.name}-all-users`);
    }

    const roleColor   = { ceo: '#f59e0b', staff: '#2d6fb5' };

    if (loading) return <div className="page-wrap"><div className="loading-state">Loading…</div></div>;
    if (!school)  return <div className="page-wrap"><div className="empty-state"><p>School not found.</p></div></div>;

    const subState      = getSubscriptionState(school);

    const staffLimit    = getStaffLimit(school.plan);
    const ceoCount      = schoolUsers.filter(u => u.role === 'ceo').length;
    const staffCount    = schoolUsers.filter(u => u.role === 'staff').length;
    const usedSlots     = schoolUsers.length;
    const totalSlots    = staffLimit === Infinity ? '∞' : 1 + staffLimit;
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
                    {usedSlots > 0 && <span className="badge" style={{ background: 'rgba(45,111,181,0.2)', color: '#7ab3e8', marginLeft: 6, fontSize: '0.68rem' }}>{usedSlots}/{totalSlots}</span>}
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
                            <span>
                                <Crown size={12} style={{ color: '#f59e0b', marginRight: 4, verticalAlign: 'middle' }} />
                                CEO: <strong>{ceoCount}/1</strong>
                                <span style={{ margin: '0 12px', color: 'var(--border-strong)' }}>|</span>
                                <UserRound size={12} style={{ color: '#2d6fb5', marginRight: 4, verticalAlign: 'middle' }} />
                                Staff: <strong>{staffCount}/{staffLimit === Infinity ? '∞' : staffLimit}</strong>
                            </span>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                                Active devices: <strong style={{ color: 'var(--text-primary)' }}>{activeDevices}</strong>
                            </span>
                        </div>
                        {staffLimit !== Infinity && (
                            <div className="slot-bar-track">
                                <div className="slot-bar-fill" style={{ width: `${Math.min(usedSlots / (1 + staffLimit) * 100, 100)}%`, background: usedSlots >= (1 + staffLimit) ? '#ef4444' : '#11b37f' }} />
                            </div>
                        )}
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
                            <button className="btn-primary btn-sm" onClick={() => setAddModal(true)}
                                disabled={ceoCount >= 1 && staffCount >= staffLimit}>
                                <Plus size={13} /> Add User
                            </button>
                        </div>
                    </div>

                    {usersLoading ? (
                        <div className="loading-state"><RefreshCw size={22} className="spin" /></div>
                    ) : schoolUsers.length === 0 ? (
                        <div className="empty-state" style={{ padding: '32px 0' }}>
                            <Users size={36} strokeWidth={1.2} />
                            <p>No users yet. Add a CEO account first, then staff.</p>
                        </div>
                    ) : (
                        <div className="table-wrap" style={{ marginBottom: 28 }}>
                            <table>
                                <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
                                <tbody>
                                    {schoolUsers.map(u => (
                                        <tr key={u.id}>
                                            <td><strong>{u.name}</strong></td>
                                            <td><code className="license-code" style={{ fontSize: '0.75rem' }}>{u.username}</code></td>
                                            <td>
                                                <span className="badge" style={{ background: (roleColor[u.role] || '#8fa8c8') + '22', color: roleColor[u.role] || '#8fa8c8', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                    {u.role === 'ceo' ? <Crown size={11} /> : <UserRound size={11} />}
                                                    {u.role === 'ceo' ? 'CEO' : 'Staff'}
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
                                    ))}
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
                                            <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{a.last_seen ? new Date(a.last_seen).toLocaleString() : '—'}</td>
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
                    <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Add User</h3>
                            <button className="modal-close" onClick={() => setAddModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleAddUser}>
                            <div className="field">
                                <label>Full Name</label>
                                <input value={newUser.name} onChange={e => setNewUser(u => ({ ...u, name: e.target.value }))} required placeholder="John Doe" />
                            </div>
                            <div className="field">
                                <label>Role</label>
                                <select value={newUser.role} onChange={e => setNewUser(u => ({ ...u, role: e.target.value }))}>
                                    <option value="ceo" disabled={ceoCount >= 1}>CEO — oversees software {ceoCount >= 1 ? '(taken)' : ''}</option>
                                    <option value="staff" disabled={staffCount >= staffLimit && staffLimit !== Infinity}>Staff {staffCount >= staffLimit && staffLimit !== Infinity ? '(limit reached)' : ''}</option>
                                </select>
                            </div>
                            <div className="plan-preview" style={{ marginBottom: 0 }}>
                                <div className="plan-preview-name" style={{ fontSize: '0.78rem', marginBottom: 4 }}>What happens next</div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                    • Username and password auto-generated<br />
                                    • Credentials download as JSON immediately<br />
                                    • JSON contains hashed password for desktop app<br />
                                    • CEO sees all data · Staff has limited access
                                </div>
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
