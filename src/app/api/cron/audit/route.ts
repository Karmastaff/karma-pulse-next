import { NextResponse } from 'next/server';

// This cron endpoint is currently disabled.
export async function GET() {
    return NextResponse.json(
        { error: 'This endpoint is currently disabled.' },
        { status: 403 }
    );
}

export async function POST() {
    return NextResponse.json(
        { error: 'This endpoint is currently disabled.' },
        { status: 403 }
    );
}
