import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import type { CreateBountyInput, BountyFilters } from '../types/bounty';
import type { Prisma } from '@prisma/client';
import { BountyDifficulty } from '@prisma/client';
import {
  notifyBountyClaimed,
  notifyBountySubmitted,
  notifyBountyApproved,
  notifyBountyRejected,
} from '../lib/notificationService';
import { recordPlatformFee } from '../lib/platformFee';

// Shared creator select shape
const creatorSelect = {
  id: true,
  stellarAddress: true,
  githubUsername: true,
  displayName: true,
  avatarUrl: true,
};

async function createBounty(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as CreateBountyInput;

    // Placeholder creator until JWT auth lands in step 15
    const DEV_STELLAR = 'GDEV0000000000000000000000000000000000000000000000000000';
    const creator = await prisma.contributor.upsert({
      where: { stellarAddress: DEV_STELLAR },
      update: {},
      create: { stellarAddress: DEV_STELLAR, displayName: 'Dev Placeholder' },
    });

    const bounty = await prisma.bounty.create({
      data: {
        title: body.title.trim(),
        description: body.description.trim(),
        rewardAmount: body.rewardAmount,
        rewardAsset: body.rewardAsset ?? 'XLM',
        difficulty: body.difficulty ?? BountyDifficulty.MEDIUM,
        githubIssueUrl: body.githubIssueUrl ?? null,
        githubIssueNumber: body.githubIssueNumber ?? null,
        githubRepoOwner: body.githubRepoOwner ?? null,
        githubRepoName: body.githubRepoName ?? null,
        contractAddress: body.contractAddress ?? null,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        creatorId: creator.id,
        milestones:
          body.milestones && body.milestones.length > 0
            ? {
                create: body.milestones.map((m) => ({
                  title: m.title,
                  description: m.description ?? null,
                  rewardPercent: m.rewardPercent,
                })),
              }
            : undefined,
      },
      include: {
        creator: { select: creatorSelect },
        milestones: true,
      },
    });

    res.status(201).json({ data: bounty });
  } catch (error) {
    console.error('createBounty error:', error);
    res.status(500).json({ error: 'Failed to create bounty' });
  }
}

async function listBounties(req: Request, res: Response): Promise<void> {
  try {
    const query = req.query as Record<string, string | undefined>;

    const filters: BountyFilters = {
      status: query.status as BountyFilters['status'],
      difficulty: query.difficulty as BountyFilters['difficulty'],
      creatorId: query.creatorId,
      claimantId: query.claimantId,
      githubRepoOwner: query.githubRepoOwner,
      githubRepoName: query.githubRepoName,
      minReward: query.minReward !== undefined ? Number(query.minReward) : undefined,
      maxReward: query.maxReward !== undefined ? Number(query.maxReward) : undefined,
      page: query.page !== undefined ? parseInt(query.page, 10) : 1,
      limit: query.limit !== undefined ? parseInt(query.limit, 10) : 20,
      sortBy: (query.sortBy as BountyFilters['sortBy']) ?? 'createdAt',
      sortOrder: (query.sortOrder as BountyFilters['sortOrder']) ?? 'desc',
    };

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.BountyWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.difficulty) where.difficulty = filters.difficulty;
    if (filters.creatorId) where.creatorId = filters.creatorId;
    if (filters.claimantId) where.claimantId = filters.claimantId;
    if (filters.githubRepoOwner) where.githubRepoOwner = filters.githubRepoOwner;
    if (filters.githubRepoName) where.githubRepoName = filters.githubRepoName;
    if (filters.minReward !== undefined || filters.maxReward !== undefined) {
      where.rewardAmount = {};
      if (filters.minReward !== undefined) where.rewardAmount.gte = filters.minReward;
      if (filters.maxReward !== undefined) where.rewardAmount.lte = filters.maxReward;
    }

    // Build orderBy
    const orderBy: Prisma.BountyOrderByWithRelationInput =
      filters.sortBy === 'rewardAmount'
        ? { rewardAmount: filters.sortOrder ?? 'desc' }
        : { createdAt: filters.sortOrder ?? 'desc' };

    const [bounties, total] = await Promise.all([
      prisma.bounty.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          creator: { select: creatorSelect },
          claimant: { select: creatorSelect },
          _count: { select: { submissions: true, disputes: true } },
        },
      }),
      prisma.bounty.count({ where }),
    ]);

    res.status(200).json({
      data: bounties,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error('listBounties error:', error);
    res.status(500).json({ error: 'Failed to fetch bounties' });
  }
}

