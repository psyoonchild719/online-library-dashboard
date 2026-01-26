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
}

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
