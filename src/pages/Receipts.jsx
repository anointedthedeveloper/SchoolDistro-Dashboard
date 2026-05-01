import { useState, useEffect } from 'react';
import { Receipt, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { supabase } from '../supabase';

const PAGE_SIZE = 50;

export default function Receipts() {
    const [receipts, setReceipts] = useState([]);
    const [schools, setSchools]   = useState([]);
    const [loading, setLoading]   = useState(true);
    const [schoolFilter, setSchoolFilter] = useState('');
    const [search, setSearch]     = useState('');
    const [page, setPage]         = useState(0);
    const [collapsed, setCollapsed] = useState({});

    useEffect(() => {
        supabase.from('schools').select('id, name').order('name').then(({ data }) => setSchools(data || []));
    }, []);

    useEffect(() => { load(); }, [schoolFilter, page]);

    async function load() {
        setLoading(true);
        let q = supabase.from('receipts')
            .select('*, schools(name)')
            .order('date', { ascending: false })
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
        if (schoolFilter) q = q.eq('school_id', schoolFilter);
        const { data } = await q;
        setReceipts(data || []);
        setLoading(false);
    }

    const filtered = receipts.filter(r =>
        !search ||
        r.parent_name?.toLowerCase().includes(search.toLowerCase()) ||
        r.serial_number?.toLowerCase().includes(search.toLowerCase())
    );

    // Group by school
    const grouped = filtered.reduce((acc, r) => {
        const key  = r.school_id || 'unknown';
        const name = r.schools?.name || r.school_name || 'Unknown School';
        if (!acc[key]) acc[key] = { name, rows: [] };
        acc[key].rows.push(r);
        return acc;
    }, {});

    const toggleCollapse = (key) => setCollapsed(c => ({ ...c, [key]: !c[key] }));

    return (
        <div className="page-wrap">
            <div className="page-header">
                <div>
                    <h2>Receipts</h2>
                    <p className="sub">All synced receipts grouped by school</p>
                </div>
                <button className="btn-secondary btn-sm" onClick={load}><RefreshCw size={14} /></button>
            </div>

            <div className="toolbar">
                <input className="search-input" placeholder="Search parent or serial…" value={search} onChange={e => setSearch(e.target.value)} />
                <select value={schoolFilter} onChange={e => { setSchoolFilter(e.target.value); setPage(0); }}>
                    <option value="">All Schools</option>
                    {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
            </div>

            {loading ? (
                <div className="loading-state"><RefreshCw size={22} className="spin" /><span>Loading…</span></div>
            ) : filtered.length === 0 ? (
                <div className="empty-state"><Receipt size={40} strokeWidth={1.2} /><p>No receipts found.</p></div>
            ) : (
                <>
                    {Object.entries(grouped).map(([schoolId, { name, rows }]) => {
                        const total    = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
                        const isOpen   = !collapsed[schoolId];
                        return (
                            <div key={schoolId} style={{ marginBottom: 20, border: '1px solid var(--border-color)', borderRadius: 12, overflow: 'hidden' }}>
                                {/* School header row */}
                                <div
                                    onClick={() => toggleCollapse(schoolId)}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-secondary)', cursor: 'pointer', userSelect: 'none' }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                                        <strong style={{ fontSize: '0.95rem' }}>{name}</strong>
                                        <span style={{ fontSize: '0.72rem', background: 'rgba(45,111,181,0.15)', color: '#7ab3e8', borderRadius: 20, padding: '2px 8px', fontWeight: 700 }}>
                                            {rows.length} receipt{rows.length !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                    <span style={{ fontWeight: 800, color: 'var(--accent-green)', fontSize: '0.95rem' }}>
                                        ₦{total.toLocaleString()}
                                    </span>
                                </div>

                                {isOpen && (
                                    <div className="table-wrap" style={{ margin: 0, borderRadius: 0 }}>
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Serial</th><th>Date</th><th>Parent</th><th>Class</th>
                                                    <th>Amount</th><th>Purpose</th><th>Bank</th><th>Issued By</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {rows.map(r => (
                                                    <tr key={r.id}>
                                                        <td><code className="license-code">{r.serial_number}</code></td>
                                                        <td>{r.date}</td>
                                                        <td><strong>{r.parent_name}</strong></td>
                                                        <td>{r.class}</td>
                                                        <td style={{ fontWeight: 700, color: 'var(--accent-green)' }}>₦{Number(r.amount).toLocaleString()}</td>
                                                        <td>{r.purpose}</td>
                                                        <td>{r.bank}</td>
                                                        <td>{r.issued_by || '—'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    <div className="pagination">
                        <button className="btn-secondary btn-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                            <ChevronLeft size={14} /> Prev
                        </button>
                        <span>Page {page + 1}</span>
                        <button className="btn-secondary btn-sm" disabled={receipts.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)}>
                            Next <ChevronRight size={14} />
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
