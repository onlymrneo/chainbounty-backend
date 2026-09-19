import { executeGracefulShutdown, resetShutdownStateForTesting, getIsShuttingDown } from '../src/lib/gracefulShutdown';

describe('Graceful Shutdown Handling (Issue #30)', () => {
  beforeEach(() => {
    resetShutdownStateForTesting();
  });

  it('should close HTTP server and disconnect Prisma client cleanly', async () => {
    let serverClosed = false;
    let prismaDisconnected = false;
    let cleanupHookCalled = false;

    const mockServer = {
      close: (callback: (err?: Error) => void) => {
        serverClosed = true;
        callback();
      },
    };

    const mockPrisma = {
      $disconnect: async () => {
        prismaDisconnected = true;
      },
    };

    const mockCleanup = () => {
      cleanupHookCalled = true;
    };

    await executeGracefulShutdown(
      mockServer as any,
      mockPrisma as any,
      mockCleanup,
      { exitProcess: false, timeoutMs: 1000 }
    );

    expect(serverClosed).toBe(true);
    expect(prismaDisconnected).toBe(true);
    expect(cleanupHookCalled).toBe(true);
    expect(getIsShuttingDown()).toBe(true);
  });

  it('should ignore duplicate shutdown requests', async () => {
    let callCount = 0;

    const mockServer = {
      close: (callback: (err?: Error) => void) => {
        callCount++;
        callback();
      },
    };

    const mockPrisma = {
      $disconnect: async () => {},
    };

    await executeGracefulShutdown(mockServer as any, mockPrisma as any, undefined, { exitProcess: false });
    await executeGracefulShutdown(mockServer as any, mockPrisma as any, undefined, { exitProcess: false });

    expect(callCount).toBe(1);
  });

  it('should handle errors gracefully without uncaught rejection', async () => {
    const mockServer = {
      close: (callback: (err?: Error) => void) => {
        callback(new Error('Server close error'));
      },
    };

    const mockPrisma = {
      $disconnect: async () => {
        throw new Error('Prisma disconnect error');
      },
    };

    await expect(
      executeGracefulShutdown(mockServer as any, mockPrisma as any, undefined, { exitProcess: false })
    ).resolves.not.toThrow();
  });
});
