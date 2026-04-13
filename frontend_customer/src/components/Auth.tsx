import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stethoscope } from 'lucide-react';

export default function Auth() {
    const [isLogin, setIsLogin] = useState(true);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
        const payload = isLogin 
            ? { phone, password } 
            : { name, phone, address, password };

        try {
            const res = await fetch(`http://localhost:4000${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            
            if (!res.ok) {
                setError(data.error || 'Authentication failed');
                return;
            }

            localStorage.setItem('user', JSON.stringify(data));
            
            if (data.role === 'admin') {
                navigate('/admin');
            } else {
                navigate('/');
            }
        } catch (err) {
            setError('Connection error. Please try again.');
        }
    };

    return (
        <div className="min-h-[calc(100vh-40px)] flex items-center justify-center bg-slate-50 p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg border w-full max-w-md">
                <h1 className="text-3xl font-bold text-center text-blue-900 mb-6 flex flex-col items-center gap-2">
                    <div className="p-3 bg-emerald-50 rounded-full">
                        <Stethoscope className="w-10 h-10 text-emerald-600" />
                    </div>
                    Pharmacy Portal
                </h1>

                <h2 className="text-xl font-semibold text-slate-700 mb-4 text-center">
                    {isLogin ? 'Welcome Back' : 'Create an Account'}
                </h2>

                {error && (
                    <div className="mb-4 p-3 bg-red-100 text-red-800 border border-red-200 rounded text-sm font-medium">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    {!isLogin && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                            <input
                                type="text"
                                required
                                pattern="^[A-Za-z\s]+$"
                                title="Name can only contain alphabetic characters and spaces"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                placeholder="Jane Doe"
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number / Username</label>
                        <input
                            type="text"
                            required
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                            className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            placeholder="0771234567 or Admin"
                        />
                    </div>

                    {!isLogin && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Delivery Address</label>
                            <textarea
                                required
                                value={address}
                                onChange={e => setAddress(e.target.value)}
                                className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                placeholder="123 Main St, Colombo"
                                rows={2}
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                        <input
                            type="password"
                            required
                            minLength={6}
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-sm transition-colors text-lg"
                    >
                        {isLogin ? 'Login' : 'Register'}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm text-slate-500 border-t pt-4">
                    {isLogin ? "Don't have an account? " : "Already have an account? "}
                    <button
                        onClick={() => { setIsLogin(!isLogin); setError(''); }}
                        className="text-blue-600 font-bold hover:underline py-1"
                    >
                        {isLogin ? 'Sign up here' : 'Login here'}
                    </button>
                </div>
            </div>
        </div>
    );
}
