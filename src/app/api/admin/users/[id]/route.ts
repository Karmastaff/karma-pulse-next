import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { deleteUser, getUserById, verifyJWT } from '@/lib/auth-users';

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('karma_session')?.value;
        const session = token ? verifyJWT(token) : null;

        if (!session) {
            return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
        }

        const { id } = await params;

        if (id === session.id) {
            return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 });
        }

        const target = await getUserById(id);
        if (!target) {
            return NextResponse.json({ error: 'User not found.' }, { status: 404 });
        }

        await deleteUser(id);

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Server error.' }, { status: 500 });
    }
}
