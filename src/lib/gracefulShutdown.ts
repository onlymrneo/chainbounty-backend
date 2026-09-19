import { Server } from 'http';
import { PrismaClient } from '@prisma/client';

export interface ShutdownOptions {
  timeoutMs?: number;
  exitProcess?: boolean;
}

let isShuttingDown = false;

export function getIsShuttingDown(): boolean {
  return isShuttingDown;
}

export function resetShutdownStateForTesting(): void {
  isShuttingDown = false;
}

/**
 * Orchestrates graceful application teardown.
 * 1. Stops accepting new incoming HTTP requests while finishing in-flight requests
 * 2. Invokes custom cleanup hooks (e.g. indexer teardown)
 * 3. Safely disconnects Prisma database client connection
 * 4. Force-terminates process after timeout if connections hang
 */
export async function executeGracefulShutdown(
  server: Server | { close: (cb: (err?: Error) => void) => any },
  prisma: PrismaClient | { $disconnect: () => Promise<any> },
  onCleanup?: () => Promise<void> | void,
  options: ShutdownOptions = {}
): Promise<void> {
  const { timeoutMs = 10000, exitProcess = true } = options;

  if (isShuttingDown) {
    console.info('Shutdown already in progress, ignoring duplicate signal');
    return;
  }
  isShuttingDown = true;
  console.info('Initiating graceful shutdown sequence...');

  // Watchdog timer to prevent hanging processes
  const timer = setTimeout(() => {
    console.error(`Graceful shutdown timed out after ${timeoutMs}ms. Forcing process exit.`);
    if (exitProcess) {
      process.exit(1);
    }
  }, timeoutMs);

  // Unref timer so it does not keep event loop alive if everything completes cleanly
  if (typeof timer.unref === 'function') {
    timer.unref();
  }

  try {
    // 1. Run cleanup hooks (e.g. stop Stellar Horizon indexer polling)
    if (onCleanup) {
      try {
        await onCleanup();
        console.info('✓ Cleanup hooks completed');
      } catch (err) {
        console.error('Error executing cleanup hooks:', err);
      }
    }

    // 2. Stop accepting new requests and finish pending ones
    await new Promise<void>((resolve) => {
      server.close((err) => {
        if (err) {
          console.error('Error closing HTTP server:', err);
        } else {
          console.info('✓ HTTP server closed (all in-flight requests drained)');
        }
        resolve();
      });
    });

    // 3. Disconnect database client
    try {
      await prisma.$disconnect();
      console.info('✓ Database connection closed (Prisma disconnected)');
    } catch (err) {
      console.error('Error disconnecting Prisma client:', err);
    }

    clearTimeout(timer);
    console.info('✓ Graceful shutdown completed cleanly.');

    if (exitProcess) {
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal error during shutdown:', err);
    clearTimeout(timer);
    if (exitProcess) {
      process.exit(1);
    }
  }
}

/**
 * Registers OS signal listeners for SIGTERM and SIGINT.
 */
export function setupGracefulShutdown(
  server: Server,
  prisma: PrismaClient,
  onCleanup?: () => Promise<void> | void,
  options: ShutdownOptions = {}
): void {
  const handler = (signal: string) => {
    console.info(`Received ${signal}. Starting shutdown...`);
    void executeGracefulShutdown(server, prisma, onCleanup, options);
  };

  process.once('SIGTERM', () => handler('SIGTERM'));
  process.once('SIGINT', () => handler('SIGINT'));
}
