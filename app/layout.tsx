import './globals.css';
import { TONProvider } from '@/lib/tonconnect';

export const metadata = { title: 'TON Vampire Survivors' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="bg-gray-900 text-white overflow-hidden h-screen w-screen flex items-center justify-center">
        <TONProvider>{children}</TONProvider>
      </body>
    </html>
  );
}
