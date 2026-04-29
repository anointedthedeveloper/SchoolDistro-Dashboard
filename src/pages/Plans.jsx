import { useState, useEffect } from 'react';
import { Plus, Pencil, RefreshCw, Users, Clock, DollarSign } from 'lucide-react';
import { supabase } from '../supabase';

const EMPTY = { name: '', label: '', price: '', duration_days: 365, max_users: 3, is_active: true };

export default function Plans() {
    const [plans, setPlans]   = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal]   = useState(null);
    const [form, setForm]     = useState(EMPTY);
    const [saving, setSaving] = useState(false);
    const [error, setError]   = useState('');

    useEffect(() => { load(); }, []);

    async function load() {
        setLoading(true);
        const { data } = await supabase.from('plans').select('*').order('price');
        setPlans(data || []);
        setLoading(false);
    }

    function openAdd()   { setForm(EMPTY); setError(''); setModal('add'); }
    function openEdit(p) { setForm(p); setError(''); setModal('edit'); }

    async function handleSave(e) {
        e.preventDefault();
        setSaving(true);
        setError('');
        const payload = {
            name: form.name.trim().toLowerCase(),
            label: form.label.trim(),
            price: Number(form.price),
            duration_days: Number(form.duration_days),
            max_users: Number(form.max_users),
            is_active: form.is_active !== false,
        };
        const { error: err } = modal === 'add'
            ? await supabase.from('plans').insert(payload)
            : await supabase.from('plans').update(payload).eq('id', form.id);
        if (err) { setError(err.message); setSaving(false); return; }
        setModal(null);
        setSaving(false);
        load();
    }

    const planAccent = { trial: '#8fa8c8', basic: '#2d6fb5', standard: '#8b5cf6', premium: '#f59e0b' };

    return (
        <div className="page-wrap">
            <div className="page-header">
                <div>
                    <h2>Plans</h2>
                    <p className="sub">Define subscription plans applied to schools</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-secondary btn-sm" onClick={load}><RefreshCw size={14} /></button>
                    <button className="btn-primary" onClick={openAdd}><Plus size={15} /> New Plan</button>
                </div>
            </div>

            {loading ? (
                <div className="loading-state"><RefreshCw size={24} className="spin" /><span>Loading…</span></div>
            ) : (
                <div className="plans-grid">
                    {plans.map(p => {
                        const color = planAccent[p.name] || '#8fa8c8';
                        return (
                            <div className="plan-card" key={p.id} style={{ borderTopColor: color }}>
                                <div className="plan-card-header">
                                    <span className="badge" style={{ background: color + '22', color }}>{p.label}</span>
                                    {!p.is_active && <span className="badge" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>Inactive</span>}
                                    <button className="btn-icon" style={{ marginLeft: 'auto' }} onClick={() => openEdit(p)}><Pencil size={13} /></button>
                                </div>
                                <div className="plan-price">
                                    {p.price === 0 ? 'Free' : `₦${Number(p.price).toLocaleString()}`}
                                </div>
                                <div className="plan-meta">
                                    <span><Clock size={12} /> {p.duration_days === 3 ? '3-day trial' : `${p.duration_days} days`}</span>
                                    <span><Users size={12} /> {p.max_users === -1 ? 'Unlimited users' : `${p.max_users} user${p.max_users !== 1 ? 's' : ''}`}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {modal && (
                <div className="modal-overlay" onClick={() => setModal(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{modal === 'add' ? 'New Plan' : 'Edit Plan'}</h3>
                            <button className="modal-close" onClick={() => setModal(null)}>✕</button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="field">
                                <label>Plan Key <span className="optional">(unique, lowercase)</span></label>
                                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="basic" disabled={modal === 'edit'} />
                            </div>
                            <div className="field">
                                <label>Display Label</label>
                                <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} required placeholder="Basic Plan" />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div className="field">
                                    <label>Price (₦)</label>
                                    <input type="number" min="0" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} required placeholder="50000" />
                                </div>
                                <div className="field">
                                    <label>Duration (days)</label>
                                    <input type="number" min="1" value={form.duration_days} onChange={e => setForm(f => ({ ...f, duration_days: e.target.value }))} required />
                                </div>
                            </div>
                            <div className="field">
                                <label>Max Users <span className="optional">(-1 = unlimited)</span></label>
                                <input type="number" min="-1" value={form.max_users} onChange={e => setForm(f => ({ ...f, max_users: e.target.value }))} required />
                            </div>
                            <div className="field field-row">
                                <label>Active</label>
                                <input type="checkbox" checked={form.is_active !== false} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                            </div>
                            {error && <div className="error-msg">{error}</div>}
                            <div className="modal-footer">
                                <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Plan'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