async function getBountyById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const bounty = await prisma.bounty.findUnique({
      where: { id },
      include: {
        creator: { select: creatorSelect },
        claimant: { select: creatorSelect },
        milestones: { orderBy: { createdAt: 'asc' } },
        submissions: {
          orderBy: { createdAt: 'desc' },
          include: {
            contributor: { select: creatorSelect },
          },
        },
        disputes: {
          orderBy: { createdAt: 'desc' },
          include: {
            raisedBy: { select: creatorSelect },
          },
        },
        _count: { select: { submissions: true, disputes: true } },
      },
    });

    if (!bounty) {
      res.status(404).json({ error: 'Bounty not found' });
      return;
    }

    res.status(200).json({ data: bounty });
  } catch (error) {
    console.error('getBountyById error:', error);
    res.status(500).json({ error: 'Failed to fetch bounty' });
  }
}

async function claimBounty(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // Placeholder claimant until JWT auth lands in step 15
    const DEV_CLAIMANT_STELLAR = 'GCLM0000000000000000000000000000000000000000000000000000';
    const claimant = await prisma.contributor.upsert({
      where: { stellarAddress: DEV_CLAIMANT_STELLAR },
      update: {},
      create: { stellarAddress: DEV_CLAIMANT_STELLAR, displayName: 'Claimant Placeholder' },
    });

    // Fetch bounty with a transaction to prevent race conditions
    const bounty = await prisma.bounty.findUnique({ where: { id } });

    if (!bounty) {
      res.status(404).json({ error: 'Bounty not found' });
      return;
    }

    if (bounty.status !== 'OPEN') {
      res.status(409).json({
        error: 'Bounty cannot be claimed',
        detail: `Bounty is currently ${bounty.status}. Only OPEN bounties can be claimed.`,
      });
      return;
    }

    if (bounty.creatorId === claimant.id) {
      res.status(409).json({ error: 'Bounty creator cannot claim their own bounty' });
      return;
    }

    if (bounty.expiresAt && bounty.expiresAt < new Date()) {
      res.status(409).json({ error: 'Bounty has expired and can no longer be claimed' });
      return;
    }

    const updated = await prisma.bounty.update({
      where: { id },
      data: {
        status: 'CLAIMED',
        claimantId: claimant.id,
        claimedAt: new Date(),
      },
      include: {
        creator: { select: creatorSelect },
        claimant: { select: creatorSelect },
        milestones: true,
      },
    });

    // Send notification to bounty creator
    void notifyBountyClaimed(
      updated.id,
      updated.title,
      updated.creatorId,
      claimant.displayName ?? claimant.stellarAddress,
    );

    res.status(200).json({ data: updated });
  } catch (error) {
    console.error('claimBounty error:', error);
    res.status(500).json({ error: 'Failed to claim bounty' });
  }
}

async function submitBounty(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const body = req.body as { prUrl?: string; description?: string; notes?: string };

    // Validate submission body
    if (
      !body.description ||
      typeof body.description !== 'string' ||
      body.description.trim().length === 0
    ) {
      res.status(400).json({
        error: 'Validation failed',
        details: [{ field: 'description', message: 'Submission description is required' }],
      });
      return;
    }

    if (body.prUrl !== undefined) {
      try {
        new URL(body.prUrl);
      } catch {
        res.status(400).json({
          error: 'Validation failed',
          details: [{ field: 'prUrl', message: 'prUrl must be a valid URL' }],
        });
        return;
      }
    }

    // Placeholder claimant until JWT auth lands in step 15
    const DEV_CLAIMANT_STELLAR = 'GCLM0000000000000000000000000000000000000000000000000000';
    const claimant = await prisma.contributor.upsert({
      where: { stellarAddress: DEV_CLAIMANT_STELLAR },
      update: {},
      create: { stellarAddress: DEV_CLAIMANT_STELLAR, displayName: 'Claimant Placeholder' },
    });

    const bounty = await prisma.bounty.findUnique({ where: { id } });

    if (!bounty) {
      res.status(404).json({ error: 'Bounty not found' });
      return;
    }

    if (bounty.status !== 'CLAIMED') {
      res.status(409).json({
        error: 'Bounty cannot be submitted',
        detail: `Bounty is currently ${bounty.status}. Only CLAIMED bounties can have work submitted.`,
      });
      return;
    }

    if (bounty.claimantId !== claimant.id) {
      res.status(403).json({ error: 'Only the bounty claimant can submit work' });
      return;
    }

    // Update bounty status and create submission in a transaction
    const [updatedBounty, submission] = await prisma.$transaction([
      prisma.bounty.update({
        where: { id },
        data: {
          status: 'SUBMITTED',
          submittedAt: new Date(),
        },
        include: {
          creator: { select: creatorSelect },
          claimant: { select: creatorSelect },
          milestones: true,
        },
      }),
      prisma.submission.create({
        data: {
          bountyId: id,
          contributorId: claimant.id,
          prUrl: body.prUrl ?? null,
          description: body.description.trim(),
          notes: body.notes?.trim() ?? null,
        },
        include: {
          contributor: { select: creatorSelect },
        },
      }),
    ]);

    // Send notification to bounty creator
    void notifyBountySubmitted(
      updatedBounty.id,
      updatedBounty.title,
      updatedBounty.creatorId,
      claimant.displayName ?? claimant.stellarAddress,
    );

    res.status(200).json({ data: { bounty: updatedBounty, submission } });
  } catch (error) {
    console.error('submitBounty error:', error);
    res.status(500).json({ error: 'Failed to submit bounty work' });
  }
}

