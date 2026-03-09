import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'karmapulse-secret-key-change-in-production';

async function verifyToken(token: string): Promise<{ role: string; id: string } | null> {
    try {
        const encoder = new TextEncoder();
        const [header, payload, signature] = token.split('.');
        if (!header || !payload || !signature) return null;

        // Import key for HMAC-SHA256 verification (Edge-compatible Web Crypto)
        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(JWT_SECRET),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['verify']
        );

        // base64url → Uint8Array
        const sigBytes = Uint8Array.from(
            atob(signature.replace(/-/g, '+').replace(/_/g, '/')),
            c => c.charCodeAt(0)
        );
        const dataBytes = encoder.encode(`${header}.${payload}`);
        const valid = await crypto.subtle.verify('HMAC', key, sigBytes, dataBytes);
        if (!valid) return null;

        const parsed = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
        if (parsed.exp < Math.floor(Date.now() / 1000)) return null;

        return { role: parsed.role, id: parsed.id };
    } catch {
        return null;
    }
}

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // ── Always public ────────────────────────────────────────────────────────
    if (
        pathname.startsWith('/login') ||
        pathname.startsWith('/api/auth/') ||
        pathname.startsWith('/_next/') ||
        pathname.match(/\.(png|ico|svg|jpg|jpeg|webp|woff2?)$/)
    ) {
        return NextResponse.next();
    }

    // ── Check session cookie ─────────────────────────────────────────────────
    const token = req.cookies.get('karma_session')?.value;

    if (!token) {
        return NextResponse.redirect(new URL('/login', req.url));
    }

    const user = await verifyToken(token);

    if (!user) {
        const res = NextResponse.redirect(new URL('/login', req.url));
        res.cookies.delete('karma_session');
        return res;
    }

    // ── Guard admin routes (page + API) ──────────────────────────────────────
    if (pathname.startsWith('/admin') && user.role !== 'superadmin') {
        return NextResponse.redirect(new URL('/vault', req.url));
    }

    if (pathname.startsWith('/api/admin') && user.role !== 'superadmin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
