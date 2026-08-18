import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

// Body: Inter. Display/UI: Plus Jakarta Sans (sans geométrica). Exposed as CSS
// variables consumed by --font-sans / --font-display in tokens.css.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Finance Platform',
  description: 'Personal finance control with AI assistant',
};

const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||((t===null||t==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${inter.variable} ${jakarta.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="bg-background text-text min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
