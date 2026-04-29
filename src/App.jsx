import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Overview from './pages/Overview';
import Schools from './pages/Schools';
import SchoolDetail from './pages/SchoolDetail';
import Receipts from './pages/Receipts';
import Revenue from './pages/Revenue';
import UsersPage from './pages/Users';
import Devices from './pages/Devices';
import Settings from './pages/Settings';

function Layout({ user }) {
    return (
        <div className="app-layout">
            <Sidebar user={user} />
            <main className="main-content">
                <Routes>
                    <Route path="/"             element={<Overview />} />
                    <Route path="/schools"      element={<Schools />} />
                    <Route path="/schools/:id"  element={<SchoolDetail />} />
                    <Route path="/receipts"     element={<Receipts />} />
                    <Route path="/revenue"      element={<Revenue />} />
                    <Route path="/users"        element={<UsersPage />} />
                    <Route path="/devices"      element={<Devices />} />
                    <Route path="/settings"     element={<Settings />} />
                    <Route path="*"             element={<Navigate to="/" replace />} />
                </Routes>
            </main>
        </div>
    );
}

export default function App() {
    const { user, loading } = useAuth();

    if (loading) return <div className="splash">Loading…</div>;
    if (!user)   return <BrowserRouter><Login /></BrowserRouter>;

    return (
        <BrowserRouter>
            <Layout user={user} />
        </BrowserRouter>
    );
}
