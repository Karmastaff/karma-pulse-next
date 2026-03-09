import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJWT, getUserById, toPublicUser } from '@/lib/auth-users';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('karma_session')?.value;

        if (!token) {
            return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
        }

        const payload = verifyJWT(token);
        if (!payload) {
            return NextResponse.json({ error: 'Invalid or expired session.' }, { status: 401 });
        }

        const user = await getUserById(payload.id);
        if (!user) {
            return NextResponse.json({ error: 'User not found.' }, { status: 404 });
        }

        return NextResponse.json({ user: toPublicUser(user) });
    } catch {
        return NextResponse.json({ error: 'Server error.' }, { status: 500 });
    }
}
