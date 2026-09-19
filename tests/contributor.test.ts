import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/lib/prisma';
import { signToken } from '../src/lib/auth';

describe('Contributor Profile Update (Issue #12)', () => {
  let contributor1: any;
  let contributor2: any;
  let token1: string;
  let token2: string;

  beforeAll(async () => {
    // Create test contributors
    contributor1 = await prisma.contributor.create({
      data: {
        stellarAddress: 'GTESTUSER100000000000000000000000000000000000000000000000',
        displayName: 'Test Contributor 1',
        bio: 'Initial bio',
        avatarUrl: 'https://example.com/avatar1.png',
      },
    });

    contributor2 = await prisma.contributor.create({
      data: {
        stellarAddress: 'GTESTUSER200000000000000000000000000000000000000000000000',
        displayName: 'Test Contributor 2',
      },
    });

    token1 = signToken(contributor1.id, contributor1.stellarAddress);
    token2 = signToken(contributor2.id, contributor2.stellarAddress);
  });

  it('should update own profile with valid fields (displayName, bio, avatarUrl)', async () => {
    const res = await request(app)
      .patch(`/api/v1/contributors/${contributor1.id}`)
      .set('Authorization', `Bearer ${token1}`)
      .send({
        displayName: 'Updated Name',
        bio: 'New bio description',
        avatarUrl: 'https://example.com/new-avatar.jpg',
      })
      .expect(200);

    expect(res.body.data.displayName).toBe('Updated Name');
    expect(res.body.data.bio).toBe('New bio description');
    expect(res.body.data.avatarUrl).toBe('https://example.com/new-avatar.jpg');

    const dbUser = await prisma.contributor.findUnique({ where: { id: contributor1.id } });
    expect(dbUser?.displayName).toBe('Updated Name');
    expect(dbUser?.bio).toBe('New bio description');
  });

  it('should reject update without authorization token (401)', async () => {
    await request(app)
      .patch(`/api/v1/contributors/${contributor1.id}`)
      .send({ displayName: 'Hacked' })
      .expect(401);
  });

  it('should reject updating another contributor profile (403)', async () => {
    const res = await request(app)
      .patch(`/api/v1/contributors/${contributor2.id}`)
      .set('Authorization', `Bearer ${token1}`)
      .send({ displayName: 'Malicious Update' })
      .expect(403);

    expect(res.body.error).toContain('Forbidden');
  });

  it('should reject updating disallowed fields such as reputationScore or stellarAddress (400)', async () => {
    const res = await request(app)
      .patch(`/api/v1/contributors/${contributor1.id}`)
      .set('Authorization', `Bearer ${token1}`)
      .send({
        reputationScore: 9999,
        stellarAddress: 'GNEWSTELLAR000000000000000000000000000000000000000000000',
      })
      .expect(400);

    expect(res.body.error).toBe('Validation failed');
  });

  it('should reject invalid avatarUrl format (400)', async () => {
    const res = await request(app)
      .patch(`/api/v1/contributors/${contributor1.id}`)
      .set('Authorization', `Bearer ${token1}`)
      .send({ avatarUrl: 'not-a-valid-url' })
      .expect(400);

    expect(res.body.error).toBe('Validation failed');
  });
});
