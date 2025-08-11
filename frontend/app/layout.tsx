import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '../components/theme-provider'
import { Toaster } from '../components/ui/toaster'
import { QueryProvider } from '../components/query-provider'
import { AuthProvider } from '../components/auth-provider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'HospedeFácil - Onde o Brasil se hospeda',
  description: 'A plataforma de hospedagem mais avançada do Brasil. Pagamento via PIX, WhatsApp integrado, IA brasileira.',
  keywords: ['hospedagem', 'airbnb', 'booking', 'brasil', 'pix', 'whatsapp', 'aluguel temporada'],
  authors: [{ name: 'HospedeFácil Team' }],
  creator: 'HospedeFácil',
  publisher: 'HospedeFácil',
  metadataBase: new URL('https://hospedefacil.com.br'),
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: 'HospedeFácil - Onde o Brasil se hospeda',
    description: 'A plataforma de hospedagem mais avançada do Brasil',
    url: 'https://hospedefacil.com.br',
    siteName: 'HospedeFácil',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'HospedeFácil - Hospedagem inteligente',
      },
    ],
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HospedeFácil - Onde o Brasil se hospeda',
    description: 'A plataforma de hospedagem mais avançada do Brasil',
    images: ['/og-image.jpg'],
    creator: '@hospedefacil',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'google-site-verification-code',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content="#1890ff" />
      </head>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <AuthProvider>
              {children}
              <Toaster />
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}