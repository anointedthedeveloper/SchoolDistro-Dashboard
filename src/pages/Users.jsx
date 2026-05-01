import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Users, RefreshCw, Copy, Check, Download, Eye, EyeOff, RefreshCcw } from 'lucide-react';
import { supabase } from '../supabase';

const ROLES = [
    { value: 'principal', label: 'Principal', desc: 'Full access — school info, reports, settings, approvals' },
    { value: 'director',  label: 'Director',  desc: 'Reports, parents, view settings, approve changes' },
    { value: 'staff',     label: 'Staff',     desc: 'Receipt generation only' },
];
const ROLE_COLORS = { principal: '#11b37f', director: '#2d6fb5', staff: '#8fa8c8' };
const ROLE_DESC   = { principal: 'Full Access', director: 'Reports + Approve', staff: 'Receipts Only' };

const EMPTY = { name: '', username: '', password: '', role: 'staff', school_id: '', is_active: true };

function hashPassword(password) {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
        hash = ((hash << 5) - hash) + password.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0').toUpperCase();
}

function generateUsername(name) {
    if (!name.trim()) return '';
    const parts = name.trim().toLowerCase().split(/\s+/);
    if (parts.length === 1) return parts[0];
    return parts[0] + '.' + parts[parts.length - 1];
}

