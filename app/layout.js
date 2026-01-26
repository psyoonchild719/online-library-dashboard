import './globals.css'

export const metadata = {
  title: '📚 2026 스터디룸',
  description: '실시간 학습 시간 현황 대시보드',
  applicationName: '📚 2026 스터디룸',
  appleWebApp: {
    capable: true,
    title: '📚 2026 스터디룸',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
