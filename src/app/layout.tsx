import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import Link from 'next/link';
import './globals.css';

const geist = Geist({ variable: '--font-geist', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'TradeFare | 무역 운임 조회',
  description: '한국무역협회(KITA) 해상·항공 참고운임 조회 시스템',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-gray-50 font-sans">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
            <Link href="/" className="font-bold text-blue-700 text-lg tracking-tight">
              TradeFare
            </Link>
            <nav className="flex items-center gap-6 text-sm font-medium">
              <Link
                href="/"
                className="text-gray-500 hover:text-gray-900 transition-colors"
              >
                개요
              </Link>
              <Link
                href="/query"
                className="text-gray-500 hover:text-gray-900 transition-colors"
              >
                운임 조회
              </Link>
            </nav>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-gray-100 bg-white py-4 text-center text-xs text-gray-400">
          출처: 한국무역협회(KITA) | 시장 참고운임으로 이용 선사·항공사·물동량에 따라 실제 운임과 상이할 수 있음
        </footer>
      </body>
    </html>
  );
}
