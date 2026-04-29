import { useState, useEffect } from 'react';
import { Receipt, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../supabase';

const PAGE_SIZE = 20;

export default function Receipts() {
    const [receipts, setReceipts] = useState([]);
    const [schools, setSchools]   = useState([]);
    const [loading, setLoading]   = useState(true);
    const [school, setSchool]     = useState('');
    const [search, setSearch]     = useState('');
    const [page, setPage]         = useState(0);

    useEffect(() => {
        supabase.from('schools').select('id, name').order('name').then(({ data }) => setSchools(data || []));
    }, []);

    useEffect(() => { load(); }, [school, page]);

    async function load() {
        setLoading(true);
        let q = supabase.from('receipts').select('*')
            .order('synced_at', { ascending: false })
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
        if (school) q = q.eq('school_id', school);
        const { data } = await q;
        setReceipts(data || []);
        setLoading(false);
    }

    const filtered = receipts.filter(r =>
        !search ||
        r.parent_name?.toLowerCase().includes(search.toLowerCase()) ||
        r.serial_number?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="page-wrap">
            <div className="page-header">
                <div>
                    <h2>Receipts</h2>
                    <p className="sub">All synced receipts across schools</p>
                </div>
            </div>

            <div className="toolbar">
                <input className="search-input" placeholder="Search parent or serial…" value={search} onChange={e => setSearch(e.target.value)} />
                <select value={school} onChange={e => { setSchool(e.target.value); setPage(0); }}>
                    <option value="">All Schools</option>
                    {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
            </div>

            {loading ? (
                <div className="loading-state">Loading…</div>
            ) : filtered.length === 0 ? (
                <div className="empty-state">
                    <Receipt size={40} strokeWidth={1.2} />
                    <p>No receipts found.</p>
                </div>
            ) : (
                <>
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Serial</th><th>Date</th><th>Parent</th><th>Class</th>
                                    <th>Amount</th><th>Purpose</th><th>Bank</th><th>Issued By</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(r => (
                                    <tr key={r.id}>
                                        <td><code className="license-code">{r.serial_number}</code></td>
                                        <td>{r.date}</td>
                                        <td><strong>{r.parent_name}</strong></td>
                                        <td>{r.class}</td>
                                        <td style={{ fontWeight: 700, color: 'var(--accent)' }}>₦{Number(r.amount).toLocaleString()}</td>
                                        <td>{r.purpose}</td>
                                        <td>{r.bank}</td>
                                        <td>{r.issued_by || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
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
