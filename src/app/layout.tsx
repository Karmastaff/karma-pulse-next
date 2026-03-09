import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ConditionalSidebar } from '@/components/ConditionalSidebar';
import { VaultProvider } from '@/contexts/VaultContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'KarmaPulse | SLA compliance Engine',
  description: 'Antigravity AI Guardian for Restoration Jobs',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen bg-background text-foreground flex antialiased relative overflow-x-hidden`} suppressHydrationWarning>
        {/* Dynamic Background Mesh */}
        <div className="fixed inset-0 z-[-1] pointer-events-none bg-background">
          <div className="absolute -top-[40%] -left-[20%] w-[70%] h-[70%] rounded-full bg-blue-400/10 blur-[120px]" />
          <div className="absolute top-[60%] -right-[10%] w-[60%] h-[60%] rounded-full bg-violet-400/10 blur-[120px]" />
        </div>

        <VaultProvider>
          <ConditionalSidebar />
          <main className="flex-1 p-8 pb-16 relative z-30 min-w-0">
            {children}
          </main>
          {/* Global AI Disclaimer Footer - MUST be outside main to not be clipped */}
          <div style={{
            position: 'fixed',
            bottom: '1.25rem',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            pointerEvents: 'none',
            display: 'flex',
            justifyContent: 'center',
            width: 'max-content',
            maxWidth: '90vw',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: '#64748b',
              fontSize: '0.8125rem',
              fontWeight: 500,
              backgroundColor: 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              padding: '0.6rem 1.25rem',
              borderRadius: '9999px',
              border: '1px solid rgba(226,232,240,0.8)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.1), 0 1px 4px rgba(0,0,0,0.05)',
              pointerEvents: 'auto',
              whiteSpace: 'nowrap',
            }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b', flexShrink: 0, boxShadow: '0 0 6px #f59e0b' }} />
              <p style={{ margin: 0 }}>Karma Pulse is an AI and can make mistakes. Please double-check responses.</p>
            </div>
          </div>
        </VaultProvider>
      </body>
    </html>
  );
}
