import { useState } from 'react';
import { School, Mail, Lock, LogIn } from 'lucide-react';
import { supabase } from '../supabase';

export default function Login() {
    const [email, setEmail]       = useState('');
    const [password, setPassword] = useState('');
    const [error, setError]       = useState('');
    const [loading, setLoading]   = useState(false);

    async function handleLogin(e) {
        e.preventDefault();
        setLoading(true);
        setError('');
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setError(error.message);
        setLoading(false);
    }

    return (
        <div className="login-wrap">
            <div className="login-card">
                <div className="login-logo">
                    <School size={40} color="#2d6fb5" />
                    <h1>SchoolDistro</h1>
                    <p>Admin Dashboard</p>
                </div>
                <form onSubmit={handleLogin}>
                    <div className="field">
                        <label>Email</label>
                        <div className="input-icon-wrap">
                            <Mail size={15} className="input-icon" />
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="admin@example.com" />
                        </div>
                    </div>
                    <div className="field">
                        <label>Password</label>
                        <div className="input-icon-wrap">
                            <Lock size={15} className="input-icon" />
                            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
                        </div>
                    </div>
                    {error && <div className="error-msg">{error}</div>}
                    <button className="btn-primary" type="submit" disabled={loading}>
                        <LogIn size={15} />
                        {loading ? 'Signing in…' : 'Sign In'}
                    </button>
                </form>
            </div>
        </div>
    );
}
