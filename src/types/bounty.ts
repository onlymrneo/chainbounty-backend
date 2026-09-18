import type { BountyStatus, BountyDifficulty } from '@prisma/client';

export interface CreateBountyInput {
  title: string;
  description: string;
  rewardAmount: number;
  rewardAsset?: string;
  difficulty?: BountyDifficulty;
  githubIssueUrl?: string;
  githubIssueNumber?: number;
  githubRepoOwner?: string;
  githubRepoName?: string;
  contractAddress?: string;
  expiresAt?: string;
  milestones?: Array<{
    title: string;
    description?: string;
    rewardPercent: number;
  }>;
}

export interface BountyFilters {
  status?: BountyStatus;
  difficulty?: BountyDifficulty;
  creatorId?: string;
  claimantId?: string;
  githubRepoOwner?: string;
  githubRepoName?: string;
  minReward?: number;
  maxReward?: number;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'rewardAmount' | 'expiresAt' | 'difficulty' | 'reputationScore';
  sortOrder?: 'asc' | 'desc';
}
