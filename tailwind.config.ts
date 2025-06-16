import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.tsx', // Mais específico para TSX na pasta app
    './components/**/*.tsx', // Mais específico para TSX na pasta components
    // Adicione outros caminhos se tiver componentes/páginas em outros lugares
  ],
  theme: {
    extend: {
      colors: {
        // Cores personalizadas baseadas na sua imagem de design
        'custom-cyan': '#00C49F', // Cor de destaque principal
        'dark-bg': '#0D1117',     // Fundo geral bem escuro (alternativa a gray-900)
        'dark-card': '#1F2937',   // Fundo para cards e sidebar (alternativa a gray-800)
      },
      // Você pode estender outras propriedades do tema aqui
      // fontFamily: { sans: ['Inter', 'sans-serif'] },
    },
  },
  plugins: [
    // Adicione plugins do Tailwind aqui, se estiver usando algum
    // Exemplo: require('@tailwindcss/forms'),
  ],
};
export default config; 