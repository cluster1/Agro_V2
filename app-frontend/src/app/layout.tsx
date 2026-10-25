import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'

const inter = Inter({ subsets: ['latin'] })
const productCode = process.env.NEXT_PUBLIC_PRODUCT_CODE || 'IoT Agro Monitoring'
const productTitle = process.env.NEXT_PUBLIC_PRODUCT_TITLE || productCode
const productDesc = process.env.NEXT_PUBLIC_PRODUCT_DESC || 'Sistem monitoring IoT real-time untuk pertanian dan peternakan'

export const metadata: Metadata = {
  // Routes set `title` via their own layout; the template appends the product name.
  title: { default: productTitle, template: `%s | ${productCode}` },
  description: productDesc,
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8f7f4' },
    { media: '(prefers-color-scheme: dark)', color: '#0f1a12' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
