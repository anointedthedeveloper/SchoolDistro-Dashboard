import { NavLink } from 'react-router-dom';
import { LayoutDashboard, School, Receipt, LogOut, TrendingUp, Users, Settings, Menu, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

const links = [
    { to: '/',         label: 'Overview', Icon: LayoutDashboard },
    { to: '/schools',  label: 'Schools',  Icon: School },
    { to: '/receipts', label: 'Receipts', Icon: Receipt },
    { to: '/revenue',  label: 'Revenue',  Icon: TrendingUp },
    { to: '/users',    label: 'Users',    Icon: Users },
    { to: '/settings', label: 'Settings', Icon: Settings },
];

export default function Sidebar({ user }) {
    const [open, setOpen] = useState(false);

    // Close sidebar on route change (mobile)
    useEffect(() => {
        const close = () => setOpen(false);
        window.addEventListener('popstate', close);
        return () => window.removeEventListener('popstate', close);
    }, []);

    return (
        <>
            {/* Mobile top bar */}
            <div className="mobile-topbar">
                <button className="hamburger" onClick={() => setOpen(o => !o)}>
                    {open ? <X size={20} /> : <Menu size={20} />}
                </button>
                <span className="mobile-brand">SchoolDistro</span>
            </div>

            {/* Overlay */}
            {open && <div className="sidebar-overlay" onClick={() => setOpen(false)} />}

            <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
                <div className="sidebar-brand">
                    <div className="brand-icon">SD</div>
                    <div>
                        <strong>SchoolDistro</strong>
                        <small>Admin Portal</small>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    {links.map(({ to, label, Icon }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={to === '/'}
                            className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
                            onClick={() => setOpen(false)}
                        >
                            <Icon size={16} />
                            {label}
                        </NavLink>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="user-info">
                        <div className="user-avatar">{user?.email?.[0]?.toUpperCase()}</div>
                        <div className="user-email">{user?.email}</div>
                    </div>
                    <button className="btn-signout" onClick={() => supabase.auth.signOut()} title="Sign out">
                        <LogOut size={15} />
                    </button>
                </div>
            </aside>
        </>
    );
}
