import './globals.css'

export const metadata = {
  title: '📚 2026 임상심리전문가 자격시험 준비 스터디룸',
  description: '실시간 학습 시간 현황 대시보드',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
