'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';

export function ConditionalSidebar() {
    const pathname = usePathname();
    // Don't show sidebar on the login page
    if (pathname === '/login') return null;
    return <Sidebar />;
}
