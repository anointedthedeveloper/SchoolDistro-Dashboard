import { useState, useEffect } from 'react';
import { Monitor, RefreshCw, ShieldOff, ShieldCheck, Cpu, HardDrive, MemoryStick } from 'lucide-react';
import { supabase } from '../supabase';

export default function Devices() {
    const [devices, setDevices]         = useState([]);
    const [schools, setSchools]         = useState([]);
    const [loading, setLoading]         = useState(true);
    const [schoolFilter, setSchoolFilter] = useState('');
    const [expanded, setExpanded]       = useState(null);

    useEffect(() => {
        supabase.from('schools').select('id, name').order('name').then(({ data }) => setSchools(data || []));
    }, []);

    useEffect(() => { load(); }, [schoolFilter]);

    async function load() {
        setLoading(true);
        let q = supabase.from('activations')
            .select('*, schools(name)')
            .order('last_seen', { ascending: false });
        if (schoolFilter) q = q.eq('school_id', schoolFilter);
        const { data } = await q;
        setDevices(data || []);
        setLoading(false);
    }

    async function toggleDevice(device) {
        await supabase.from('activations').update({ is_active: !device.is_active }).eq('id', device.id);
        load();
    }

    const activeCount = devices.filter(d => d.is_active).length;

    function DeviceSpecs({ d }) {
        return (
            <div className="device-specs">
                <div className="spec-row">
                    <Monitor size={12} />
                    <span><strong>OS:</strong> {d.os_name || '—'} {d.os_version || ''}</span>
                </div>
                <div className="spec-row">
                    <Cpu size={12} />
                    <span><strong>CPU:</strong> {d.cpu_model || '—'} ({d.arch || '—'})</span>
                </div>
                <div className="spec-row">
                    <MemoryStick size={12} />
                    <span><strong>RAM:</strong> {d.ram_gb != null ? `${d.ram_gb} GB` : '—'}</span>
                </div>
                <div className="spec-row">
                    <HardDrive size={12} />
                    <span><strong>Disk:</strong> {d.disk_gb != null ? `${d.disk_gb} GB` : '—'}</span>
                </div>
                <div className="spec-row">
                    <Monitor size={12} />
                    <span><strong>Hostname:</strong> {d.hostname || d.device_name || '—'}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="page-wrap">
            <div className="page-header">
                <div>
                    <h2>Devices</h2>
                    <p className="sub">{activeCount} active device{activeCount !== 1 ? 's' : ''}</p>
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
                                <th>Hostname</th>
                                <th>School</th>
                                <th>OS</th>
                                <th>CPU</th>
                                <th>RAM</th>
                                <th>Disk</th>
                                <th>Last Seen</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {devices.map(d => (
                                <>
                                    <tr key={d.id} style={{ cursor: 'pointer' }} onClick={() => setExpanded(expanded === d.id ? null : d.id)}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                                <Monitor size={14} color="var(--accent)" />
                                                <strong>{d.hostname || d.device_name || <span style={{ color: 'var(--text-secondary)' }}>Unknown</span>}</strong>
                                            </div>
                                            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: 2, fontFamily: 'monospace' }}>
                                                {d.device_id.slice(0, 16)}…
                                            </div>
                                        </td>
                                        <td>{d.schools?.name || '—'}</td>
                                        <td style={{ fontSize: '0.8rem' }}>{d.os_name || '—'} <span style={{ color: 'var(--text-secondary)' }}>{d.os_version || ''}</span></td>
                                        <td style={{ fontSize: '0.78rem', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.cpu_model}>
                                            {d.cpu_model ? d.cpu_model.replace(/\(R\)|\(TM\)/g, '') : '—'}
                                        </td>
                                        <td style={{ fontSize: '0.8rem' }}>{d.ram_gb != null ? `${d.ram_gb} GB` : '—'}</td>
                                        <td style={{ fontSize: '0.8rem' }}>{d.disk_gb != null ? `${d.disk_gb} GB` : '—'}</td>
                                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                                            {new Date(d.last_seen).toLocaleString()}
                                        </td>
                                        <td>
                                            <button className={`toggle-btn ${d.is_active ? 'active' : 'inactive'}`} onClick={e => { e.stopPropagation(); toggleDevice(d); }}>
                                                {d.is_active ? 'Active' : 'Revoked'}
                                            </button>
                                        </td>
                                        <td className="actions" onClick={e => e.stopPropagation()}>
                                            <button className={`btn-icon ${d.is_active ? 'danger' : ''}`} onClick={() => toggleDevice(d)} title={d.is_active ? 'Revoke' : 'Re-activate'}>
                                                {d.is_active ? <ShieldOff size={14} /> : <ShieldCheck size={14} />}
                                            </button>
                                        </td>
                                    </tr>
                                    {expanded === d.id && (
                                        <tr key={d.id + '-specs'}>
                                            <td colSpan={9} style={{ background: 'rgba(45,111,181,0.05)', padding: '12px 16px' }}>
                                                <DeviceSpecs d={d} />
                                            </td>
                                        </tr>
                                    )}
                                </>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
