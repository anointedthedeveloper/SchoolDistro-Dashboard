import { useState, useEffect } from 'react';
import { School, CheckCircle, XCircle, Receipt, Banknote, TrendingUp, AlertTriangle, Clock, Monitor } from 'lucide-react';
import { supabase } from '../supabase';
import { getSubscriptionState, autoExpireSchools } from '../utils/subscription';

export default function Overview() {
    const [stats, setStats]     = useState({ schools: 0, active: 0, expired: 0, receipts: 0, revenue: 0, newThisMonth: 0 });
    const [recent, setRecent]   = useState([]);
    const [alerts, setAlerts]   = useState({ expiring: [], expired: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            const thisMonth = new Date(); thisMonth.setDate(1); thisMonth.setHours(0,0,0,0);
            const today = new Date();
            const in30 = new Date(); in30.setDate(today.getDate() + 30);

            // Auto-expire before loading
            await autoExpireSchools(supabase);

            const [{ data: schools }, { count: receipts }, { data: recentReceipts }, { data: allPayments }, { count: activeActivations }] = await Promise.all([
                supabase.from('schools').select('id, name, subscription_status, expires_at, is_active, created_at'),
                supabase.from('receipts').select('*', { count: 'exact', head: true }),
                supabase.from('receipts').select('serial_number, parent_name, amount, bank, synced_at, school_id')
                    .order('synced_at', { ascending: false }).limit(6),
                supabase.from('payments').select('amount').eq('status', 'paid'),
                supabase.from('activations').select('*', { count: 'exact', head: true }).eq('is_active', true),
            ]);

            const s = schools || [];
            const revenue = (allPayments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);

            setStats({
                schools:      s.length,
                active:       s.filter(x => x.subscription_status === 'active').length,
                expired:      s.filter(x => x.subscription_status === 'expired').length,
                receipts:     receipts || 0,
                revenue,
                newThisMonth: s.filter(x => new Date(x.created_at) >= thisMonth).length,
                activeActivations: activeActivations || 0,
            });

            setAlerts({
                expiring: s.filter(x => {
                    if (!x.expires_at) return false;
                    const exp = new Date(x.expires_at);
                    return exp > today && exp <= in30 && x.subscription_status !== 'expired';
                }),
                expired: s.filter(x => {
                    const state = getSubscriptionState(x);
                    return state.status === 'expired';
                }),
            });

            setRecent(recentReceipts || []);
            setLoading(false);
        }
        load();
    }, []);

    const cards = [
        { label: 'Total Schools',  value: stats.schools,                        Icon: School,      color: '#2d6fb5' },
        { label: 'Active',         value: stats.active,                         Icon: CheckCircle, color: '#11b37f' },
        { label: 'Active Device Activations', value: stats.activeActivations,   Icon: Monitor,     color: '#10b981' },
        { label: 'Expired',        value: stats.expired,                        Icon: XCircle,     color: '#ef4444' },
        { label: 'Total Revenue',  value: `₦${stats.revenue.toLocaleString()}`, Icon: Banknote,    color: '#06b6d4' },
        { label: 'New This Month', value: `+${stats.newThisMonth}`,             Icon: TrendingUp,  color: '#f59e0b' },
        { label: 'Receipts',       value: stats.receipts,                       Icon: Receipt,     color: '#8b5cf6' },
    ];

    const totalAlerts = alerts.expiring.length + alerts.expired.length;

    return (
        <div className="page-wrap">
            <div className="page-header">
                <div>
                    <h2>Overview</h2>
                    <p className="sub">Platform-wide stats</p>
                </div>
                {totalAlerts > 0 && (
                    <span className="badge" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', padding: '5px 12px', fontSize: '0.8rem' }}>
                        {totalAlerts} notification{totalAlerts !== 1 ? 's' : ''}
                    </span>
                )}
            </div>

            {loading ? <div className="loading-state">Loading…</div> : (
                <>
                    <div className="stats-grid">
                        {cards.map(({ label, value, Icon, color }) => (
                            <div className="stat-card" key={label} style={{ borderTopColor: color }}>
                                <Icon size={20} color={color} style={{ marginBottom: 8 }} />
                                <div className="stat-value">{value}</div>
                                <div className="stat-label">{label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Notifications */}
                    {totalAlerts > 0 && (
                        <>
                            <div className="section-title" style={{ marginBottom: 10 }}>Notifications</div>
                            <div className="notif-list" style={{ marginBottom: 28 }}>
                                {alerts.expiring.map(s => {
                                    const state = getSubscriptionState(s);
                                    return (
                                        <div className="notif-item warn" key={s.id}>
                                            <Clock size={15} color="#f59e0b" style={{ flexShrink: 0 }} />
                                            <span><strong>{s.name}</strong> — {state.label}</span>
                                        </div>
                                    );
                                })}
                                {alerts.expired.map(s => {
                                    const state = getSubscriptionState(s);
                                    return (
                                        <div className="notif-item danger" key={s.id}>
                                            <AlertTriangle size={15} color="#ef4444" style={{ flexShrink: 0 }} />
                                            <span><strong>{s.name}</strong> — {state.label}</span>
                                            <span className="badge" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', marginLeft: 'auto', flexShrink: 0 }}>
                                                {s.is_active ? 'still active' : 'disabled'}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}

                    {/* Recent Receipts */}
                    <div className="section-title" style={{ marginBottom: 10 }}>Recent Receipts</div>
                    {recent.length === 0 ? (
                        <div className="empty-state">
                            <Receipt size={36} strokeWidth={1.2} />
                            <p>No receipts synced yet.</p>
                        </div>
                    ) : (
                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr><th>Serial</th><th>Parent</th><th>Amount</th><th>Bank</th><th>Synced</th></tr>
                                </thead>
                                <tbody>
                                    {recent.map(r => (
                                        <tr key={r.serial_number + r.school_id}>
                                            <td><code className="license-code">{r.serial_number}</code></td>
                                            <td>{r.parent_name}</td>
                                            <td style={{ fontWeight: 700 }}>₦{Number(r.amount).toLocaleString()}</td>
                                            <td>{r.bank}</td>
                                            <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                                {new Date(r.synced_at).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