async function approveBounty(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const body = req.body as { reviewNotes?: string; releaseTxHash?: string };

    // Placeholder creator/maintainer until JWT auth lands in step 15
    const DEV_STELLAR = 'GDEV0000000000000000000000000000000000000000000000000000';
    const maintainer = await prisma.contributor.upsert({
      where: { stellarAddress: DEV_STELLAR },
      update: {},
      create: { stellarAddress: DEV_STELLAR, displayName: 'Dev Placeholder' },
    });

    const bounty = await prisma.bounty.findUnique({
      where: { id },
      include: { submissions: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    if (!bounty) {
      res.status(404).json({ error: 'Bounty not found' });
      return;
    }

    if (bounty.creatorId !== maintainer.id) {
      res.status(403).json({ error: 'Only the bounty creator can approve submissions' });
      return;
    }

    if (bounty.status !== 'SUBMITTED') {
      res.status(409).json({
        error: 'Bounty cannot be approved',
        detail: `Bounty is currently ${bounty.status}. Only SUBMITTED bounties can be approved.`,
      });
      return;
    }

    const latestSubmission = bounty.submissions[0];

    const [updatedBounty] = await prisma.$transaction([
      prisma.bounty.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          releaseTxHash: body.releaseTxHash ?? null,
        },
        include: {
          creator: { select: creatorSelect },
          claimant: { select: creatorSelect },
          milestones: true,
        },
      }),
      // Stamp review notes on the latest submission if provided
      ...(latestSubmission && body.reviewNotes
        ? [
            prisma.submission.update({
              where: { id: latestSubmission.id },
              data: { reviewNotes: body.reviewNotes.trim() },
            }),
          ]
        : []),
      // Update claimant stats
      ...(bounty.claimantId
        ? [
            prisma.contributor.update({
              where: { id: bounty.claimantId },
              data: {
                bountiesCompleted: { increment: 1 },
                totalEarned: { increment: bounty.rewardAmount },
                reputationScore: { increment: 10 },
              },
            }),
          ]
        : []),
    ]);

    // Record platform fee
    void recordPlatformFee(
      updatedBounty.id,
      bounty.rewardAmount,
      bounty.rewardAsset,
      body.releaseTxHash,
    );

    // Send notification to claimant
    if (bounty.claimantId) {
      void notifyBountyApproved(
        updatedBounty.id,
        updatedBounty.title,
        bounty.claimantId,
        `${bounty.rewardAmount.toString()} ${bounty.rewardAsset}`,
      );
    }

    res.status(200).json({ data: updatedBounty });
  } catch (error) {
    console.error('approveBounty error:', error);
    res.status(500).json({ error: 'Failed to approve bounty' });
  }
}

