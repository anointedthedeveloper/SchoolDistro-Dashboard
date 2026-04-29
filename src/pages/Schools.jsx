import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, School, RefreshCw, KeyRound, Eye, PauseCircle, PlayCircle, CreditCard, Clock, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { getSubscriptionState, autoExpireSchools } from '../utils/subscription';

const STATUS_COLORS = { trial: '#f59e0b', active: '#11b37f', expired: '#ef4444', suspended: '#8b5cf6' };
const PLAN_COLORS   = { trial: '#8fa8c8', basic: '#2d6fb5', standard: '#8b5cf6', premium: '#f59e0b' };

function calcExpiry(startDate, durationDays) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + durationDays);
    return d.toISOString().slice(0, 10);
}

function generateKey(planName) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const seg = (n = 4) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const year = new Date().getFullYear();
    const prefix = planName ? planName.slice(0, 4).toUpperCase() : 'XXXX';
    return `SD-${prefix}-${year}-${seg()}`;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

const EMPTY_SCHOOL = { name: '', email: '', plan_id: '', plan_name: '', subscription_status: 'trial', start_date: todayStr(), expires_at: '', license_key: '', max_users: 1 };
const EMPTY_PLAN   = { name: '', label: '', price: '', duration_days: 365, max_users: 3, is_active: true };

