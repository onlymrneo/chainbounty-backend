import { Router } from 'express';
import { treasuryController } from '../controllers/treasury.controller';

const router = Router();

// GET /treasury/stats — get treasury summary stats
router.get('/stats', treasuryController.getTreasuryStats);

// GET /treasury/fees — get platform fees with filters
router.get('/fees', treasuryController.getPlatformFees);

// GET /treasury/fees/summary — get platform fee summary with date range & asset filters
router.get('/fees/summary', treasuryController.getPlatformFeeSummary);

// GET /treasury/fee-summary — alias for platform fee summary
router.get('/fee-summary', treasuryController.getPlatformFeeSummary);

export default router;
