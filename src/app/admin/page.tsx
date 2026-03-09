'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Plus, Trash2, Shield, ShieldCheck, X, Eye, EyeOff, Building2, Mail, User, Lock } from 'lucide-react';

interface UserRecord {
    id: string;
    name: string;
    email: string;
    company: string;
    role: 'superadmin' | 'admin';
    createdAt: string;
}

function RoleBadge({ role }: { role: string }) {
    return role === 'superadmin' ? (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-200">
            <ShieldCheck className="w-3 h-3" /> Super Admin
        </span>
    ) : (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
            <Shield className="w-3 h-3" /> Admin
        </span>
    );
}

export default function AdminPage() {
    const router = useRouter();
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [formError, setFormError] = useState('');
    const [formSuccess, setFormSuccess] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const [form, setForm] = useState({
        name: '', email: '', company: '', password: '', role: 'admin' as 'superadmin' | 'admin'
    });

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/users');
            if (res.status === 403) { router.push('/vault'); return; }
            const data = await res.json();
            setUsers(data.users || []);
        } catch {
            console.error('Failed to load users');
        } finally {
            setLoading(false);
        }
    }, [router]);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');
        setFormSuccess('');
        setSubmitting(true);
        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (!res.ok) { setFormError(data.error); return; }
            setFormSuccess(`User "${form.name}" created successfully.`);
            setForm({ name: '', email: '', company: '', password: '', role: 'admin' });
            setShowForm(false);
            fetchUsers();
        } catch {
            setFormError('Server error. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Remove "${name}"? This cannot be undone.`)) return;
        setDeletingId(id);
        try {
            await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
            fetchUsers();
        } finally {
            setDeletingId(null);
        }
    };

    const superadmins = users.filter(u => u.role === 'superadmin').length;
    const admins = users.filter(u => u.role === 'admin').length;

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in zoom-in duration-500">

            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-foreground">User Management</h1>
                    <p className="text-muted-foreground text-sm mt-1">Manage platform access and user roles.</p>
                </div>
                <button
                    onClick={() => { setShowForm(true); setFormError(''); setFormSuccess(''); }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all active:scale-[0.97]"
                >
                    <Plus className="w-4 h-4" />
                    Add User
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Total Users', value: users.length, icon: Users, color: 'text-primary bg-primary/10' },
                    { label: 'Super Admins', value: superadmins, icon: ShieldCheck, color: 'text-indigo-600 bg-indigo-50' },
                    { label: 'Admins', value: admins, icon: Shield, color: 'text-slate-500 bg-slate-100' },
                ].map(stat => (
                    <div key={stat.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${stat.color}`}>
                            <stat.icon className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-foreground">{stat.value}</p>
                            <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Success banner */}
            {formSuccess && (
                <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 font-medium">
                    <span>✓ {formSuccess}</span>
                    <button onClick={() => setFormSuccess('')}><X className="w-4 h-4" /></button>
                </div>
            )}

            {/* Add User Form Modal Overlay */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-md mx-4 animate-in zoom-in duration-200">
                        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                            <div>
                                <h2 className="text-lg font-extrabold text-slate-900">Add New User</h2>
                                <p className="text-xs text-slate-400 mt-0.5">Create platform access credentials</p>
                            </div>
                            <button onClick={() => setShowForm(false)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreate} className="p-6 space-y-4">
                            {[
                                { id: 'name', label: 'Full Name', type: 'text', placeholder: 'Jane Smith', icon: User, value: form.name, onChange: (v: string) => setForm(f => ({ ...f, name: v })) },
                                { id: 'company', label: 'Company', type: 'text', placeholder: 'Acme Restoration', icon: Building2, value: form.company, onChange: (v: string) => setForm(f => ({ ...f, company: v })) },
                                { id: 'email', label: 'Email Address', type: 'email', placeholder: 'jane@company.com', icon: Mail, value: form.email, onChange: (v: string) => setForm(f => ({ ...f, email: v })) },
                            ].map(field => (
                                <div key={field.id}>
                                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">{field.label}</label>
                                    <div className="relative">
                                        <field.icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type={field.type}
                                            required
                                            value={field.value}
                                            onChange={e => field.onChange(e.target.value)}
                                            placeholder={field.placeholder}
                                            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary focus:bg-white transition-all"
                                        />
                                    </div>
                                </div>
                            ))}

                            {/* Password */}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        minLength={8}
                                        value={form.password}
                                        onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                        placeholder="Min. 8 characters"
                                        className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary focus:bg-white transition-all"
                                    />
                                    <button type="button" onClick={() => setShowPassword(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            {/* Role */}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Role</label>
                                <select
                                    value={form.role}
                                    onChange={e => setForm(f => ({ ...f, role: e.target.value as 'superadmin' | 'admin' }))}
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary focus:bg-white transition-all"
                                >
                                    <option value="admin">Admin</option>
                                    <option value="superadmin">Super Admin</option>
                                </select>
                            </div>

                            {formError && (
                                <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 font-medium">⚠ {formError}</p>
                            )}

                            <div className="flex gap-3 pt-1">
                                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" disabled={submitting} className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-60 flex items-center justify-center gap-2">
                                    {submitting ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating...</> : 'Create User'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Users Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="font-bold text-slate-900">All Users</h2>
                    <span className="text-xs text-slate-400">{users.length} total</span>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16 text-slate-400 text-sm gap-2">
                        <div className="w-5 h-5 border-2 border-slate-200 border-t-primary rounded-full animate-spin" />
                        Loading users...
                    </div>
                ) : users.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
                        <Users className="w-8 h-8 text-slate-300" />
                        <p className="text-sm font-medium">No users yet</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-50">
                        {users.map(user => (
                            <div key={user.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50/60 transition-colors group">
                                <div className="flex items-center gap-4 min-w-0">
                                    {/* Avatar */}
                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-indigo-500/20 flex items-center justify-center shrink-0 font-bold text-primary text-sm">
                                        {user.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-semibold text-slate-900 text-sm truncate">{user.name}</p>
                                        <p className="text-xs text-slate-400 truncate">{user.email} · {user.company}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 shrink-0 ml-4">
                                    <RoleBadge role={user.role} />
                                    <span className="text-[11px] text-slate-300 hidden sm:block">
                                        {new Date(user.createdAt).toLocaleDateString()}
                                    </span>
                                    <button
                                        onClick={() => handleDelete(user.id, user.name)}
                                        disabled={deletingId === user.id}
                                        className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                                        title="Remove user"
                                    >
                                        {deletingId === user.id
                                            ? <div className="w-4 h-4 border-2 border-rose-300 border-t-rose-500 rounded-full animate-spin" />
                                            : <Trash2 className="w-4 h-4" />
                                        }
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
