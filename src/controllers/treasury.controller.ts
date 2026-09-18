import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

async function getTreasuryStats(_req: Request, res: Response): Promise<void> {
  try {
    const [totalFeesCollected, totalFeesPending, feesByAsset, recentFees] = await Promise.all([
      // Total collected fees
      prisma.platformFee.aggregate({
        where: { collected: true },
        _sum: { amount: true },
        _count: true,
      }),

      // Total pending fees
      prisma.platformFee.aggregate({
        where: { collected: false },
        _sum: { amount: true },
        _count: true,
      }),

      // Fees by asset
      prisma.platformFee.groupBy({
        by: ['asset', 'collected'],
        _sum: { amount: true },
        _count: true,
      }),

      // Recent fee records
      prisma.platformFee.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          amount: true,
          asset: true,
          collected: true,
          collectedAt: true,
          txHash: true,
          createdAt: true,
          bountyId: true,
        },
      }),
    ]);

    // Group by asset
    const assetBreakdown: Record<string, { collected: string; pending: string }> = {};

    feesByAsset.forEach((group) => {
      if (!assetBreakdown[group.asset]) {
        assetBreakdown[group.asset] = { collected: '0', pending: '0' };
      }

      if (group.collected) {
        assetBreakdown[group.asset].collected = group._sum.amount?.toString() ?? '0';
      } else {
        assetBreakdown[group.asset].pending = group._sum.amount?.toString() ?? '0';
      }
    });

    const stats = {
      summary: {
        totalCollected: totalFeesCollected._sum.amount?.toString() ?? '0',
        totalPending: totalFeesPending._sum.amount?.toString() ?? '0',
        collectedCount: totalFeesCollected._count,
        pendingCount: totalFeesPending._count,
      },
      byAsset: assetBreakdown,
      recentFees: recentFees.map((fee) => ({
        ...fee,
        amount: fee.amount.toString(),
      })),
    };

    res.status(200).json({ data: stats });
  } catch (error) {
    console.error('getTreasuryStats error:', error);
    res.status(500).json({ error: 'Failed to fetch treasury stats' });
  }
}

