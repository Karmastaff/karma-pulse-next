"use client";

import { FileText, Bot, Users, LogOut, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useVault } from '@/contexts/VaultContext';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

interface CurrentUser {
    id: string;
    name: string;
    email: string;
    company: string;
    role: 'superadmin' | 'admin';
}

export function Sidebar() {
    const { isChatbotOpen } = useVault();
    const pathname = usePathname();
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

    const isCollapsed = isChatbotOpen && !pathname.startsWith('/admin');

    useEffect(() => {
        fetch('/api/auth/me')
            .then(r => r.ok ? r.json() : null)
            .then(data => { if (data?.user) setCurrentUser(data.user); })
            .catch(() => {});
    }, []);

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
        router.refresh();
    };

    return (
        <nav className={`bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0 self-start shadow-sm z-10 transition-all duration-500 ease-in-out ${isCollapsed ? 'w-24 p-4' : 'w-64 p-6'}`}>

            {/* Logo */}
            <div className={`flex items-center mb-10 overflow-hidden ${isCollapsed ? 'justify-center gap-0' : 'gap-3'}`}>
                <div className="flex-shrink-0 p-1 flex items-center justify-center h-12 w-12 overflow-hidden shadow-sm border border-slate-100 rounded-xl bg-slate-50">
                    <Image src="/logo.png" alt="Karma Staff Logo" width={40} height={40} className="object-contain" priority />
                </div>
                {!isCollapsed && (
                    <span className="text-xl font-bold tracking-tight text-slate-800 shrink-0">
                        Karma<span className="text-transparent bg-clip-text bg-gradient-primary">Pulse</span>
                    </span>
                )}
            </div>

            {/* Nav Links */}
            <div className="flex flex-col gap-2">
                {/* The Playbook */}
                <Link
                    href="/vault"
                    className={`flex items-center rounded-lg transition-colors overflow-hidden ${isCollapsed ? 'justify-center p-3' : 'gap-3 px-4 py-3'} ${pathname === '/vault' || pathname.startsWith('/vault/') ? 'bg-blue-50/50 text-primary font-semibold shadow-sm border border-primary/20' : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900 font-medium hover:shadow-sm border border-transparent hover:border-slate-200'}`}
                    title="The Playbook"
                >
                    <FileText className={`w-5 h-5 shrink-0 ${pathname === '/vault' || pathname.startsWith('/vault/') ? 'text-primary' : 'text-slate-400'}`} />
                    {!isCollapsed && <span>The Playbook</span>}
                </Link>

                {/* Admin Panel — superadmin only */}
                {currentUser?.role === 'superadmin' && (
                    <Link
                        href="/admin"
                        className={`flex items-center rounded-lg transition-colors overflow-hidden ${isCollapsed ? 'justify-center p-3' : 'gap-3 px-4 py-3'} ${pathname.startsWith('/admin') ? 'bg-indigo-50/50 text-indigo-600 font-semibold shadow-sm border border-indigo-200' : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900 font-medium hover:shadow-sm border border-transparent hover:border-slate-200'}`}
                        title="Admin Panel"
                    >
                        <Users className={`w-5 h-5 shrink-0 ${pathname.startsWith('/admin') ? 'text-indigo-600' : 'text-slate-400'}`} />
                        {!isCollapsed && <span>Admin Panel</span>}
                    </Link>
                )}
            </div>

            {/* Bottom: AI status + User info + Logout */}
            <div className="mt-auto overflow-hidden flex flex-col gap-3">

                {/* Karma AI Active badge */}
                <div className={`p-4 rounded-xl border border-amber-200 bg-amber-50/50 flex items-center transition-all ${isCollapsed ? 'justify-center' : 'gap-3 shadow-sm'}`} title="Karma AI Active">
                    <div className="relative shrink-0">
                        <Bot className="w-5 h-5 text-amber-500" />
                        <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse" />
                    </div>
                    {!isCollapsed && <span className="text-sm text-amber-700 font-semibold tracking-wide shrink-0">Karma AI Active</span>}
                </div>

                {/* Current user & Logout */}
                {currentUser && (
                    <div className={`rounded-xl bg-slate-50 border border-slate-100 ${isCollapsed ? 'p-2 flex flex-col items-center gap-3' : 'px-3 py-3'}`}>
                        <div className={`flex items-center gap-2.5 min-w-0 ${isCollapsed ? 'justify-center' : ''}`} title={currentUser.name}>
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-indigo-500/20 flex items-center justify-center shrink-0 font-bold text-primary text-xs">
                                {currentUser.name.charAt(0).toUpperCase()}
                            </div>
                            {!isCollapsed && (
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-slate-800 truncate">{currentUser.name}</p>
                                    <p className="text-[10px] text-slate-400 truncate">{currentUser.company}</p>
                                </div>
                            )}
                        </div>
                        
                        <button
                            onClick={handleLogout}
                            title="Sign out"
                            className={isCollapsed 
                                ? "p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors flex items-center justify-center w-full"
                                : "mt-2.5 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors border border-transparent hover:border-rose-100"
                            }
                        >
                            <LogOut className={isCollapsed ? "w-5 h-5" : "w-3 h-3"} />
                            {!isCollapsed && "Sign out"}
                        </button>
                    </div>
                )}

                {!isCollapsed && (
                    <div className="text-[10px] text-slate-400 text-center px-2 leading-tight">
                        Karma Pulse is AI and can make mistakes. Please double-check responses.
                    </div>
                )}
            </div>
        </nav>
    );
}
