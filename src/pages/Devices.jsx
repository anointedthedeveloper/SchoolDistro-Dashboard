import { useState, useEffect } from 'react';
import { Monitor, RefreshCw, ShieldOff, ShieldCheck } from 'lucide-react';
import { supabase } from '../supabase';

export default function Devices() {
    const [devices, setDevices]   = useState([]);
    const [schools, setSchools]   = useState([]);
    const [loading, setLoading]   = useState(true);
    const [schoolFilter, setSchoolFilter] = useState('');

    useEffect(() => {
        supabase.from('schools').select('id, name').order('name').then(({ data }) => setSchools(data || []));
    }, []);

    useEffect(() => { load(); }, [schoolFilter]);

    async function load() {
        setLoading(true);
        let q = supabase.from('activations').select('*, schools(name)').order('last_seen', { ascending: false });
        if (schoolFilter) q = q.eq('school_id', schoolFilter);
        const { data } = await q;
        setDevices(data || []);
        setLoading(false);
    }

    async function toggleDevice(device) {
        await supabase.from('activations').update({ is_active: !device.is_active }).eq('id', device.id);
        load();
    }

    async function deleteDevice(id) {
        await supabase.from('activations').delete().eq('id', id);
        load();
    }

    const activeCount = devices.filter(d => d.is_active).length;

    return (
        <div className="page-wrap">
            <div className="page-header">
                <div>
                    <h2>Devices</h2>
                    <p className="sub">{activeCount} active device{activeCount !== 1 ? 's' : ''} across all schools</p>
                </div>
                <button className="btn-secondary btn-sm" onClick={load}><RefreshCw size={14} /></button>
            </div>

            <div className="toolbar">
                <select value={schoolFilter} onChange={e => setSchoolFilter(e.target.value)}>
                    <option value="">All Schools</option>
                    {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
            </div>

            {loading ? (
                <div className="loading-state"><RefreshCw size={22} className="spin" /><span>Loading…</span></div>
            ) : devices.length === 0 ? (
                <div className="empty-state"><Monitor size={40} strokeWidth={1.2} /><p>No devices activated yet.</p></div>
            ) : (
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Device ID</th>
                                <th>School</th>
                                <th>Last Seen</th>
                                <th>Activated</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {devices.map(d => (
                                <tr key={d.id}>
                                    <td><code className="license-code" style={{ fontSize: '0.7rem' }}>{d.device_id.slice(0, 20)}…</code></td>
                                    <td>{d.schools?.name || '—'}</td>
                                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                        {new Date(d.last_seen).toLocaleString()}
                                    </td>
                                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                        {new Date(d.created_at).toLocaleDateString()}
                                    </td>
                                    <td>
                                        <button className={`toggle-btn ${d.is_active ? 'active' : 'inactive'}`} onClick={() => toggleDevice(d)}>
                                            {d.is_active ? 'Active' : 'Revoked'}
                                        </button>
                                    </td>
                                    <td className="actions">
                                        <button
                                            className={`btn-icon ${d.is_active ? 'danger' : ''}`}
                                            onClick={() => toggleDevice(d)}
                                            title={d.is_active ? 'Revoke device' : 'Re-activate device'}
                                        >
                                            {d.is_active ? <ShieldOff size={14} /> : <ShieldCheck size={14} />}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