export default function Schools() {
    const navigate = useNavigate();
    const [tab, setTab]           = useState('schools');

    // Schools state
    const [schools, setSchools]   = useState([]);
    const [plans, setPlans]       = useState([]);
    const [loading, setLoading]   = useState(true);
    const [modal, setModal]       = useState(null);
    const [form, setForm]         = useState(EMPTY_SCHOOL);
    const [saving, setSaving]     = useState(false);
    const [error, setError]       = useState('');
    const [search, setSearch]     = useState('');
    const [deleteId, setDeleteId] = useState(null);

    // Plans state
    const [planModal, setPlanModal]   = useState(null);
    const [planForm, setPlanForm]     = useState(EMPTY_PLAN);
    const [planSaving, setPlanSaving] = useState(false);
    const [planError, setPlanError]   = useState('');
    const [deletePlanId, setDeletePlanId] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        await autoExpireSchools(supabase);
        const [{ data: s }, { data: p }] = await Promise.all([
            supabase.from('schools').select('*').order('created_at', { ascending: false }),
            supabase.from('plans').select('*').order('price'),
        ]);
        setSchools(s || []);
        setPlans(p || []);
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    // ── School helpers ──
    function applyPlan(planId, startDate) {
        const plan = plans.find(p => p.id === planId);
        if (!plan) return {};
        return {
            expires_at: calcExpiry(startDate || todayStr(), plan.duration_days),
            license_key: generateKey(plan.name),
            max_users: plan.max_users,
            plan_name: plan.name,
            subscription_status: plan.name === 'trial' ? 'trial' : 'active',
        };
    }

    function openAdd() {
        const trialPlan = plans.find(p => p.name === 'trial');
        const base = { ...EMPTY_SCHOOL, start_date: todayStr() };
        if (trialPlan) Object.assign(base, { plan_id: trialPlan.id, ...applyPlan(trialPlan.id, todayStr()) });
        setForm(base); setError(''); setModal('add');
    }

    function openEdit(s) {
        setForm({ ...s, start_date: s.start_date || todayStr(), expires_at: s.expires_at?.slice(0, 10) || '', email: s.email || '', plan_id: s.plan_id || '', plan_name: s.plan || '' });
        setError(''); setModal('edit');
    }

    function handlePlanChange(planId) {
        setForm(f => ({ ...f, plan_id: planId, ...applyPlan(planId, f.start_date) }));
    }

    function handleStartDateChange(date) {
        const plan = plans.find(p => p.id === form.plan_id);
        setForm(f => ({ ...f, start_date: date, expires_at: plan ? calcExpiry(date, plan.duration_days) : f.expires_at }));
    }

    async function handleSave(e) {
        e.preventDefault(); setSaving(true); setError('');
        const plan = plans.find(p => p.id === form.plan_id);
        const payload = {
            name: form.name.trim(), email: form.email.trim(),
            plan_id: form.plan_id || null, plan: plan?.name || form.plan_name,
            license_key: form.license_key.trim(), subscription_status: form.subscription_status,
            start_date: form.start_date, expires_at: form.expires_at || null,
            max_users: form.max_users, is_active: form.subscription_status !== 'suspended',
        };
        if (modal === 'add') {
            const { data, error: err } = await supabase.from('schools').insert(payload).select('id').single();
            if (err) { setError(err.message); setSaving(false); return; }
            if (plan?.price > 0) await supabase.from('payments').insert({ school_id: data.id, plan_id: plan.id, amount: plan.price, status: 'paid' });
            await supabase.from('audit_logs').insert({ action: 'school_created', description: `${payload.name} registered on ${plan?.label || 'Trial'} plan`, school_name: payload.name, actor: 'admin' });
        } else {
            const { error: err } = await supabase.from('schools').update(payload).eq('id', form.id);
            if (err) { setError(err.message); setSaving(false); return; }
            await supabase.from('audit_logs').insert({ action: 'admin_action', description: `${payload.name} updated to ${plan?.label || payload.plan}`, school_name: payload.name, actor: 'admin' });
        }
        setModal(null); setSaving(false); load();
    }

    async function handleDelete() {
        await supabase.from('schools').delete().eq('id', deleteId);
        setDeleteId(null); load();
    }

    async function toggleSuspend(school) {
        const isSuspended = school.subscription_status === 'suspended';
        await supabase.from('schools').update({ subscription_status: isSuspended ? 'active' : 'suspended', is_active: isSuspended }).eq('id', school.id);
        await supabase.from('audit_logs').insert({ action: isSuspended ? 'admin_action' : 'school_disabled', description: `${school.name} was ${isSuspended ? 'reactivated' : 'suspended'}`, school_name: school.name, actor: 'admin' });
        load();
    }

    // ── Plan helpers ──
    function openPlanAdd()   { setPlanForm(EMPTY_PLAN); setPlanError(''); setPlanModal('add'); }
    function openPlanEdit(p) { setPlanForm(p); setPlanError(''); setPlanModal('edit'); }

    async function handlePlanSave(e) {
        e.preventDefault(); setPlanSaving(true); setPlanError('');
        const payload = { name: planForm.name.trim().toLowerCase(), label: planForm.label.trim(), price: Number(planForm.price), duration_days: Number(planForm.duration_days), max_users: Number(planForm.max_users), is_active: planForm.is_active !== false };
        const { error: err } = planModal === 'add'
            ? await supabase.from('plans').insert(payload)
            : await supabase.from('plans').update(payload).eq('id', planForm.id);
        if (err) { setPlanError(err.message); setPlanSaving(false); return; }
        setPlanModal(null); setPlanSaving(false); load();
    }

    async function handlePlanDelete() {
        await supabase.from('plans').delete().eq('id', deletePlanId);
        setDeletePlanId(null); load();
    }

    const filtered = schools.filter(s =>
        !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.email || '').toLowerCase().includes(search.toLowerCase()) ||
        (s.license_key || '').toLowerCase().includes(search.toLowerCase())
    );

    const selectedPlan = plans.find(p => p.id === form.plan_id);
    const activePlans  = plans.filter(p => p.is_active);

    return (
        <div className="page-wrap">
            <div className="page-header">
                <div>
                    <h2>Schools & Plans</h2>
                    <p className="sub">{schools.length} school{schools.length !== 1 ? 's' : ''} · {plans.length} plan{plans.length !== 1 ? 's' : ''}</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-secondary btn-sm" onClick={load}><RefreshCw size={14} /></button>
                    {tab === 'schools'
                        ? <button className="btn-primary" onClick={openAdd}><Plus size={15} /> Add School</button>
                        : <button className="btn-primary" onClick={openPlanAdd}><Plus size={15} /> New Plan</button>
                    }
                </div>
            </div>

            <div className="tab-bar">
                <button className={`tab-btn ${tab === 'schools' ? 'active' : ''}`} onClick={() => setTab('schools')}>
                    <School size={14} /> Schools
                </button>
                <button className={`tab-btn ${tab === 'plans' ? 'active' : ''}`} onClick={() => setTab('plans')}>
                    <CreditCard size={14} /> Plans
                </button>
            </div>

            {/* ── SCHOOLS TAB ── */}
            {tab === 'schools' && (
                <>
                    <div className="toolbar" style={{ marginTop: 16 }}>
                        <input className="search-input" placeholder="Search by name, email or license…" value={search} onChange={e => setSearch(e.target.value)} />
                    </div>

                    {loading ? (
                        <div className="loading-state"><RefreshCw size={24} className="spin" /><span>Loading…</span></div>
                    ) : filtered.length === 0 ? (
                        <div className="empty-state"><School size={40} strokeWidth={1.2} /><p>{search ? 'No schools match.' : 'No schools yet.'}</p></div>
                    ) : (
                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr><th>School</th><th>Email</th><th>Plan</th><th>Status</th><th>Expires</th><th>Actions</th></tr>
                                </thead>
                                <tbody>
                                    {filtered.map(s => {
                                        const pc    = PLAN_COLORS[s.plan] || '#8fa8c8';
                                        const state = getSubscriptionState(s);
                                        const isSuspended = s.subscription_status === 'suspended';
                                        return (
                                            <tr key={s.id}>
                                                <td>
                                                    <strong>{s.name}</strong><br />
                                                    <code className="license-code" style={{ fontSize: '0.7rem' }}>{s.license_key}</code>
                                                </td>
                                                <td style={{ color: 'var(--text-secondary)' }}>{s.email || '—'}</td>
                                                <td><span className="badge" style={{ background: pc + '22', color: pc }}>{s.plan || '—'}</span></td>
                                                <td>
                                                    <span className="badge" style={{ background: state.color + '22', color: state.color, fontWeight: state.urgent ? 700 : 500 }}>
                                                        {state.label}
                                                    </span>
                                                </td>
                                                <td style={{ fontSize: '0.82rem' }}>{s.expires_at ? new Date(s.expires_at).toLocaleDateString() : '—'}</td>
                                                <td className="actions">
                                                    <button className="btn-icon" onClick={() => navigate(`/schools/${s.id}`)} title="View"><Eye size={14} /></button>
                                                    <button className="btn-icon" onClick={() => openEdit(s)} title="Edit"><Pencil size={14} /></button>
                                                    <button className={`btn-icon ${isSuspended ? '' : 'danger'}`} onClick={() => toggleSuspend(s)} title={isSuspended ? 'Reactivate' : 'Suspend'}>
                                                        {isSuspended ? <PlayCircle size={14} /> : <PauseCircle size={14} />}
                                                    </button>
                                                    <button className="btn-icon danger" onClick={() => setDeleteId(s.id)} title="Delete"><Trash2 size={14} /></button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}

            {/* ── PLANS TAB ── */}
            {tab === 'plans' && (
                <div style={{ marginTop: 16 }}>
                    {loading ? (
                        <div className="loading-state"><RefreshCw size={24} className="spin" /></div>
                    ) : (
                        <div className="plans-grid">
                            {plans.map(p => {
                                const color = PLAN_COLORS[p.name] || '#8fa8c8';
                                return (
                                    <div className="plan-card" key={p.id} style={{ borderTopColor: color }}>
                                        <div className="plan-card-header">
                                            <span className="badge" style={{ background: color + '22', color }}>{p.label}</span>
                                            {!p.is_active && <span className="badge" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>Inactive</span>}
                                            <button className="btn-icon" style={{ marginLeft: 'auto' }} onClick={() => openPlanEdit(p)}><Pencil size={13} /></button>
                                            <button className="btn-icon danger" onClick={() => setDeletePlanId(p.id)}><Trash2 size={13} /></button>
                                        </div>
                                        <div className="plan-price">{p.price === 0 ? 'Free' : `₦${Number(p.price).toLocaleString()}`}</div>
                                        <div className="plan-meta">
                                            <span><Clock size={12} /> {p.duration_days === 3 ? '3-day trial' : `${p.duration_days} days`}</span>
                                            <span><Users size={12} /> {p.max_users === -1 ? 'Unlimited users' : `${p.max_users} user${p.max_users !== 1 ? 's' : ''}`}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ── School Modal ── */}
            {modal && (
                <div className="modal-overlay" onClick={() => setModal(null)}>
                    <div className="modal" style={{ width: 'min(94vw, 500px)' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{modal === 'add' ? 'Add School' : 'Edit Subscription'}</h3>
                            <button className="modal-close" onClick={() => setModal(null)}>✕</button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="field"><label>School Name</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Peter Harvard International" /></div>
                            <div className="field"><label>Email / Contact</label><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="admin@school.edu" /></div>
                            <div className="field">
                                <label>Subscription Plan</label>
                                <select value={form.plan_id} onChange={e => handlePlanChange(e.target.value)} required>
                                    <option value="">— Select a plan —</option>
                                    {activePlans.map(p => <option key={p.id} value={p.id}>{p.label} — {p.price === 0 ? 'Free' : `₦${Number(p.price).toLocaleString()}`} / {p.duration_days}d / {p.max_users === -1 ? 'Unlimited' : p.max_users + ' users'}</option>)}
                                </select>
                            </div>
                            {selectedPlan && (
                                <div className="plan-preview">
                                    <div className="plan-preview-name">{selectedPlan.label}</div>
                                    <div className="plan-preview-meta">
                                        <span>₦{Number(selectedPlan.price).toLocaleString()}</span>
                                        <span>{selectedPlan.duration_days} days</span>
                                        <span>{selectedPlan.max_users === -1 ? 'Unlimited users' : `${selectedPlan.max_users} users`}</span>
                                    </div>
                                </div>
                            )}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div className="field"><label>Start Date</label><input type="date" value={form.start_date} onChange={e => handleStartDateChange(e.target.value)} required /></div>
                                <div className="field"><label>Expiry <span className="optional">(auto)</span></label><input type="date" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} style={{ background: 'rgba(45,111,181,0.07)', color: 'var(--accent-hover)' }} /></div>
                            </div>
                            <div className="field">
                                <label>Status</label>
                                <select value={form.subscription_status} onChange={e => setForm(f => ({ ...f, subscription_status: e.target.value }))}>
                                    <option value="trial">Trial</option><option value="active">Active</option><option value="expired">Expired</option><option value="suspended">Suspended</option>
                                </select>
                            </div>
                            <div className="field">
                                <label>License Key</label>
                                <div className="input-row">
                                    <input value={form.license_key} onChange={e => setForm(f => ({ ...f, license_key: e.target.value }))} required placeholder="SD-BASIC-2026-XXXX" />
                                    <button type="button" className="btn-secondary btn-sm" onClick={() => setForm(f => ({ ...f, license_key: generateKey(selectedPlan?.name || f.plan_name) }))}><KeyRound size={13} /> Regen</button>
                                </div>
                            </div>
                            {error && <div className="error-msg">{error}</div>}
                            <div className="modal-footer">
                                <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Plan Modal ── */}
            {planModal && (
                <div className="modal-overlay" onClick={() => setPlanModal(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{planModal === 'add' ? 'New Plan' : 'Edit Plan'}</h3>
                            <button className="modal-close" onClick={() => setPlanModal(null)}>✕</button>
                        </div>
                        <form onSubmit={handlePlanSave}>
                            <div className="field"><label>Plan Key <span className="optional">(unique, lowercase)</span></label><input value={planForm.name} onChange={e => setPlanForm(f => ({ ...f, name: e.target.value }))} required placeholder="basic" disabled={planModal === 'edit'} /></div>
                            <div className="field"><label>Display Label</label><input value={planForm.label} onChange={e => setPlanForm(f => ({ ...f, label: e.target.value }))} required placeholder="Basic Plan" /></div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div className="field"><label>Price (₦)</label><input type="number" min="0" value={planForm.price} onChange={e => setPlanForm(f => ({ ...f, price: e.target.value }))} required /></div>
                                <div className="field"><label>Duration (days)</label><input type="number" min="1" value={planForm.duration_days} onChange={e => setPlanForm(f => ({ ...f, duration_days: e.target.value }))} required /></div>
                            </div>
                            <div className="field"><label>Max Users <span className="optional">(-1 = unlimited)</span></label><input type="number" min="-1" value={planForm.max_users} onChange={e => setPlanForm(f => ({ ...f, max_users: e.target.value }))} required /></div>
                            <div className="field field-row"><label>Active</label><input type="checkbox" checked={planForm.is_active !== false} onChange={e => setPlanForm(f => ({ ...f, is_active: e.target.checked }))} /></div>
                            {planError && <div className="error-msg">{planError}</div>}
                            <div className="modal-footer">
                                <button type="button" className="btn-secondary" onClick={() => setPlanModal(null)}>Cancel</button>
                                <button type="submit" className="btn-primary" disabled={planSaving}>{planSaving ? 'Saving…' : 'Save Plan'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Delete Plan confirm ── */}
            {deletePlanId && (
                <div className="modal-overlay" onClick={() => setDeletePlanId(null)}>
                    <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
                        <h3>Delete Plan?</h3>
                        <p style={{ color: 'var(--text-secondary)', margin: '8px 0 20px' }}>Schools using this plan will lose their plan reference. This cannot be undone.</p>
                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={() => setDeletePlanId(null)}>Cancel</button>
                            <button className="btn-danger" onClick={handlePlanDelete}>Delete</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Delete School confirm ── */}
            {deleteId && (
                <div className="modal-overlay" onClick={() => setDeleteId(null)}>
                    <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
                        <h3>Delete School?</h3>
                        <p style={{ color: 'var(--text-secondary)', margin: '8px 0 20px' }}>This permanently deletes the school and all its data.</p>
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