async function rejectBounty(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const body = req.body as { reviewNotes?: string };

    if (!body.reviewNotes || body.reviewNotes.trim().length === 0) {
      res.status(400).json({
        error: 'Validation failed',
        details: [
          {
            field: 'reviewNotes',
            message: 'Review notes are required when rejecting a submission',
          },
        ],
      });
      return;
    }

    // Placeholder creator/maintainer until JWT auth lands in step 15
    const DEV_STELLAR = 'GDEV0000000000000000000000000000000000000000000000000000';
    const maintainer = await prisma.contributor.upsert({
      where: { stellarAddress: DEV_STELLAR },
      update: {},
      create: { stellarAddress: DEV_STELLAR, displayName: 'Dev Placeholder' },
    });

    const bounty = await prisma.bounty.findUnique({
      where: { id },
      include: { submissions: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    if (!bounty) {
      res.status(404).json({ error: 'Bounty not found' });
      return;
    }

    if (bounty.creatorId !== maintainer.id) {
      res.status(403).json({ error: 'Only the bounty creator can reject submissions' });
      return;
    }

    if (bounty.status !== 'SUBMITTED') {
      res.status(409).json({
        error: 'Bounty cannot be rejected',
        detail: `Bounty is currently ${bounty.status}. Only SUBMITTED bounties can be rejected.`,
      });
      return;
    }

    const latestSubmission = bounty.submissions[0];

    const [updatedBounty] = await prisma.$transaction([
      // Revert to CLAIMED so the contributor can resubmit
      prisma.bounty.update({
        where: { id },
        data: { status: 'CLAIMED', submittedAt: null },
        include: {
          creator: { select: creatorSelect },
          claimant: { select: creatorSelect },
          milestones: true,
        },
      }),
      // Stamp review notes on the latest submission
      ...(latestSubmission
        ? [
            prisma.submission.update({
              where: { id: latestSubmission.id },
              data: { reviewNotes: body.reviewNotes.trim() },
            }),
          ]
        : []),
    ]);

    // Send notification to claimant
    if (bounty.claimantId) {
      void notifyBountyRejected(
        updatedBounty.id,
        updatedBounty.title,
        bounty.claimantId,
        body.reviewNotes,
      );
    }

    res.status(200).json({ data: updatedBounty });
  } catch (error) {
    console.error('rejectBounty error:', error);
    res.status(500).json({ error: 'Failed to reject bounty' });
  }
}

async function getBountyStats(_req: Request, res: Response): Promise<void> {
  try {
    const allStatuses = ['OPEN', 'CLAIMED', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'DISPUTED'];

    // Group bounties by status
    const statusGroups = await prisma.bounty.groupBy({
      by: ['status'],
      _count: { _all: true },
    });

    const bountiesByStatus: Record<string, number> = {};
    for (const s of allStatuses) {
      bountiesByStatus[s] = 0;
    }
    for (const group of statusGroups) {
      bountiesByStatus[group.status] = group._count._all;
    }

    const totalBounties = Object.values(bountiesByStatus).reduce((a, b) => a + b, 0);

    // Active bounties: OPEN, CLAIMED, SUBMITTED
    const activeBounties = await prisma.bounty.findMany({
      where: {
        status: { in: ['OPEN', 'CLAIMED', 'SUBMITTED'] },
      },
      select: { rewardAmount: true },
    });

    let totalRewardLocked = 0;
    for (const b of activeBounties) {
      totalRewardLocked += Number(b.rewardAmount);
    }

    // Average time to completion for completed (APPROVED) bounties
    const completedBounties = await prisma.bounty.findMany({
      where: {
        status: 'APPROVED',
        approvedAt: { not: null },
      },
      select: {
        createdAt: true,
        approvedAt: true,
      },
    });

    let totalDurationSeconds = 0;
    for (const b of completedBounties) {
      if (b.approvedAt) {
        const diffMs = b.approvedAt.getTime() - b.createdAt.getTime();
        totalDurationSeconds += Math.max(0, diffMs / 1000);
      }
    }

    const averageCompletionTimeSeconds = completedBounties.length > 0
      ? Math.round(totalDurationSeconds / completedBounties.length)
      : null;

    const averageCompletionTimeHours = averageCompletionTimeSeconds !== null
      ? Number((averageCompletionTimeSeconds / 3600).toFixed(2))
      : null;

    res.status(200).json({
      data: {
        totalBounties,
        bountiesByStatus,
        activeBountiesCount: activeBounties.length,
        totalRewardLocked: totalRewardLocked.toFixed(2),
        totalRewardLockedAmount: totalRewardLocked,
        completedBountiesCount: completedBounties.length,
        averageCompletionTimeHours,
        averageCompletionTimeSeconds,
      },
    });
  } catch (error) {
    console.error('getBountyStats error:', error);
    res.status(500).json({ error: 'Failed to fetch bounty statistics' });
  }
}

export const bountyController = {
  createBounty,
  listBounties,
  getBountyById,
  getBountyStats,
  claimBounty,
  submitBounty,
  approveBounty,
  rejectBounty,
};