async function getPlatformFees(req: Request, res: Response): Promise<void> {
  try {
    const query = req.query as Record<string, string | undefined>;

    const collected =
      query.collected === 'true' ? true : query.collected === 'false' ? false : undefined;
    const asset = query.asset;
    const limit = query.limit ? parseInt(query.limit, 10) : 50;
    const page = query.page ? parseInt(query.page, 10) : 1;

    if (limit < 1 || limit > 100) {
      res.status(400).json({
        error: 'Validation failed',
        details: [{ field: 'limit', message: 'limit must be between 1 and 100' }],
      });
      return;
    }

    const skip = (page - 1) * limit;

    const where = {
      ...(collected !== undefined ? { collected } : {}),
      ...(asset ? { asset } : {}),
    };

    const [fees, total] = await Promise.all([
      prisma.platformFee.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.platformFee.count({ where }),
    ]);

    res.status(200).json({
      data: fees.map((fee) => ({
        ...fee,
        amount: fee.amount.toString(),
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('getPlatformFees error:', error);
    res.status(500).json({ error: 'Failed to fetch platform fees' });
  }
}

async function getPlatformFeeSummary(req: Request, res: Response): Promise<void> {
  try {
    const query = req.query as Record<string, string | undefined>;
    const { startDate, endDate, asset } = query;

    let dateFilter: { gte?: Date; lte?: Date } | undefined;
    if (startDate || endDate) {
      dateFilter = {};
      if (startDate) {
        const start = new Date(startDate);
        if (isNaN(start.getTime())) {
          res.status(400).json({
            error: 'Validation failed',
            details: [{ field: 'startDate', message: 'startDate must be a valid date' }],
          });
          return;
        }
        dateFilter.gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        if (isNaN(end.getTime())) {
          res.status(400).json({
            error: 'Validation failed',
            details: [{ field: 'endDate', message: 'endDate must be a valid date' }],
          });
          return;
        }
        dateFilter.lte = end;
      }
    }

    const where = {
      ...(dateFilter ? { createdAt: dateFilter } : {}),
      ...(asset ? { asset } : {}),
    };

    const [totalFeesCollected, totalFeesPending, feesByAsset, feeRecords] = await Promise.all([
      // Total collected fees
      prisma.platformFee.aggregate({
        where: { ...where, collected: true },
        _sum: { amount: true },
        _count: true,
      }),

      // Total pending fees
      prisma.platformFee.aggregate({
        where: { ...where, collected: false },
        _sum: { amount: true },
        _count: true,
      }),

      // Group by asset & collection status
      prisma.platformFee.groupBy({
        by: ['asset', 'collected'],
        where,
        _sum: { amount: true },
        _count: true,
      }),

      // Fetch fee records to compute unique bounties and average fee
      prisma.platformFee.findMany({
        where,
        select: { bountyId: true, amount: true, asset: true, collected: true },
      }),
    ]);

    const collectedAmount = totalFeesCollected._sum.amount
      ? parseFloat(totalFeesCollected._sum.amount.toString())
      : 0;
    const pendingAmount = totalFeesPending._sum.amount
      ? parseFloat(totalFeesPending._sum.amount.toString())
      : 0;
    const totalAmount = collectedAmount + pendingAmount;

    // Distinct bounty count
    const uniqueBountyIds = new Set(feeRecords.map((r) => r.bountyId));
    const bountyCount = uniqueBountyIds.size;
    const averageFeePerBounty = bountyCount > 0 ? (totalAmount / bountyCount).toFixed(7) : '0';

    // Asset breakdown
    const assetBreakdown: Record<
      string,
      { collected: string; pending: string; total: string; feeCount: number; bountyCount: number }
    > = {};

    const bountiesByAsset: Record<string, Set<string>> = {};
    feeRecords.forEach((r) => {
      if (!bountiesByAsset[r.asset]) {
        bountiesByAsset[r.asset] = new Set();
      }
      bountiesByAsset[r.asset].add(r.bountyId);
    });

    feesByAsset.forEach((group) => {
      if (!assetBreakdown[group.asset]) {
        assetBreakdown[group.asset] = {
          collected: '0',
          pending: '0',
          total: '0',
          feeCount: 0,
          bountyCount: bountiesByAsset[group.asset]?.size ?? 0,
        };
      }

      const amt = group._sum.amount ? parseFloat(group._sum.amount.toString()) : 0;
      assetBreakdown[group.asset].feeCount += group._count;

      if (group.collected) {
        assetBreakdown[group.asset].collected = (
          parseFloat(assetBreakdown[group.asset].collected) + amt
        ).toString();
      } else {
        assetBreakdown[group.asset].pending = (
          parseFloat(assetBreakdown[group.asset].pending) + amt
        ).toString();
      }

      const tot =
        parseFloat(assetBreakdown[group.asset].collected) +
        parseFloat(assetBreakdown[group.asset].pending);
      assetBreakdown[group.asset].total = tot.toString();
    });

    const summary = {
      totalCollected: collectedAmount.toString(),
      totalPending: pendingAmount.toString(),
      totalAmount: totalAmount.toString(),
      collectedCount: totalFeesCollected._count,
      pendingCount: totalFeesPending._count,
      totalFeeRecords: totalFeesCollected._count + totalFeesPending._count,
      bountyCount,
      averageFeePerBounty,
      byAsset: assetBreakdown,
      filters: {
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
        ...(asset ? { asset } : {}),
      },
    };

    res.status(200).json({ data: summary });
  } catch (error) {
    console.error('getPlatformFeeSummary error:', error);
    res.status(500).json({ error: 'Failed to fetch platform fee summary' });
  }
}

export const treasuryController = {
  getTreasuryStats,
  getPlatformFees,
  getPlatformFeeSummary,
};
