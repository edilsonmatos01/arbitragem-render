import './globals.css'; // Assumindo que você terá um arquivo globals.css
import type { Metadata } from 'next'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'Robô de Arbitragem',
  description: 'Dashboard do Robô de Arbitragem de Criptomoedas',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
} 