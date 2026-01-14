import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ファネルビルダー',
  description: 'マーケティングファネルを視覚的に設計・管理',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  );
}
