import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// All notification routes require authentication
router.use(authenticate);

// GET /notifications — get user's notifications
router.get('/', notificationController.getNotifications);

// POST /notifications/read-all — mark all as read
router.post('/read-all', notificationController.markAllAsRead);

// POST /notifications/:id/read — mark specific notification as read
// PATCH /notifications/:id/read – mark specific notification as read
router.patch('/:id/read', notificationController.markAsRead);

// POST /notifications/:id/read – mark specific notification as read (backward compatibility)
router.post('/:id/read', notificationController.markAsRead);

export default router;
