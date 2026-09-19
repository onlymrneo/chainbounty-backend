import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { startIndexer } from './lib/horizonIndexer';
import { createShutdownHandler } from './lib/shutdown';

const PORT = parseInt(process.env.PORT ?? '3000', 10);

const server = app.listen(PORT, () => {
  console.info(`🚀 ChainBounty backend running on port ${PORT}`);
  console.info(`   Health check: http://localhost:${PORT}/health`);

  // Start Stellar Horizon indexer
  void startIndexer();
});

// Configure graceful shutdown handler for SIGTERM and SIGINT
const shutdown = createShutdownHandler({ server });

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
