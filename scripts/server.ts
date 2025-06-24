import express, { Request, Response } from 'express';
import { startContinuousMonitoring } from './spread-monitor';

const app = express();
const port = process.env.PORT || 3000;

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Inicia o servidor
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
  // Inicia o monitoramento em background
  startContinuousMonitoring().catch(error => {
    console.error('Erro fatal no monitoramento:', error);
    process.exit(1);
  });
}); 