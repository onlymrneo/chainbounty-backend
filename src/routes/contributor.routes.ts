import { Router } from 'express';
import { contributorController } from '../controllers/contributor.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// GET /contributors/leaderboard — get top contributors ranked by reputation/earnings
router.get('/leaderboard', contributorController.getLeaderboard);

// GET /contributors/:id — get full profile by ID
router.get('/:id', contributorController.getContributorProfile);

/**
 * @openapi
 * /api/v1/contributors/{id}:
 *   patch:
 *     tags: [Contributors]
 *     summary: Update contributor profile
 *     description: Update displayName, bio, and avatarUrl. Users can only update their own profile.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               displayName:
 *                 type: string
 *                 maxLength: 100
 *               bio:
 *                 type: string
 *                 maxLength: 500
 *               avatarUrl:
 *                 type: string
 *                 format: uri
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Validation error or disallowed fields
 *       401:
 *         description: Missing or invalid authentication token
 *       403:
 *         description: Forbidden - cannot update another user's profile
 *       404:
 *         description: Contributor not found
 */
router.patch('/:id', authenticate, contributorController.updateContributorProfile);

// GET /contributors/:id/stats — get contributor stats
router.get('/:id/stats', contributorController.getContributorStats);

// GET /contributors/address/:address — get contributor by Stellar address
router.get('/address/:address', contributorController.getContributorByAddress);

export default router;
