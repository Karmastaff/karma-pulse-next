import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Sign In | KarmaPulse',
};

// The login route uses the root layout's html/body but
// needs NO sidebar or global chrome — so we start a new
// flex context that fills the screen cleanly.
export default function LoginLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
