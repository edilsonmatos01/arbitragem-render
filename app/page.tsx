<<<<<<< HEAD
'use client';

import React from 'react';
=======
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc
import Link from 'next/link';

export default function HomePage() {
  return (
<<<<<<< HEAD
    <div className="min-h-screen bg-dark-bg text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Página Inicial de Teste</h1>
        <p className="text-lg mb-8">Se você vê esta página, a rota raiz (/) está funcionando.</p>
        <Link href="/dashboard" className="bg-custom-cyan text-white px-6 py-3 rounded-lg hover:bg-opacity-80 transition-colors">
          Ir para o Dashboard
        </Link>
      </div>
=======
    <div>
      <h1>Página Inicial de Teste</h1>
      <p>Se você vê esta página, a rota raiz (/) está funcionando.</p>
      <Link href="/dashboard">Ir para o Dashboard</Link>
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc
    </div>
  );
} 