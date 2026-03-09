import { NextResponse } from 'next/server';
import { ensureSuperAdminExists, getUserByEmail, verifyPassword, signJWT } from '@/lib/auth-users';

export async function POST(req: Request) {
    try {
        const { email, password } = await req.json();

        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
        }

        await ensureSuperAdminExists();
        const user = await getUserByEmail(email);

        if (!user || !verifyPassword(password, user.passwordHash)) {
            return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
        }

        const token = signJWT({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            company: user.company,
        });

        const res = NextResponse.json({
            success: true,
            user: { id: user.id, name: user.name, email: user.email, role: user.role, company: user.company },
        });

        res.cookies.set('karma_session', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: '/',
        });

        return res;
    } catch (error: any) {
        return NextResponse.json({ error: 'Server error.' }, { status: 500 });
    }
}
