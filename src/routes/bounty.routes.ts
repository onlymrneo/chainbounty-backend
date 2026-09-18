import { Router } from 'express';
import { bountyController } from '../controllers/bounty.controller';
import { bountyValidator } from '../validators/bounty.validator';

const router = Router();

/**
 * @openapi
 * /api/v1/bounties:
 *   get:
 *     tags: [Bounties]
 *     summary: List all bounties
 *     description: Retrieve a paginated list of bounties with optional filters
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [OPEN, CLAIMED, SUBMITTED, APPROVED, REJECTED, CANCELLED, DISPUTED]
 *       - in: query
 *         name: difficulty
 *         schema:
 *           type: string
 *           enum: [EASY, MEDIUM, HARD]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, rewardAmount, expiresAt, difficulty]
 *           default: createdAt
 *         description: Field to sort bounties by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort direction
 *     responses:
 *       200:
 *         description: List of bounties
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Bounty'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 */
router.get('/', bountyValidator.validateListBounties, bountyController.listBounties);

/**
 * @openapi
 * /api/v1/bounties:
 *   post:
 *     tags: [Bounties]
 *     summary: Create a new bounty
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, description, rewardAmount]
 *             properties:
 *               title:
 *                 type: string
 *                 example: Fix login validation bug
 *               description:
 *                 type: string
 *                 example: The login form does not validate email addresses
 *               rewardAmount:
 *                 type: number
 *                 example: 100
 *               rewardAsset:
 *                 type: string
 *                 default: XLM
 *               difficulty:
 *                 type: string
 *                 enum: [EASY, MEDIUM, HARD]
 *                 default: MEDIUM
 *     responses:
 *       201:
 *         description: Bounty created successfully
 *       400:
 *         description: Validation error
 */
router.post('/', bountyValidator.validateCreateBounty, bountyController.createBounty);

/**
 * @openapi
 * /api/v1/bounties/{id}:
 *   get:
 *     tags: [Bounties]
 *     summary: Get bounty by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Bounty details
 *       404:
 *         description: Bounty not found
 */
router.get('/:id', bountyController.getBountyById);

/**
 * @openapi
 * /api/v1/bounties/{id}/claim:
 *   post:
 *     tags: [Bounties]
 *     summary: Claim a bounty
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Bounty claimed successfully
 *       409:
 *         description: Bounty cannot be claimed
 */
router.post('/:id/claim', bountyController.claimBounty);

/**
 * @openapi
 * /api/v1/bounties/{id}/submit:
 *   post:
 *     tags: [Bounties]
 *     summary: Submit work for a claimed bounty
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
 *             required: [description]
 *             properties:
 *               description:
 *                 type: string
 *               prUrl:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Work submitted successfully
 */
router.post('/:id/submit', bountyController.submitBounty);

/**
 * @openapi
 * /api/v1/bounties/{id}/approve:
 *   post:
 *     tags: [Bounties]
 *     summary: Approve a submitted bounty
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Bounty approved
 */
router.post('/:id/approve', bountyController.approveBounty);

/**
 * @openapi
 * /api/v1/bounties/{id}/reject:
 *   post:
 *     tags: [Bounties]
 *     summary: Reject a submitted bounty
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
 *             required: [reviewNotes]
 *             properties:
 *               reviewNotes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Bounty rejected
 */
router.post('/:id/reject', bountyController.rejectBounty);

export default router;
