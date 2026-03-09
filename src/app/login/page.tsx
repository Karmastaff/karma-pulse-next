'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Login failed. Please try again.');
                return;
            }

            router.push('/vault');
            router.refresh();
        } catch {
            setError('Unable to connect. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center p-4">

            {/* Background decorative circles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl" />
            </div>

            <div className="relative w-full max-w-md">

                {/* Card */}
                <div className="bg-white rounded-3xl shadow-2xl shadow-slate-200/80 border border-slate-100 p-8 animate-in fade-in zoom-in duration-500">

                    {/* Logo + Brand */}
                    <div className="flex flex-col items-center mb-8">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-1.5 rounded-xl bg-slate-50 border border-slate-100 shadow-sm">
                                <Image src="/logo.png" alt="KarmaPulse" width={36} height={36} className="object-contain" />
                            </div>
                            <span className="text-2xl font-bold tracking-tight text-slate-800">
                                Karma<span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-indigo-500">Pulse</span>
                            </span>
                        </div>
                        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-1">Welcome back</h1>
                        <p className="text-sm text-slate-400">Sign in to access The Playbook</p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1.5">
                                Email address
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                placeholder="you@company.com"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary focus:bg-white transition-all"
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-1.5">
                                Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                placeholder="••••••••"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary focus:bg-white transition-all"
                            />
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-600 font-medium">
                                <span className="shrink-0">⚠</span>
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm tracking-wide hover:bg-primary/90 active:scale-[0.98] transition-all shadow-lg shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Signing in...
                                </>
                            ) : (
                                'Sign In'
                            )}
                        </button>
                    </form>

                    {/* Footer */}
                    <p className="text-center text-[11px] text-slate-300 mt-6 leading-relaxed">
                        KarmaPulse is AI-powered and may make mistakes.<br />Always double-check critical information.
                    </p>
                </div>
            </div>
        </div>
    );
}
