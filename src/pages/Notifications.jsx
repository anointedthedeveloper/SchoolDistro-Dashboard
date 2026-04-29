import { useState, useEffect } from 'react';
import { Bell, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { supabase } from '../supabase';

export default function Notifications() {
    const [expiring, setExpiring] = useState([]);
    const [expired, setExpired] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            const today = new Date();
            const in30 = new Date(today); in30.setDate(today.getDate() + 30);

            const { data } = await supabase
                .from('schools')
                .select('id, name, subscription_status, expires_at, is_active')
                .order('expires_at', { ascending: true });

            const all = data || [];
            setExpiring(all.filter(s => {
                if (!s.expires_at) return false;
                const exp = new Date(s.expires_at);
                return exp > today && exp <= in30;
            }));
            setExpired(all.filter(s => s.subscription_status === 'expired' || (s.expires_at && new Date(s.expires_at) < today)));
            setLoading(false);
        }
        load();
    }, []);

    const total = expiring.length + expired.length;

    return (
        <div className="page-wrap">
            <div className="page-header">
                <div>
                    <h2>Notifications</h2>
                    <p className="sub">{total} alert{total !== 1 ? 's' : ''} require attention</p>
                </div>
            </div>

            {loading ? <div className="loading-state">Loading…</div> : (
                <>
                    {total === 0 && (
                        <div className="empty-state">
                            <CheckCircle size={40} strokeWidth={1.2} color="#11b37f" />
                            <p>All clear — no alerts right now.</p>
                        </div>
                    )}

                    {expiring.length > 0 && (
                        <>
                            <div className="section-title" style={{ marginBottom: 12 }}>
                                <Clock size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                                Expiring Within 30 Days ({expiring.length})
                            </div>
                            <div className="notif-list" style={{ marginBottom: 28 }}>
                                {expiring.map(s => (
                                    <div className="notif-item warn" key={s.id}>
                                        <AlertTriangle size={16} color="#f59e0b" style={{ flexShrink: 0 }} />
                                        <div>
                                            <strong>{s.name}</strong>
                                            <span style={{ color: 'var(--text-secondary)', marginLeft: 8, fontSize: '0.8rem' }}>
                                                expires {new Date(s.expires_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {expired.length > 0 && (
                        <>
                            <div className="section-title" style={{ marginBottom: 12 }}>
                                <Bell size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                                Expired / Unpaid Schools ({expired.length})
                            </div>
                            <div className="notif-list">
                                {expired.map(s => (
                                    <div className="notif-item danger" key={s.id}>
                                        <AlertTriangle size={16} color="#ef4444" style={{ flexShrink: 0 }} />
                                        <div>
                                            <strong>{s.name}</strong>
                                            <span style={{ color: 'var(--text-secondary)', marginLeft: 8, fontSize: '0.8rem' }}>
                                                {s.expires_at ? `expired ${new Date(s.expires_at).toLocaleDateString()}` : 'no expiry set'}
                                            </span>
                                        </div>
                                        <span className="badge" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', marginLeft: 'auto' }}>
                                            {s.is_active ? 'still active' : 'disabled'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
}
