import type { Request, Response } from 'express';
import type { AuthRequest } from '../types/auth';
import { prisma } from '../lib/prisma';

async function getContributorProfile(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const contributor = await prisma.contributor.findUnique({
      where: { id },
      include: {
        createdBounties: {
          select: {
            id: true,
            title: true,
            rewardAmount: true,
            rewardAsset: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        claimedBounties: {
          select: {
            id: true,
            title: true,
            rewardAmount: true,
            rewardAsset: true,
            status: true,
            claimedAt: true,
            approvedAt: true,
          },
          orderBy: { claimedAt: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            createdBounties: true,
            claimedBounties: true,
            submissions: true,
            disputes: true,
          },
        },
      },
    });

    if (!contributor) {
      res.status(404).json({ error: 'Contributor not found' });
      return;
    }

    res.status(200).json({ data: contributor });
  } catch (error) {
    console.error('getContributorProfile error:', error);
    res.status(500).json({ error: 'Failed to fetch contributor profile' });
  }
}

async function getContributorByAddress(req: Request, res: Response): Promise<void> {
  try {
    const { address } = req.params;

    const contributor = await prisma.contributor.findUnique({
      where: { stellarAddress: address },
      include: {
        _count: {
          select: {
            createdBounties: true,
            claimedBounties: true,
            submissions: true,
            disputes: true,
          },
        },
      },
    });

    if (!contributor) {
      res.status(404).json({ error: 'Contributor not found' });
      return;
    }

    res.status(200).json({ data: contributor });
  } catch (error) {
    console.error('getContributorByAddress error:', error);
    res.status(500).json({ error: 'Failed to fetch contributor' });
  }
}

async function getContributorStats(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const contributor = await prisma.contributor.findUnique({
      where: { id },
    });

    if (!contributor) {
      res.status(404).json({ error: 'Contributor not found' });
      return;
    }

    // Compute additional stats
    const [activeBounties, completedBounties, pendingSubmissions, totalDisputes] =
      await Promise.all([
        prisma.bounty.count({
          where: {
            claimantId: id,
            status: { in: ['CLAIMED', 'SUBMITTED'] },
          },
        }),
        prisma.bounty.count({
          where: {
            claimantId: id,
            status: 'APPROVED',
          },
        }),
        prisma.submission.count({
          where: {
            contributorId: id,
            bounty: { status: 'SUBMITTED' },
          },
        }),
        prisma.dispute.count({
          where: { raisedById: id },
        }),
      ]);

    const stats = {
      profile: {
        id: contributor.id,
        stellarAddress: contributor.stellarAddress,
        githubUsername: contributor.githubUsername,
        displayName: contributor.displayName,
        avatarUrl: contributor.avatarUrl,
        reputationScore: contributor.reputationScore,
      },
      earnings: {
        totalEarned: contributor.totalEarned.toString(),
        bountiesCompleted: contributor.bountiesCompleted,
      },
      activity: {
        activeBounties,
        completedBounties,
        pendingSubmissions,
        totalDisputes,
      },
    };

    res.status(200).json({ data: stats });
  } catch (error) {
    console.error('getContributorStats error:', error);
    res.status(500).json({ error: 'Failed to fetch contributor stats' });
  }
}