function generatePassword() {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ';
    let pw = upper[Math.floor(Math.random() * upper.length)];
    for (let i = 0; i < 6; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    pw += Math.floor(Math.random() * 90 + 10);
    return pw;
}

function downloadCredentials(user, schoolName) {
    const data = {
        school:   schoolName || 'SchoolDistro',
        name:     user.name,
        username: user.username,
        password: user.plainPassword,
        role:     user.role,
        note:     'Keep this file safe. Do not share your password with anyone.',
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${user.username}-credentials.json`;
    a.click();
    URL.revokeObjectURL(url);
}

export default function UsersPage() {
    const [users, setUsers]       = useState([]);
    const [schools, setSchools]   = useState([]);
    const [loading, setLoading]   = useState(true);
    const [modal, setModal]       = useState(null);   // null | 'add' | 'edit' | 'created'
    const [form, setForm]         = useState(EMPTY);
    const [saving, setSaving]     = useState(false);
    const [error, setError]       = useState('');
    const [deleteId, setDeleteId] = useState(null);
    const [schoolFilter, setSchoolFilter] = useState('');
    const [copied, setCopied]     = useState(null);
    const [showPass, setShowPass] = useState(false);
    const [createdUser, setCreatedUser] = useState(null); // shown in success modal

    useEffect(() => {
        supabase.from('schools').select('id, name').order('name').then(({ data }) => setSchools(data || []));
    }, []);

    useEffect(() => { load(); }, [schoolFilter]);

    async function load() {
        setLoading(true);
        let q = supabase.from('school_users').select('*, schools(name)').order('created_at', { ascending: false });
        if (schoolFilter) q = q.eq('school_id', schoolFilter);
        const { data } = await q;
        setUsers(data || []);
        setLoading(false);
    }

    function openAdd() {
        const pw = generatePassword();
        setForm({ ...EMPTY, school_id: schoolFilter || (schools[0]?.id || ''), password: pw });
        setShowPass(true);
        setError('');
        setModal('add');
    }

    function openEdit(u) {
        setForm({ ...u, password: '' });
        setShowPass(false);
        setError('');
        setModal('edit');
    }

    // Auto-generate username when name changes (add mode only)
    function handleNameChange(name) {
        setForm(f => ({
            ...f,
            name,
            username: modal === 'add' ? generateUsername(name) : f.username,
        }));
    }

    async function handleSave(e) {
        e.preventDefault();
        setSaving(true);
        setError('');

        const plainPassword = form.password;
        const payload = {
            school_id:     form.school_id,
            name:          form.name.trim(),
            username:      form.username.trim().toLowerCase(),
            role:          form.role,
            is_active:     true,
        };

        if (modal === 'add') {
            if (!plainPassword) { setError('Password is required.'); setSaving(false); return; }
            if (!form.username.trim()) { setError('Username is required.'); setSaving(false); return; }
            payload.password_hash = hashPassword(plainPassword);
            const { error: err } = await supabase.from('school_users').insert(payload);
            if (err) { setError(err.message); setSaving(false); return; }
            // Show success modal with credentials
            const school = schools.find(s => s.id === form.school_id);
            setCreatedUser({ ...payload, plainPassword, school_name: school?.name });
            setModal('created');
        } else {
            if (plainPassword) payload.password_hash = hashPassword(plainPassword);
            const { error: err } = await supabase.from('school_users').update(payload).eq('id', form.id);
            if (err) { setError(err.message); setSaving(false); return; }
            setModal(null);
        }
        setSaving(false);
        load();
    }

    async function handleDelete() {
        await supabase.from('school_users').delete().eq('id', deleteId);
        setDeleteId(null);
        load();
    }

    async function toggleActive(u) {
        await supabase.from('school_users').update({ is_active: !u.is_active }).eq('id', u.id);
        load();
    }

    function copyText(text, key) {
        navigator.clipboard.writeText(text);
        setCopied(key);
        setTimeout(() => setCopied(null), 2000);
    }

    const CopyBtn = ({ text, id }) => (
        <button className="btn-icon" onClick={() => copyText(text, id)} title="Copy" style={{ padding: '3px 6px' }}>
            {copied === id ? <Check size={12} color="#11b37f" /> : <Copy size={12} />}
        </button>
    );

    return (
        <div className="page-wrap">
            <div className="page-header">
                <div>
                    <h2>School Users</h2>
                    <p className="sub">Manage login credentials per school</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-secondary btn-sm" onClick={load}><RefreshCw size={14} /></button>
                    <button className="btn-primary" onClick={openAdd}><Plus size={15} /> Add User</button>
                </div>
            </div>

            <div className="toolbar">
                <select value={schoolFilter} onChange={e => setSchoolFilter(e.target.value)}>
                    <option value="">All Schools</option>
                    {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
            </div>

            {loading ? (
                <div className="loading-state"><RefreshCw size={22} className="spin" /><span>Loading…</span></div>
            ) : users.length === 0 ? (
                <div className="empty-state"><Users size={40} strokeWidth={1.2} /><p>No users yet. Add the first one.</p></div>
            ) : (
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Username</th>
                                <th>Role</th>
                                <th>School</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u.id}>
                                    <td><strong>{u.name}</strong></td>
                                    <td><code className="license-code">{u.username}</code></td>
                                    <td>
                                        <span className="badge" style={{ background: (ROLE_COLORS[u.role] || '#8fa8c8') + '22', color: ROLE_COLORS[u.role] || '#8fa8c8' }}>
                                            {ROLES.find(r => r.value === u.role)?.label || u.role}
                                        </span>
                                        <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                                            {ROLE_DESC[u.role] || ''}
                                        </div>
                                    </td>
                                    <td>{u.schools?.name || '—'}</td>
                                    <td>
                                        <button className={`toggle-btn ${u.is_active ? 'active' : 'inactive'}`} onClick={() => toggleActive(u)}>
                                            {u.is_active ? 'Active' : 'Inactive'}
                                        </button>
                                    </td>
                                    <td className="actions">
                                        <button className="btn-icon" onClick={() => openEdit(u)} title="Edit"><Pencil size={14} /></button>
                                        <button className="btn-icon danger" onClick={() => setDeleteId(u.id)} title="Delete"><Trash2 size={14} /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Add / Edit Modal ── */}
            {(modal === 'add' || modal === 'edit') && (
                <div className="modal-overlay" onClick={() => setModal(null)}>
                    <div className="modal" style={{ width: 'min(94vw, 460px)' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{modal === 'add' ? 'Add User' : 'Edit User'}</h3>
                            <button className="modal-close" onClick={() => setModal(null)}>✕</button>
                        </div>
                        <form onSubmit={handleSave}>
                            {/* School */}
                            <div className="field">
                                <label>School</label>
                                <select value={form.school_id} onChange={e => setForm(f => ({ ...f, school_id: e.target.value }))} required>
                                    <option value="">Select school…</option>
                                    {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>

                            {/* Full Name */}
                            <div className="field">
                                <label>Full Name</label>
                                <input
                                    value={form.name}
                                    onChange={e => handleNameChange(e.target.value)}
                                    required placeholder="e.g. Mrs. Adaeze Obi"
                                />
                            </div>

                            {/* Username — auto-generated but editable */}
                            <div className="field">
                                <label>Username <span style={{ fontWeight: 400, color: 'var(--text-secondary)', fontSize: '0.7rem' }}>(auto-generated, editable)</span></label>
                                <div className="input-row">
                                    <input
                                        value={form.username}
                                        onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/\s/g, '') }))}
                                        required placeholder="adaeze.obi"
                                        style={{ fontFamily: 'monospace', letterSpacing: '0.03em' }}
                                    />
                                    <CopyBtn text={form.username} id="uname" />
                                </div>
                            </div>

                            {/* Password — auto-generated but editable */}
                            <div className="field">
                                <label>
                                    {modal === 'edit' ? 'New Password' : 'Password'}
                                    <span style={{ fontWeight: 400, color: 'var(--text-secondary)', fontSize: '0.7rem', marginLeft: 6 }}>
                                        {modal === 'add' ? '(auto-generated, editable)' : '(leave blank to keep current)'}
                                    </span>
                                </label>
                                <div className="input-row">
                                    <input
                                        type={showPass ? 'text' : 'password'}
                                        value={form.password}
                                        onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                        placeholder={modal === 'edit' ? '••••••••' : ''}
                                        style={{ fontFamily: 'monospace', letterSpacing: '0.05em', flex: 1 }}
                                    />
                                    <button type="button" className="btn-icon" onClick={() => setShowPass(v => !v)} title={showPass ? 'Hide' : 'Show'}>
                                        {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                    {form.password && <CopyBtn text={form.password} id="pass" />}
                                    {modal === 'add' && (
                                        <button type="button" className="btn-icon" title="Regenerate password"
                                            onClick={() => setForm(f => ({ ...f, password: generatePassword() }))}>
                                            <RefreshCcw size={13} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Role */}
                            <div className="field">
                                <label>Role</label>
                                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>)}
                                </select>
                            </div>

                            {/* Info box for add mode */}
                            {modal === 'add' && (
                                <div style={{ background: 'rgba(45,111,181,0.07)', border: '1px solid rgba(45,111,181,0.18)', borderRadius: 10, padding: '10px 14px', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
                                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 5 }}>What happens next</div>
                                    <ul style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 3 }}>
                                        <li>User is saved to the database</li>
                                        <li>Credentials download as a JSON file immediately</li>
                                        <li>Give the JSON file to the user — it contains their username and password</li>
                                        <li>{ROLES.find(r => r.value === form.role)?.label}: {ROLES.find(r => r.value === form.role)?.desc}</li>
                                    </ul>
                                </div>
                            )}

                            {modal === 'edit' && (
                                <div className="field field-row">
                                    <label>Active</label>
                                    <input type="checkbox" checked={form.is_active !== false} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                                </div>
                            )}

                            {error && <div className="error-msg">{error}</div>}

                            <div className="modal-footer">
                                <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                                <button type="submit" className="btn-primary" disabled={saving}>
                                    {saving ? 'Saving…' : modal === 'add' ? <><Download size={14} /> Create & Download</> : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Created Success Modal ── */}
            {modal === 'created' && createdUser && (
                <div className="modal-overlay">
                    <div className="modal" style={{ width: 'min(94vw, 440px)' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 style={{ color: '#11b37f' }}>✓ User Created</h3>
                            <button className="modal-close" onClick={() => setModal(null)}>✕</button>
                        </div>

                        <div style={{ background: 'rgba(17,179,127,0.07)', border: '1px solid rgba(17,179,127,0.2)', borderRadius: 10, padding: '12px 14px', marginBottom: 16, fontSize: '0.8rem', color: '#11b37f', fontWeight: 600 }}>
                            User created successfully. Share these credentials with <strong>{createdUser.name}</strong>.
                        </div>

                        {/* Credentials display */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
                            {[
                                { label: 'Full Name', value: createdUser.name, id: 'cn' },
                                { label: 'Username', value: createdUser.username, id: 'cu', mono: true },
                                { label: 'Password', value: createdUser.plainPassword, id: 'cp', mono: true },
                                { label: 'Role', value: ROLES.find(r => r.value === createdUser.role)?.label || createdUser.role, id: 'cr' },
                                { label: 'School', value: createdUser.school_name || '—', id: 'cs' },
                            ].map(({ label, value, id, mono }) => (
                                <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                                    <div>
                                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{label}</div>
                                        <div style={{ fontSize: '0.88rem', fontWeight: 600, fontFamily: mono ? 'monospace' : 'inherit', letterSpacing: mono ? '0.04em' : 'normal' }}>{value}</div>
                                    </div>
                                    <CopyBtn text={value} id={id} />
                                </div>
                            ))}
                        </div>

                        <div style={{ display: 'flex', gap: 10 }}>
                            <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setModal(null)}>Close</button>
                            <button className="btn-primary" style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
                                onClick={() => downloadCredentials(createdUser, createdUser.school_name)}>
                                <Download size={14} /> Download JSON
                            </button>
                        </div>

                        <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: 12 }}>
                            The JSON file contains the plain password. Keep it safe.
                        </p>
                    </div>
                </div>
            )}

            {/* ── Delete confirm ── */}
            {deleteId && (
                <div className="modal-overlay" onClick={() => setDeleteId(null)}>
                    <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
                        <h3>Delete User?</h3>
                        <p style={{ color: 'var(--text-secondary)', margin: '8px 0 20px' }}>This user will no longer be able to log in. Cannot be undone.</p>
                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={() => setDeleteId(null)}>Cancel</button>
                            <button className="btn-danger" onClick={handleDelete}>Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
