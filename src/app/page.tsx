'use client';

import { Construction } from 'lucide-react';

export default function Dashboard() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-6 animate-in fade-in zoom-in duration-500">
      <div className="w-20 h-20 rounded-3xl bg-slate-100 border border-slate-200 shadow-sm flex items-center justify-center mb-6">
        <Construction className="w-10 h-10 text-slate-400" strokeWidth={1.5} />
      </div>
      <h1 className="text-3xl font-extrabold tracking-tight text-foreground mb-3">Dashboard Coming Soon</h1>
      <p className="text-muted-foreground text-base max-w-sm leading-relaxed">
        This section is currently under construction. Check back soon for real-time job auditing and compliance tracking.
      </p>
    </div>
  );
}