async function getLeaderboard(req: Request, res: Response): Promise<void> {
  try {
    const query = req.query as Record<string, string | undefined>;

    const sortBy = (query.sortBy as 'reputation' | 'earnings' | 'completed') ?? 'reputation';
    const limit = query.limit ? parseInt(query.limit, 10) : 50;
    const page = query.page ? parseInt(query.page, 10) : 1;

    // Validate limits
    if (limit < 1 || limit > 100) {
      res.status(400).json({
        error: 'Validation failed',
        details: [{ field: 'limit', message: 'limit must be between 1 and 100' }],
      });
      return;
    }

    if (page < 1) {
      res.status(400).json({
        error: 'Validation failed',
        details: [{ field: 'page', message: 'page must be a positive integer' }],
      });
      return;
    }

    const skip = (page - 1) * limit;

    // Determine sort field
    let orderBy: Record<string, 'desc' | 'asc'> = { reputationScore: 'desc' };

    if (sortBy === 'earnings') {
      orderBy = { totalEarned: 'desc' };
    } else if (sortBy === 'completed') {
      orderBy = { bountiesCompleted: 'desc' };
    }

    const [contributors, total] = await Promise.all([
      prisma.contributor.findMany({
        where: {
          // Only include contributors who have completed at least one bounty
          bountiesCompleted: { gt: 0 },
        },
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          stellarAddress: true,
          githubUsername: true,
          displayName: true,
          avatarUrl: true,
          reputationScore: true,
          bountiesCompleted: true,
          totalEarned: true,
          _count: {
            select: {
              claimedBounties: true,
              submissions: true,
            },
          },
        },
      }),
      prisma.contributor.count({
        where: { bountiesCompleted: { gt: 0 } },
      }),
    ]);

    // Add rank to each contributor
    const leaderboard = contributors.map((contributor, index) => ({
      rank: skip + index + 1,
      ...contributor,
      totalEarned: contributor.totalEarned.toString(),
    }));

    res.status(200).json({
      data: leaderboard,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('getLeaderboard error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
}

async function updateContributorProfile(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // Validate authentication and ownership
    if (!req.contributor || req.contributor.id !== id) {
      res.status(403).json({ error: 'Forbidden: You can only update your own profile' });
      return;
    }

    const body = req.body as Record<string, unknown>;

    // Whitelist check: allow updating displayName, bio, and avatarUrl fields only
    const allowedFields = ['displayName', 'bio', 'avatarUrl'];
    const bodyKeys = Object.keys(body);

    if (bodyKeys.length === 0) {
      res.status(400).json({ error: 'At least one field (displayName, bio, avatarUrl) must be provided' });
      return;
    }

    const disallowed = bodyKeys.filter((k) => !allowedFields.includes(k));
    if (disallowed.length > 0) {
      res.status(400).json({
        error: 'Validation failed',
        details: disallowed.map((f) => ({
          field: f,
          message: `Field '${f}' cannot be updated. Allowed fields are: ${allowedFields.join(', ')}`,
        })),
      });
      return;
    }

    const validationErrors: Array<{ field: string; message: string }> = [];

    // displayName validation
    if (body.displayName !== undefined && body.displayName !== null) {
      if (typeof body.displayName !== 'string') {
        validationErrors.push({ field: 'displayName', message: 'displayName must be a string' });
      } else if (body.displayName.trim().length > 100) {
        validationErrors.push({
          field: 'displayName',
          message: 'displayName must not exceed 100 characters',
        });
      }
    }

    // bio validation
    if (body.bio !== undefined && body.bio !== null) {
      if (typeof body.bio !== 'string') {
        validationErrors.push({ field: 'bio', message: 'bio must be a string' });
      } else if (body.bio.trim().length > 500) {
        validationErrors.push({ field: 'bio', message: 'bio must not exceed 500 characters' });
      }
    }

    // avatarUrl validation
    if (body.avatarUrl !== undefined && body.avatarUrl !== null) {
      if (typeof body.avatarUrl !== 'string') {
        validationErrors.push({ field: 'avatarUrl', message: 'avatarUrl must be a string' });
      } else if (body.avatarUrl.trim() !== '') {
        try {
          const parsedUrl = new URL(body.avatarUrl);
          if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            validationErrors.push({
              field: 'avatarUrl',
              message: 'avatarUrl must use HTTP or HTTPS protocol',
            });
          }
        } catch {
          validationErrors.push({ field: 'avatarUrl', message: 'avatarUrl must be a valid URL' });
        }
      }
    }

    if (validationErrors.length > 0) {
      res.status(400).json({ error: 'Validation failed', details: validationErrors });
      return;
    }

    // Verify contributor exists
    const existing = await prisma.contributor.findUnique({
      where: { id },
    });

    if (!existing) {
      res.status(404).json({ error: 'Contributor not found' });
      return;
    }

    // Build update payload
    const dataToUpdate: {
      displayName?: string | null;
      bio?: string | null;
      avatarUrl?: string | null;
    } = {};

    if (body.displayName !== undefined) {
      dataToUpdate.displayName =
        typeof body.displayName === 'string' ? body.displayName.trim() : null;
    }
    if (body.bio !== undefined) {
      dataToUpdate.bio = typeof body.bio === 'string' ? body.bio.trim() : null;
    }
    if (body.avatarUrl !== undefined) {
      dataToUpdate.avatarUrl =
        typeof body.avatarUrl === 'string' ? body.avatarUrl.trim() : null;
    }

    const updated = await prisma.contributor.update({
      where: { id },
      data: dataToUpdate,
      select: {
        id: true,
        stellarAddress: true,
        githubUsername: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        reputationScore: true,
        bountiesCompleted: true,
        totalEarned: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(200).json({ data: updated });
  } catch (error) {
    console.error('updateContributorProfile error:', error);
    res.status(500).json({ error: 'Failed to update contributor profile' });
  }
}

export const contributorController = {
  getContributorProfile,
  getContributorByAddress,
  getContributorStats,
  getLeaderboard,
  updateContributorProfile,
};
