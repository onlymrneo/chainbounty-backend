import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/lib/prisma';
import { version } from '../package.json';
import './setup';

describe('Health Check Endpoint (GET /health)', () => {
  it('should return 200 with standard health check fields when database is connected', async () => {
    const response = await request(app).get('/health').expect(200);

    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('version', version);
    expect(response.body).toHaveProperty('service', 'chainbounty-backend');
    expect(response.body).toHaveProperty('timestamp');
    expect(new Date(response.body.timestamp).getTime()).not.toBeNaN();
    expect(response.body).toHaveProperty('checks');
    expect(response.body.checks).toHaveProperty('database');
    expect(response.body.checks.database.status).toBe('connected');
  });

  it('should return 503 degraded when database connectivity fails', async () => {
    const queryRawSpy = jest
      .spyOn(prisma, '$queryRaw')
      .mockRejectedValueOnce(new Error('Database unreachable'));

    const response = await request(app).get('/health').expect(503);

    expect(response.body).toHaveProperty('status', 'degraded');
    expect(response.body).toHaveProperty('version', version);
    expect(response.body.checks.database.status).toBe('error');
    expect(response.body.checks.database.error).toBe('Database unreachable');

    queryRawSpy.mockRestore();
  });
});
