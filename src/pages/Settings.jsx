import { useState, useEffect } from 'react';
import { Save, Settings as SettingsIcon, Activity, RefreshCw, Plus, Trash2, Package } from 'lucide-react';
import { supabase } from '../supabase';
import WhatsNew from '../components/WhatsNew';

const DEFAULTS = { currency: '₦', receipt_prefix: 'RCP', maintenance_mode: false };

const ACTION_COLORS = {
    school_created:    '#2d6fb5',
    receipt_generated: '#8b5cf6',
    user_login:        '#11b37f',
    admin_action:      '#f59e0b',
    license_extended:  '#06b6d4',
    school_disabled:   '#ef4444',
};

const EMPTY_VER = { version: '', download_url: '', file_size_mb: '', notes: [{ tag: 'fix', text: '' }] };

export default function Settings() {
    const [tab, setTab]           = useState('general');
    const [settings, setSettings] = useState(DEFAULTS);
    const [saving, setSaving]     = useState(false);
    const [saved, setSaved]       = useState(false);
    const [loading, setLoading]   = useState(true);

    // Logs
    const [logs, setLogs]               = useState([]);
    const [logsLoading, setLogsLoading] = useState(false);
    const [logFilter, setLogFilter]     = useState('');

    // Releases
    const [versions, setVersions]     = useState([]);
    const [verLoading, setVerLoading] = useState(false);
    const [verModal, setVerModal]     = useState(false);
    const [verForm, setVerForm]       = useState(EMPTY_VER);
    const [verSaving, setVerSaving]   = useState(false);
    const [preview, setPreview]       = useState(null);

    useEffect(() => {
        supabase.from('settings').select('*').eq('id', 1).single().then(({ data }) => {
            if (data) setSettings({ ...DEFAULTS, ...data });
            setLoading(false);
        });
    }, []);

    useEffect(() => {
        if (tab === 'logs')     loadLogs();
        if (tab === 'releases') loadVersions();
    }, [tab]);

    async function loadLogs() {
        setLogsLoading(true);
        const { data } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100);
        setLogs(data || []);
        setLogsLoading(false);
    }

    async function loadVersions() {
        setVerLoading(true);
        const { data } = await supabase.from('app_versions').select('*').order('created_at', { ascending: false });
        setVersions(data || []);
        setVerLoading(false);
    }

    async function handleSave(e) {
        e.preventDefault();
        setSaving(true);
        await supabase.from('settings').upsert({ id: 1, ...settings });
        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
    }

    async function handleVerSave(e) {
        e.preventDefault();
        setVerSaving(true);
        const payload = {
            version:      verForm.version.trim(),
            download_url: verForm.download_url.trim(),
            file_size_mb: Number(verForm.file_size_mb) || null,
            notes:        verForm.notes.filter(n => n.text.trim()),
            is_latest:    true,
        };
        await supabase.from('app_versions').update({ is_latest: false }).eq('is_latest', true);
        await supabase.from('app_versions').insert(payload);
        setVerModal(false);
        setVerSaving(false);
        loadVersions();
    }

    async function deleteVersion(id) {
        await supabase.from('app_versions').delete().eq('id', id);
        loadVersions();
    }

    function addNote()           { setVerForm(f => ({ ...f, notes: [...f.notes, { tag: 'fix', text: '' }] })); }
    function removeNote(i)       { setVerForm(f => ({ ...f, notes: f.notes.filter((_, idx) => idx !== i) })); }
    function updateNote(i, k, v) { setVerForm(f => ({ ...f, notes: f.notes.map((n, idx) => idx === i ? { ...n, [k]: v } : n) })); }

    const filteredLogs = logs.filter(l =>
        !logFilter || l.action?.includes(logFilter) || l.description?.toLowerCase().includes(logFilter.toLowerCase())
    );
    const actionTypes = [...new Set(logs.map(l => l.action).filter(Boolean))];

    if (loading) return <div className="page-wrap"><div className="loading-state">Loading…</div></div>;

    return (
        <div className="page-wrap">
            <div className="page-header">
                <div>
                    <h2>Settings</h2>
                    <p className="sub">System configuration, releases & audit logs</p>
                </div>
            </div>

            <div className="tab-bar">
                <button className={`tab-btn ${tab === 'general' ? 'active' : ''}`} onClick={() => setTab('general')}>
                    <SettingsIcon size={14} /> General
                </button>
                <button className={`tab-btn ${tab === 'releases' ? 'active' : ''}`} onClick={() => setTab('releases')}>
                    <Package size={14} /> Releases
                </button>
                <button className={`tab-btn ${tab === 'logs' ? 'active' : ''}`} onClick={() => setTab('logs')}>
                    <Activity size={14} /> Activity Logs
                </button>
            </div>

            {/* ── GENERAL ── */}
            {tab === 'general' && (
                <form onSubmit={handleSave} style={{ maxWidth: 480, marginTop: 20 }}>
                    <div className="settings-card">
                        <div className="settings-section-title"><SettingsIcon size={14} /> General</div>
                        <div className="field">
                            <label>Default Currency Symbol</label>
                            <input value={settings.currency} onChange={e => setSettings(s => ({ ...s, currency: e.target.value }))} placeholder="₦" maxLength={3} />
                        </div>
                        <div className="field">
                            <label>Receipt Number Prefix</label>
                            <input value={settings.receipt_prefix} onChange={e => setSettings(s => ({ ...s, receipt_prefix: e.target.value }))} placeholder="RCP" maxLength={10} />
                            <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                                Receipts will be numbered like: {settings.receipt_prefix}-0001
                            </small>
                        </div>
                    </div>

                    <div className="settings-card" style={{ marginTop: 16 }}>
                        <div className="settings-section-title" style={{ color: '#ef4444' }}>⚠ Danger Zone</div>
                        <div className="field field-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <label style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>Maintenance Mode</label>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: 2 }}>
                                    Blocks all school logins. Only admin can access.
                                </p>
                            </div>
                            <label className="toggle-switch">
                                <input type="checkbox" checked={settings.maintenance_mode} onChange={e => setSettings(s => ({ ...s, maintenance_mode: e.target.checked }))} />
                                <span className="toggle-track" />
                            </label>
                        </div>
                    </div>

                    <button type="submit" className="btn-primary" style={{ marginTop: 20 }} disabled={saving}>
                        <Save size={14} />
                        {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Settings'}
                    </button>
                </form>
            )}

            {/* ── RELEASES ── */}
            {tab === 'releases' && (
                <div style={{ marginTop: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <div className="section-title" style={{ margin: 0 }}>App Versions</div>
                        <button className="btn-primary btn-sm" onClick={() => { setVerForm(EMPTY_VER); setVerModal(true); }}>
                            <Plus size={13} /> New Release
                        </button>
                    </div>

                    {verLoading ? (
                        <div className="loading-state"><RefreshCw size={22} className="spin" /></div>
                    ) : versions.length === 0 ? (
                        <div className="empty-state"><Package size={36} strokeWidth={1.2} /><p>No releases yet.</p></div>
                    ) : (
                        <div className="table-wrap">
                            <table>
                                <thead><tr><th>Version</th><th>Size</th><th>Changelog</th><th>Status</th><th>Actions</th></tr></thead>
                                <tbody>
                                    {versions.map(v => (
                                        <tr key={v.id}>
                                            <td><strong>v{v.version}</strong></td>
                                            <td style={{ color: 'var(--text-secondary)' }}>{v.file_size_mb ? `${v.file_size_mb} MB` : '—'}</td>
                                            <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                                {(v.notes || []).length} item{(v.notes || []).length !== 1 ? 's' : ''}
                                            </td>
                                            <td>
                                                {v.is_latest
                                                    ? <span className="badge" style={{ background: 'rgba(17,179,127,0.12)', color: '#11b37f' }}>Latest</span>
                                                    : <span className="badge" style={{ background: 'var(--border)', color: 'var(--text-secondary)' }}>Old</span>
                                                }
                                            </td>
                                            <td className="actions">
                                                <button className="btn-secondary btn-sm" onClick={() => setPreview(v)}>Preview</button>
                                                <button className="btn-icon danger" onClick={() => deleteVersion(v.id)}><Trash2 size={13} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ── LOGS ── */}
            {tab === 'logs' && (
                <div style={{ marginTop: 20 }}>
                    <div className="toolbar" style={{ marginBottom: 16 }}>
                        <input className="search-input" placeholder="Search logs…" value={logFilter} onChange={e => setLogFilter(e.target.value)} />
                        <select value={logFilter} onChange={e => setLogFilter(e.target.value)}>
                            <option value="">All Actions</option>
                            {actionTypes.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
                        </select>
                        <button className="btn-secondary btn-sm" onClick={loadLogs}><RefreshCw size={14} /></button>
                    </div>

                    {logsLoading ? (
                        <div className="loading-state"><RefreshCw size={24} className="spin" /><span>Loading…</span></div>
                    ) : filteredLogs.length === 0 ? (
                        <div className="empty-state"><Activity size={40} strokeWidth={1.2} /><p>No logs found.</p></div>
                    ) : (
                        <div className="log-list">
                            {filteredLogs.map(log => {
                                const color = ACTION_COLORS[log.action] || '#8fa8c8';
                                return (
                                    <div className="log-item" key={log.id}>
                                        <div className="log-dot" style={{ background: color }} />
                                        <div className="log-body">
                                            <div className="log-desc">
                                                <span className="badge" style={{ background: color + '22', color, marginRight: 8, fontSize: '0.7rem' }}>
                                                    {log.action?.replace(/_/g, ' ')}
                                                </span>
                                                {log.description}
                                            </div>
                                            <div className="log-meta">
                                                {log.school_name && <span>{log.school_name}</span>}
                                                {log.actor && <span>by {log.actor}</span>}
                                                <span>{new Date(log.created_at).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ── New Release Modal ── */}
            {verModal && (
                <div className="modal-overlay" onClick={() => setVerModal(false)}>
                    <div className="modal" style={{ width: 'min(94vw, 520px)', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>New Release</h3>
                            <button className="modal-close" onClick={() => setVerModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleVerSave}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div className="field">
                                    <label>Version Number</label>
                                    <input value={verForm.version} onChange={e => setVerForm(f => ({ ...f, version: e.target.value }))} required placeholder="2.0.30" />
                                </div>
                                <div className="field">
                                    <label>File Size (MB)</label>
                                    <input type="number" step="0.1" value={verForm.file_size_mb} onChange={e => setVerForm(f => ({ ...f, file_size_mb: e.target.value }))} placeholder="14.5" />
                                </div>
                            </div>
                            <div className="field">
                                <label>Download URL</label>
                                <input value={verForm.download_url} onChange={e => setVerForm(f => ({ ...f, download_url: e.target.value }))} placeholder="https://…" />
                            </div>
                            <div className="field">
                                <label>Changelog Items</label>
                                {verForm.notes.map((note, i) => (
                                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                                        <select value={note.tag} onChange={e => updateNote(i, 'tag', e.target.value)}
                                            style={{ width: 120, flexShrink: 0, background: 'var(--bg-secondary)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)', borderRadius: 8, padding: '8px 10px', fontSize: '0.82rem' }}>
                                            <option value="fix">Fix</option>
                                            <option value="feature">New</option>
                                            <option value="improvement">Improved</option>
                                            <option value="security">Security</option>
                                        </select>
                                        <input value={note.text} onChange={e => updateNote(i, 'text', e.target.value)}
                                            placeholder="Describe the change…"
                                            style={{ flex: 1, background: 'var(--bg-secondary)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)', borderRadius: 8, padding: '8px 12px', fontSize: '0.85rem' }} />
                                        {verForm.notes.length > 1 && (
                                            <button type="button" className="btn-icon danger" onClick={() => removeNote(i)}><Trash2 size={13} /></button>
                                        )}
                                    </div>
                                ))}
                                <button type="button" className="btn-secondary btn-sm" onClick={addNote} style={{ marginTop: 4 }}>
                                    <Plus size={12} /> Add Item
                                </button>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-secondary" onClick={() => setVerModal(false)}>Cancel</button>
                                <button type="submit" className="btn-primary" disabled={verSaving}>{verSaving ? 'Publishing…' : 'Publish Release'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── WhatsNew Preview ── */}
            {preview && (
                <WhatsNew
                    version={preview.version}
                    changelog={preview.notes}
                    fileSizeMb={preview.file_size_mb}
                    onClose={() => setPreview(null)}
                    onUpdate={() => {}}
                />
            )}
        </div>
    );
}
