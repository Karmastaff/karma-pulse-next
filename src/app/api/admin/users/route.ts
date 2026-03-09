import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getUsers, createUser, getUserByEmail, hashPassword, toPublicUser, verifyJWT } from '@/lib/auth-users';
import type { UserRole } from '@/lib/auth-users';

// GET — list all users (superadmin only)
export async function GET() {
    try {
        const users = await getUsers();
        return NextResponse.json({ users: users.map(toPublicUser) });
    } catch {
        return NextResponse.json({ error: 'Server error.' }, { status: 500 });
    }
}

// POST — create a new user (superadmin only)
export async function POST(req: Request) {
    try {
        const { name, email, company, password, role } = await req.json();

        if (!name || !email || !company || !password || !role) {
            return NextResponse.json({ error: 'All fields are required.' }, { status: 400 });
        }

        if (!['superadmin', 'admin'].includes(role)) {
            return NextResponse.json({ error: 'Invalid role.' }, { status: 400 });
        }

        const exists = await getUserByEmail(email);
        if (exists) {
            return NextResponse.json({ error: 'A user with that email already exists.' }, { status: 409 });
        }

        if (password.length < 8) {
            return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
        }

        const newUser = {
            id: 'usr-' + Date.now(),
            name,
            email,
            company,
            role: role as UserRole,
            passwordHash: hashPassword(password),
            createdAt: new Date().toISOString(),
        };

        await createUser(newUser);
        return NextResponse.json({ user: toPublicUser(newUser) }, { status: 201 });
    } catch {
        return NextResponse.json({ error: 'Server error.' }, { status: 500 });
    }
}
