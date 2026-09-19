import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { prisma } from './lib/prisma';
import { startIndexer, stopIndexer } from './lib/horizonIndexer';
import { setupGracefulShutdown } from './lib/gracefulShutdown';

const PORT = parseInt(process.env.PORT ?? '3000', 10);

const server = app.listen(PORT, () => {
  console.info(`🚀 ChainBounty backend running on port ${PORT}`);
  console.info(`   Health check: http://localhost:${PORT}/health`);

  // Start Stellar Horizon indexer
  void startIndexer();
});

// Setup graceful shutdown on SIGTERM and SIGINT
setupGracefulShutdown(server, prisma, () => {
  stopIndexer();
});
