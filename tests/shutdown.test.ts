import type { Server } from 'http';
import { createShutdownHandler, resetShutdownState } from '../src/lib/shutdown';
import { prisma } from '../src/lib/prisma';
import * as horizonIndexer from '../src/lib/horizonIndexer';

describe('Graceful Shutdown Handler', () => {
  let mockServer: Partial<Server>;
  let exitMock: jest.Mock;
  let stopIndexerSpy: jest.SpyInstance;
  let prismaDisconnectSpy: jest.SpyInstance;

  beforeEach(() => {
    resetShutdownState();
    mockServer = {
      close: jest.fn((cb) => {
        if (cb) cb();
        return mockServer as Server;
      }),
    };
    exitMock = jest.fn();
    stopIndexerSpy = jest.spyOn(horizonIndexer, 'stopIndexer').mockImplementation(() => {});
    prismaDisconnectSpy = jest.spyOn(prisma, '$disconnect').mockResolvedValue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should cleanly execute graceful shutdown on signal', async () => {
    const handler = createShutdownHandler({
      server: mockServer as Server,
      timeoutMs: 5000,
      onExit: exitMock,
    });

    await handler('SIGTERM');

    expect(stopIndexerSpy).toHaveBeenCalledTimes(1);
    expect(mockServer.close).toHaveBeenCalledTimes(1);
    expect(prismaDisconnectSpy).toHaveBeenCalledTimes(1);
    expect(exitMock).toHaveBeenCalledWith(0);
  });

  it('should ignore duplicate shutdown signals while in progress', async () => {
    const handler = createShutdownHandler({
      server: mockServer as Server,
      timeoutMs: 5000,
      onExit: exitMock,
    });

    const first = handler('SIGTERM');
    const duplicate = handler('SIGINT');

    await Promise.all([first, duplicate]);

    expect(stopIndexerSpy).toHaveBeenCalledTimes(1);
    expect(mockServer.close).toHaveBeenCalledTimes(1);
    expect(prismaDisconnectSpy).toHaveBeenCalledTimes(1);
    expect(exitMock).toHaveBeenCalledTimes(1);
  });

  it('should handle Prisma disconnect failure and exit with code 1', async () => {
    prismaDisconnectSpy.mockRejectedValueOnce(new Error('DB disconnect failed'));

    const handler = createShutdownHandler({
      server: mockServer as Server,
      timeoutMs: 5000,
      onExit: exitMock,
    });

    await handler('SIGINT');

    expect(stopIndexerSpy).toHaveBeenCalledTimes(1);
    expect(mockServer.close).toHaveBeenCalledTimes(1);
    expect(prismaDisconnectSpy).toHaveBeenCalledTimes(1);
    expect(exitMock).toHaveBeenCalledWith(1);
  });

  it('should handle server close failure and exit with code 1', async () => {
    mockServer.close = jest.fn((cb) => {
      if (cb) cb(new Error('Server close error'));
      return mockServer as Server;
    });

    const handler = createShutdownHandler({
      server: mockServer as Server,
      timeoutMs: 5000,
      onExit: exitMock,
    });

    await handler('SIGTERM');

    expect(stopIndexerSpy).toHaveBeenCalledTimes(1);
    expect(mockServer.close).toHaveBeenCalledTimes(1);
    expect(exitMock).toHaveBeenCalledWith(1);
  });
});
