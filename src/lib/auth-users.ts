import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { supabase } from './supabaseClient';

export type UserRole = 'superadmin' | 'admin';

export interface User {
    id: string;
    name: string;
    email: string;
    company: string;
    role: UserRole;
    passwordHash: string; // "salt:hash"
    createdAt: string;
}

export interface PublicUser {
    id: string;
    name: string;
    email: string;
    company: string;
    role: UserRole;
    createdAt: string;
}

export interface JWTPayload {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    company: string;
    iat: number;
    exp: number;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const JWT_SECRET = process.env.JWT_SECRET || 'karmapulse-secret-key-change-in-production';
const IS_PROD = process.env.NODE_ENV === 'production';

// ── File I/O (Local Only) ────────────────────────────────────────────────────────

function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readLocalUsers(): User[] {
    ensureDataDir();
    if (!fs.existsSync(USERS_FILE)) return [];
    try {
        return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    } catch {
        return [];
    }
}

function saveLocalUsers(users: User[]): void {
    ensureDataDir();
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

// ── Database Access (Hybrid) ──────────────────────────────────────────────────

export async function ensureSuperAdminExists(): Promise<void> {
    if (IS_PROD) {
        // In prod, check Supabase
        console.log('[AUTH] Checking for existing users in Supabase...');
        const { data, error } = await supabase.from('users').select('id').limit(1);
        if (error) {
            console.error('[AUTH] Error checking users:', error.message);
            return;
        }
        if (data && data.length > 0) {
            console.log('[AUTH] Users already exist, skipping seed.');
            return;
        }
    } else {
        // Locally, check JSON
        const users = readLocalUsers();
        if (users.length > 0) return;
    }

    // Auto-seed default super admin and admin on first run
    const now = Date.now();
    const seededSA: User = {
        id: 'sa-' + now,
        name: 'Super Admin',
        email: 'superadmin@karmapulse.com',
        company: 'KarmaPulse',
        role: 'superadmin',
        passwordHash: hashPassword('KarmaAdmin2024!'),
        createdAt: new Date().toISOString(),
    };

    const seededAdmin: User = {
        id: 'admin-' + now,
        name: 'Local Admin',
        email: 'admin@karmapulse.com',
        company: 'Demo Company Ltd',
        role: 'admin',
        passwordHash: hashPassword('AdminUser2024!'),
        createdAt: new Date().toISOString(),
    };

    if (IS_PROD) {
        console.log('[AUTH] Seeding default users to Supabase...');
        const { error } = await supabase.from('users').insert([seededSA, seededAdmin]);
        if (error) {
            console.error('[AUTH] Error seeding users:', error.message);
        } else {
            console.log('[AUTH] Seeded default super admin: superadmin@karmapulse.com');
            console.log('[AUTH] Seeded default admin: admin@karmapulse.com');
        }
    } else {
        saveLocalUsers([seededSA, seededAdmin]);
        console.log('[AUTH] Seeded default super admin: superadmin@karmapulse.com');
        console.log('[AUTH] Seeded default admin: admin@karmapulse.com');
    }
}

export async function getUsers(): Promise<User[]> {
    if (IS_PROD) {
        const { data, error } = await supabase.from('users').select('*');
        if (error) throw new Error(error.message);
        return data || [];
    }
    return readLocalUsers();
}

export async function getUserById(id: string): Promise<User | null> {
    if (IS_PROD) {
        const { data, error } = await supabase.from('users').select('*').eq('id', id).single();
        if (error) return null;
        return data;
    }
    const users = readLocalUsers();
    return users.find(u => u.id === id) || null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
    const normalizedEmail = email.toLowerCase();
    if (IS_PROD) {
        console.log(`[AUTH] Fetching user by email: ${normalizedEmail}`);
        const { data, error } = await supabase.from('users').select('*').ilike('email', normalizedEmail).single();
        if (error) {
            console.error(`[AUTH] [ERROR] Fetching user ${normalizedEmail}:`, error.message);
            return null;
        }
        console.log(`[AUTH] User found in DB: ${data.email} (ID: ${data.id})`);
        return data;
    }
    const users = readLocalUsers();
    return users.find(u => u.email.toLowerCase() === normalizedEmail) || null;
}

export async function createUser(user: User): Promise<void> {
    if (IS_PROD) {
        const { error } = await supabase.from('users').insert(user);
        if (error) throw new Error(error.message);
        return;
    }
    const users = readLocalUsers();
    saveLocalUsers([...users, user]);
}

export async function deleteUser(id: string): Promise<void> {
    if (IS_PROD) {
        const { error } = await supabase.from('users').delete().eq('id', id);
        if (error) throw new Error(error.message);
        return;
    }
    const users = readLocalUsers();
    const updated = users.filter(u => u.id !== id);
    saveLocalUsers(updated);
}

// ── Password ──────────────────────────────────────────────────────────────────

export function hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
    try {
        const [salt, hash] = storedHash.split(':');
        if (!salt || !hash) {
            console.error('[AUTH] Invalid stored hash format (missing salt or hash).');
            return false;
        }
        const inputHash = crypto.pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex');
        const match = crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(inputHash, 'hex'));
        
        if (IS_PROD) {
            console.log(`[AUTH] Password verification result: ${match ? 'SUCCESS' : 'FAILED'}`);
        }
        return match;
    } catch (e: any) {
        console.error('[AUTH] Exception during password verification:', e.message);
        return false;
    }
}

// ── JWT ───────────────────────────────────────────────────────────────────────

export function signJWT(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    const now = Math.floor(Date.now() / 1000);
    const full: JWTPayload = { ...payload, iat: now, exp: now + 60 * 60 * 24 * 7 }; // 7 days
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body   = Buffer.from(JSON.stringify(full)).toString('base64url');
    const sig    = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    return `${header}.${body}.${sig}`;
}

export function verifyJWT(token: string): JWTPayload | null {
    try {
        const [header, body, sig] = token.split('.');
        if (!header || !body || !sig) return null;
        const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
        if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;
        const payload: JWTPayload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'));
        if (payload.exp < Math.floor(Date.now() / 1000)) return null;
        return payload;
    } catch {
        return null;
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function toPublicUser(user: User): PublicUser {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...pub } = user;
    return pub;
}
