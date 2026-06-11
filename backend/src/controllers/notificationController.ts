import { Response } from 'express';
import { AuthedRequest } from '../middleware/auth';
import { updateUser } from '../services/userStore';
import { refreshEpisodeNotifications } from '../services/notificationService';

// GET /api/user/notifications?refresh=1
export const listNotifications = async (req: AuthedRequest, res: Response) => {
  const user = req.user!;
  if (req.query.refresh) {
    try {
      await refreshEpisodeNotifications(user);
    } catch {
      // non-fatal: serve what we have
    }
  }
  res.json({
    success: true,
    data: {
      notifications: user.notifications,
      unread: user.notifications.filter((n) => !n.read).length,
    },
  });
};

// POST /api/user/notifications/:id/read
export const markRead = (req: AuthedRequest, res: Response) => {
  const user = req.user!;
  const notif = user.notifications.find((n) => n.id === req.params.id);
  if (notif) {
    notif.read = true;
    updateUser(user);
  }
  res.json({ success: true });
};

// POST /api/user/notifications/read-all
export const markAllRead = (req: AuthedRequest, res: Response) => {
  const user = req.user!;
  user.notifications.forEach((n) => (n.read = true));
  updateUser(user);
  res.json({ success: true });
};

// DELETE /api/user/notifications/:id
export const deleteNotification = (req: AuthedRequest, res: Response) => {
  const user = req.user!;
  user.notifications = user.notifications.filter((n) => n.id !== req.params.id);
  updateUser(user);
  res.json({ success: true });
};

// DELETE /api/user/notifications
export const clearNotifications = (req: AuthedRequest, res: Response) => {
  const user = req.user!;
  user.notifications = [];
  updateUser(user);
  res.json({ success: true });
};
