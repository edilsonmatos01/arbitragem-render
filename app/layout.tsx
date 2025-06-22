import './globals.css'; // Assumindo que você terá um arquivo globals.css
import type { Metadata } from 'next'
<<<<<<< HEAD
import { Providers } from './providers'
=======
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc

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
<<<<<<< HEAD
    <html lang="pt-BR" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
=======
    <html lang="pt-BR">
      <body className="">{/* Removido bg-red-500 */}
        {children}
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc
      </body>
    </html>
  );
} 