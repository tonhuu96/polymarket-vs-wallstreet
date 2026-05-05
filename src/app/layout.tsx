import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import './globals.css';

/**
 * Mono everywhere. JetBrains Mono is exposed as a CSS var so Tailwind 4's
 * `@theme inline` block in globals.css can wire it into `--font-mono`.
 *
 * `dark` class on <html> opts every Tailwind `dark:` variant in. We do NOT
 * follow `prefers-color-scheme` — this dashboard is always dark.
 */
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
});

export const metadata: Metadata = {
  title: 'Polymarket vs Wall Street',
  description: 'Cross-market arbitrage dashboard',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark h-full ${jetbrainsMono.variable}`}>
      <body className="bg-zinc-950 text-zinc-100 min-h-full font-mono antialiased">
        {children}
      </body>
    </html>
  );
}
