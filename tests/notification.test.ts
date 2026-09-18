import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/lib/prisma';
import { generateToken } from '../src/lib/auth';
import './setup';

describe('Notification Endpoints', () => {
  let user1: { id: string; githubUsername: string };
  let user2: { id: string; githubUsername: string };
  let user1Token: string;
  let user2Token: string;
  let user1Notification: { id: string; recipientId: string; read: boolean };

  beforeAll(async () => {
    user1 = await prisma.contributor.create({
      data: {
        githubId: '90001',
        githubUsername: 'testuser1',
        stellarAddress: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      },
    });
    user1Token = generateToken({
      id: user1.id,
      githubId: user1.githubId,
      githubUsername: user1.githubUsername,
    });

    user2 = await prisma.contributor.create({
      data: {
        githubId: '90002',
        githubUsername: 'testuser2',
        stellarAddress: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
      },
    });
    user2Token = generateToken({
      id: user2.id,
      githubId: user2.githubId,
      githubUsername: user2.githubUsername,
    });

    user1Notification = await prisma.notification.create({
      data: {
        recipientId: user1.id,
        type: 'BOUNTY_CLAIMED',
        title: 'Bounty Claimed',
        body: 'Your bounty has been claimed by a contributor',
        read: false,
      },
    });
  });

  describe('PATCH /api/v1/notifications/:id/read', () => {
    it('should mark notification as read and set deliveredAt timestamp', async () => {
      const response = await request(app)
        .patch(`/api/v1/notifications/${user1Notification.id}/read`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(response.body.data).toHaveProperty('id', user1Notification.id);
      expect(response.body.data.read).toBe(true);
      expect(response.body.data.deliveredAt).not.toBeNull();
      expect(new Date(response.body.data.deliveredAt).getTime()).not.toBeNaN();

      // Verify in database
      const dbNotification = await prisma.notification.findUnique({
        where: { id: user1Notification.id },
      });
      expect(dbNotification?.read).toBe(true);
      expect(dbNotification?.deliveredAt).not.toBeNull();
    });

    it('should return 404 if notification belongs to another contributor', async () => {
      // User 2 tries to mark User 1's notification as read
      const response = await request(app)
        .patch(`/api/v1/notifications/${user1Notification.id}/read`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Notification not found');
    });

    it('should return 404 if notification does not exist', async () => {
      const response = await request(app)
        .patch('/api/v1/notifications/nonexistent-id/read')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Notification not found');
    });

    it('should return 401 when request is unauthenticated', async () => {
      await request(app)
        .patch(`/api/v1/notifications/${user1Notification.id}/read`)
        .expect(401);
    });

    it('should support POST method for backward compatibility', async () => {
      const newNotif = await prisma.notification.create({
        data: {
          recipientId: user1.id,
          type: 'SUBMISSION_APPROVED',
          title: 'Approved',
          body: 'Submission approved',
          read: false,
        },
      });

      const response = await request(app)
        .post(`/api/v1/notifications/${newNotif.id}/read`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(response.body.data.read).toBe(true);
      expect(response.body.data.deliveredAt).not.toBeNull();
    });
  });
});
