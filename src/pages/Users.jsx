import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Users, RefreshCw, Copy, Check } from 'lucide-react';
import { supabase } from '../supabase';

const ROLES  = ['admin', 'staff', 'director'];
const EMPTY  = { name: '', username: '', password: '', role: 'staff', school_id: '', is_active: true };

// Same hash as the Electron app
function hashPassword(password) {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
        hash = ((hash << 5) - hash) + password.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0').toUpperCase();
}

export default function UsersPage() {
    const [users, setUsers]     = useState([]);
    const [schools, setSchools] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal]     = useState(null);
    const [form, setForm]       = useState(EMPTY);
    const [saving, setSaving]   = useState(false);
    const [error, setError]     = useState('');
    const [deleteId, setDeleteId] = useState(null);
    const [schoolFilter, setSchoolFilter] = useState('');
    const [copied, setCopied]   = useState(null);

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
        setForm({ ...EMPTY, school_id: schoolFilter || (schools[0]?.id || '') });
        setError('');
        setModal('add');
    }

    function openEdit(u) {
        setForm({ ...u, password: '' }); // don't show hash
        setError('');
        setModal('edit');
    }

    async function handleSave(e) {
        e.preventDefault();
        setSaving(true);
        setError('');

        const payload = {
            school_id:     form.school_id,
            name:          form.name.trim(),
            username:      form.username.trim().toLowerCase(),
            role:          form.role,
            is_active:     form.is_active !== false,
        };

        // Only hash password if provided
        if (form.password) payload.password_hash = hashPassword(form.password);

        let err;
        if (modal === 'add') {
            if (!form.password) { setError('Password is required for new users.'); setSaving(false); return; }
            ({ error: err } = await supabase.from('school_users').insert(payload));
        } else {
            ({ error: err } = await supabase.from('school_users').update(payload).eq('id', form.id));
        }

        if (err) { setError(err.message); setSaving(false); return; }
        setModal(null);
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

    function copyHash(hash) {
        navigator.clipboard.writeText(hash);
        setCopied(hash);
        setTimeout(() => setCopied(null), 2000);
    }

    const roleColor = { admin: '#2d6fb5', staff: '#11b37f', director: '#8b5cf6' };

    return (
        <div className="page-wrap">
            <div className="page-header">
                <div>
                    <h2>School Users</h2>
                    <p className="sub">Manage offline login credentials per school</p>
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
                                <th>Password Hash</th>
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
                                        <span className="badge" style={{ background: roleColor[u.role] + '22', color: roleColor[u.role] }}>
                                            {u.role}
                                        </span>
                                    </td>
                                    <td>{u.schools?.name || '—'}</td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <code className="license-code">{u.password_hash}</code>
                                            <button className="btn-icon" onClick={() => copyHash(u.password_hash)} title="Copy hash">
                                                {copied === u.password_hash ? <Check size={12} color="#11b37f" /> : <Copy size={12} />}
                                            </button>
                                        </div>
                                    </td>
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

            {modal && (
                <div className="modal-overlay" onClick={() => setModal(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{modal === 'add' ? 'Add User' : 'Edit User'}</h3>
                            <button className="modal-close" onClick={() => setModal(null)}>✕</button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="field">
                                <label>School</label>
                                <select value={form.school_id} onChange={e => setForm(f => ({ ...f, school_id: e.target.value }))} required>
                                    <option value="">Select school…</option>
                                    {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div className="field">
                                <label>Full Name</label>
                                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Mrs. Adaeze Obi" />
                            </div>
                            <div className="field">
                                <label>Username</label>
                                <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} required placeholder="adaeze.obi" />
                            </div>
                            <div className="field">
                                <label>{modal === 'edit' ? 'New Password (leave blank to keep)' : 'Password'}</label>
                                <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" />
                                {form.password && (
                                    <small style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
                                        Hash preview: <code style={{ color: '#7ab3e8' }}>{hashPassword(form.password)}</code>
                                    </small>
                                )}
                            </div>
                            <div className="field">
                                <label>Role</label>
                                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                            {modal === 'edit' && (
                                <div className="field field-row">
                                    <label>Active</label>
                                    <input type="checkbox" checked={form.is_active !== false} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                                </div>
                            )}
                            {error && <div className="error-msg">{error}</div>}
                            <div className="modal-footer">
                                <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

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
