import './globals.css'

export const metadata = {
  title: '📚 온라인 도서관 - 입퇴실 대시보드',
  description: '실시간 입퇴실 현황 대시보드',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
