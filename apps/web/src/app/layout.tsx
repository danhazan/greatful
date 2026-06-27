import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { headers } from 'next/headers'
import { ToastProvider } from '@/contexts/ToastContext'
import { UserProvider } from '@/contexts/UserContext'
import { LocaleProvider } from '@/contexts/LocaleContext'
import { ModalPortalRefProvider } from '@/hooks/useModalPortalRefs'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Grateful 💜 - Share Your Gratitude',
  description: 'A modern social platform for sharing daily gratitudes and building positive connections',
  icons: {
    icon: '/favicon.ico',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headersList = await headers()
  const country = headersList.get('x-vercel-ip-country') || ''

  return (
    <html lang="en">
      <head>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>💜</text></svg>" />
      </head>
      <body className={inter.className}>
        <UserProvider>
          <LocaleProvider initialCountry={country}>
            <ToastProvider>
              <ModalPortalRefProvider>
                {children}
              </ModalPortalRefProvider>
            </ToastProvider>
          </LocaleProvider>
        </UserProvider>
      </body>
    </html>
  )
}