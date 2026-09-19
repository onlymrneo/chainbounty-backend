import dotenv from 'dotenv';
dotenv.config();

import { assertEnvOrExit } from './config/envValidator';

// Validate required environment variables before initializing server
assertEnvOrExit();

import app from './app';
import { startIndexer, stopIndexer } from './lib/horizonIndexer';

const PORT = parseInt(process.env.PORT ?? '3000', 10);

const server = app.listen(PORT, () => {
  console.info(`🚀 ChainBounty backend running on port ${PORT}`);
  console.info(`   Health check: http://localhost:${PORT}/health`);

  // Start Stellar Horizon indexer
  void startIndexer();
});

// Graceful shutdown
const shutdown = (): void => {
  console.info('Shutting down...');
  stopIndexer();
  server.close(() => {
    console.info('HTTP server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
