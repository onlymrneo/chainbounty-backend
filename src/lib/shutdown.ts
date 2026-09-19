import type { Server } from 'http';
import { prisma } from './prisma';
import { stopIndexer } from './horizonIndexer';

export interface ShutdownOptions {
  server: Server;
  timeoutMs?: number;
  onExit?: (code: number) => void;
}

let isShuttingDown = false;

export const resetShutdownState = (): void => {
  isShuttingDown = false;
};

export const createShutdownHandler = (options: ShutdownOptions) => {
  const { server, timeoutMs = 10000, onExit = (code: number) => process.exit(code) } = options;

  return async (signal: string): Promise<void> => {
    if (isShuttingDown) {
      console.warn(`[Shutdown] Already shutting down. Ignoring duplicate signal: ${signal}`);
      return;
    }
    isShuttingDown = true;
    console.info(`[Shutdown] Received ${signal}. Starting graceful shutdown...`);

    // Force exit timer if graceful cleanup hangs
    const forceExitTimer = setTimeout(() => {
      console.error('[Shutdown] Cleanup timed out. Forcing termination.');
      onExit(1);
    }, timeoutMs);

    if (typeof forceExitTimer.unref === 'function') {
      forceExitTimer.unref();
    }

    try {
      // 1. Stop background indexer
      console.info('[Shutdown] Stopping background indexer...');
      stopIndexer();

      // 2. Stop accepting new HTTP requests and finish in-flight requests
      console.info('[Shutdown] Closing HTTP server and finishing pending requests...');
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) {
            console.error('[Shutdown] Error while closing HTTP server:', err);
            reject(err);
          } else {
            console.info('[Shutdown] HTTP server closed successfully.');
            resolve();
          }
        });
      });

      // 3. Close Prisma database client connection
      console.info('[Shutdown] Disconnecting Prisma database client...');
      await prisma.$disconnect();
      console.info('[Shutdown] Database connection closed successfully.');

      clearTimeout(forceExitTimer);
      console.info('[Shutdown] Graceful shutdown completed.');
      onExit(0);
    } catch (error) {
      console.error('[Shutdown] Error occurred during graceful shutdown:', error);
      clearTimeout(forceExitTimer);
      onExit(1);
    }
  };
};
