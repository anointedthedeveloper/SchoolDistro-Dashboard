import { useState, useEffect } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { supabase } from '../supabase';

const ACTION_COLORS = {
    school_created:    '#2d6fb5',
    receipt_generated: '#8b5cf6',
    user_login:        '#11b37f',
    admin_action:      '#f59e0b',
    license_extended:  '#06b6d4',
    school_disabled:   '#ef4444',
};

export default function Logs() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');

    useEffect(() => { load(); }, []);

    async function load() {
        setLoading(true);
        const { data } = await supabase
            .from('audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);
        setLogs(data || []);
        setLoading(false);
    }

    const filtered = logs.filter(l =>
        !filter || l.action?.includes(filter) || l.description?.toLowerCase().includes(filter.toLowerCase())
    );

    const actionTypes = [...new Set(logs.map(l => l.action).filter(Boolean))];

    return (
        <div className="page-wrap">
            <div className="page-header">
                <div>
                    <h2>Activity Logs</h2>
                    <p className="sub">Audit trail of all system events</p>
                </div>
                <button className="btn-secondary btn-sm" onClick={load}><RefreshCw size={14} /></button>
            </div>

            <div className="toolbar">
                <input className="search-input" placeholder="Search logs…" value={filter} onChange={e => setFilter(e.target.value)} />
                <select value={filter} onChange={e => setFilter(e.target.value)}>
                    <option value="">All Actions</option>
                    {actionTypes.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
                </select>
            </div>

            {loading ? (
                <div className="loading-state"><RefreshCw size={24} className="spin" /><span>Loading…</span></div>
            ) : filtered.length === 0 ? (
                <div className="empty-state"><Activity size={40} strokeWidth={1.2} /><p>No logs found.</p></div>
            ) : (
                <div className="log-list">
                    {filtered.map(log => {
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
    );
}
