import { useState, useEffect } from 'react';
import { Save, Settings as SettingsIcon, Activity, RefreshCw } from 'lucide-react';
import { supabase } from '../supabase';

const DEFAULTS = { currency: '₦', receipt_prefix: 'RCP', maintenance_mode: false };

const ACTION_COLORS = {
    school_created:    '#2d6fb5',
    receipt_generated: '#8b5cf6',
    user_login:        '#11b37f',
    admin_action:      '#f59e0b',
    license_extended:  '#06b6d4',
    school_disabled:   '#ef4444',
};

export default function Settings() {
    const [tab, setTab]           = useState('general');
    const [settings, setSettings] = useState(DEFAULTS);
    const [saving, setSaving]     = useState(false);
    const [saved, setSaved]       = useState(false);
    const [loading, setLoading]   = useState(true);
    const [logs, setLogs]         = useState([]);
    const [logsLoading, setLogsLoading] = useState(false);
    const [logFilter, setLogFilter] = useState('');

    useEffect(() => {
        supabase.from('settings').select('*').eq('id', 1).single().then(({ data }) => {
            if (data) setSettings({ ...DEFAULTS, ...data });
            setLoading(false);
        });
    }, []);

    useEffect(() => {
        if (tab === 'logs') loadLogs();
    }, [tab]);

    async function loadLogs() {
        setLogsLoading(true);
        const { data } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100);
        setLogs(data || []);
        setLogsLoading(false);
    }

    async function handleSave(e) {
        e.preventDefault();
        setSaving(true);
        await supabase.from('settings').upsert({ id: 1, ...settings });
        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
    }

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
                    <p className="sub">System configuration & audit logs</p>
                </div>
            </div>

            <div className="tab-bar">
                <button className={`tab-btn ${tab === 'general' ? 'active' : ''}`} onClick={() => setTab('general')}>
                    <SettingsIcon size={14} /> General
                </button>
                <button className={`tab-btn ${tab === 'logs' ? 'active' : ''}`} onClick={() => setTab('logs')}>
                    <Activity size={14} /> Activity Logs
                </button>
            </div>

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
        </div>
    );
}
