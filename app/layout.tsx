import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist_Mono } from 'next/font/google'
import './globals.css'

const geistMono = Geist_Mono({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-geist-mono',
})

export const metadata: Metadata = {
  title: 'Stella Coder 3.9 — AI Terminal',
  description:
    'Stella Coder 3.9 — терминальный AI-агент для программирования на базе Zen. Пишите, рефакторите и отлаживайте код прямо из терминала.',
  generator: 'v0.app',
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#12101f',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru" className={`bg-background ${geistMono.variable}`}>
      <body className="antialiased font-mono">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
