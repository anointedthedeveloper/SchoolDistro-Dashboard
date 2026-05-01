import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp, Banknote, CheckCircle, Clock } from 'lucide-react';
import { supabase } from '../supabase';

export default function Revenue() {
    const [total, setTotal]       = useState(0);
    const [paid, setPaid]         = useState(0);
    const [unpaid, setUnpaid]     = useState(0);
    const [bySchool, setBySchool] = useState([]);
    const [monthly, setMonthly]   = useState([]);
    const [payments, setPayments]   = useState([]);
    const [schoolMap, setSchoolMap] = useState({});
    const [loading, setLoading]     = useState(true);

    useEffect(() => {
        async function load() {
            const [{ data: pays }, { data: schools }] = await Promise.all([
                supabase.from('payments').select('*, plans(label, name)').order('paid_at', { ascending: false }),
                supabase.from('schools').select('id, name'),
            ]);

            const all = pays || [];
            const schoolMap = Object.fromEntries((schools || []).map(s => [s.id, s.name]));
            setSchoolMap(schoolMap);

            const totalRev  = all.reduce((s, p) => s + Number(p.amount || 0), 0);
            const paidRev   = all.filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.amount || 0), 0);
            const unpaidRev = all.filter(p => p.status === 'unpaid').reduce((s, p) => s + Number(p.amount || 0), 0);

            setTotal(totalRev);
            setPaid(paidRev);
            setUnpaid(unpaidRev);
            setPayments(all.slice(0, 20));

            // Per school
            const schoolRevMap = {};
            all.filter(p => p.status === 'paid').forEach(p => {
                schoolRevMap[p.school_id] = (schoolRevMap[p.school_id] || 0) + Number(p.amount || 0);
            });
            setBySchool(
                Object.entries(schoolRevMap)
                    .map(([id, revenue]) => ({ name: schoolMap[id] || 'Unknown', revenue }))
                    .sort((a, b) => b.revenue - a.revenue)
            );

            // Monthly (last 6 months) — paid only
            const monthMap = {};
            all.filter(p => p.status === 'paid' && p.paid_at).forEach(p => {
                const key = p.paid_at.slice(0, 7);
                monthMap[key] = (monthMap[key] || 0) + Number(p.amount || 0);
            });
            const sorted = Object.entries(monthMap).sort(([a], [b]) => a.localeCompare(b)).slice(-6);
            setMonthly(sorted.map(([month, revenue]) => ({
                month: new Date(month + '-01').toLocaleString('default', { month: 'short', year: '2-digit' }),
                revenue,
            })));

            setLoading(false);
        }
        load();
    }, []);

    const CustomTooltip = ({ active, payload }) => {
        if (!active || !payload?.length) return null;
        return (
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-strong)', borderRadius: 8, padding: '8px 14px', fontSize: '0.82rem' }}>
                <div style={{ color: 'var(--text-secondary)' }}>{payload[0].payload.month}</div>
                <div style={{ fontWeight: 700, color: '#11b37f' }}>₦{Number(payload[0].value).toLocaleString()}</div>
            </div>
        );
    };

    const statusColor = { paid: '#11b37f', unpaid: '#ef4444', refunded: '#f59e0b' };

    return (
        <div className="page-wrap">
            <div className="page-header">
                <div>
                    <h2>Revenue</h2>
                    <p className="sub">What you've earned from schools</p>
                </div>
            </div>

            {loading ? <div className="loading-state">Loading…</div> : (
                <>
                    <div className="stats-grid" style={{ marginBottom: 28 }}>
                        {[
                            { label: 'Total Billed',  value: `₦${total.toLocaleString()}`,  Icon: Banknote,    color: '#06b6d4' },
                            { label: 'Paid',          value: `₦${paid.toLocaleString()}`,   Icon: CheckCircle, color: '#11b37f' },
                            { label: 'Unpaid / Owed', value: `₦${unpaid.toLocaleString()}`, Icon: Clock,       color: '#ef4444' },
                        ].map(({ label, value, Icon, color }) => (
                            <div className="stat-card" key={label} style={{ borderTopColor: color }}>
                                <Icon size={20} color={color} style={{ marginBottom: 8 }} />
                                <div className="stat-value">{value}</div>
                                <div className="stat-label">{label}</div>
                            </div>
                        ))}
                    </div>

                    <div className="section-title">Monthly Revenue Growth</div>
                    {monthly.length === 0 ? (
                        <div className="empty-state" style={{ padding: '32px 0' }}>
                            <TrendingUp size={36} strokeWidth={1.2} />
                            <p>No payments recorded yet. Payments are logged when you activate a school on a paid plan.</p>
                        </div>
                    ) : (
                        <div className="chart-wrap" style={{ marginBottom: 28 }}>
                            <ResponsiveContainer width="100%" height={220}>
                                <AreaChart data={monthly} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%"  stopColor="#11b37f" stopOpacity={0.25} />
                                            <stop offset="95%" stopColor="#11b37f" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                                    <XAxis dataKey="month" tick={{ fill: '#8fa8c8', fontSize: 11 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fill: '#8fa8c8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₦${(v/1000).toFixed(0)}k`} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Area type="monotone" dataKey="revenue" stroke="#11b37f" strokeWidth={2} fill="url(#revGrad)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    <div className="section-title">Earnings Per School</div>
                    {bySchool.length === 0 ? (
                        <div className="empty-state" style={{ padding: '24px 0' }}><p>No paid payments yet.</p></div>
                    ) : (
                        <div className="table-wrap" style={{ marginBottom: 28 }}>
                            <table>
                                <thead><tr><th>#</th><th>School</th><th>Paid</th><th>Share</th></tr></thead>
                                <tbody>
                                    {bySchool.map((s, i) => (
                                        <tr key={s.name}>
                                            <td style={{ color: 'var(--text-secondary)' }}>{i + 1}</td>
                                            <td><strong>{s.name}</strong></td>
                                            <td style={{ fontWeight: 700, color: 'var(--accent-green)' }}>₦{s.revenue.toLocaleString()}</td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                                                        <div style={{ width: `${paid ? (s.revenue / paid * 100) : 0}%`, height: '100%', background: '#11b37f', borderRadius: 4 }} />
                                                    </div>
                                                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', minWidth: 36 }}>
                                                        {paid ? (s.revenue / paid * 100).toFixed(1) : 0}%
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="section-title">Payment History</div>
                    {payments.length === 0 ? (
                        <div className="empty-state" style={{ padding: '24px 0' }}><p>No payments yet.</p></div>
                    ) : (
                        <div className="table-wrap">
                            <table>
                                <thead><tr><th>School</th><th>Plan</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
                                <tbody>
                                    {payments.map(p => (
                                        <tr key={p.id}>
                                            <td><strong>{schoolMap[p.school_id] || p.school_id}</strong></td>
                                            <td>{p.plans?.label || '—'}</td>
                                            <td style={{ fontWeight: 700 }}>₦{Number(p.amount).toLocaleString()}</td>
                                            <td>
                                                <span className="badge" style={{ background: (statusColor[p.status] || '#8fa8c8') + '22', color: statusColor[p.status] || '#8fa8c8' }}>
                                                    {p.status}
                                                </span>
                                            </td>
                                            <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                                {p.paid_at ? new Date(p.paid_at).toLocaleDateString() : '—'}
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
