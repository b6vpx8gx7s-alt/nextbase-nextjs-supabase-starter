import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  title: 'Fisioterapia — RODA',
  description: 'Planes de fisioterapia adaptados con IA',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
