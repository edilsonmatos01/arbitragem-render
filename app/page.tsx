import Link from 'next/link';

export default function HomePage() {
  return (
    <div>
      <h1>Página Inicial de Teste</h1>
      <p>Se você vê esta página, a rota raiz (/) está funcionando.</p>
      <Link href="/dashboard">Ir para o Dashboard</Link>
    </div>
  );
} 