import { Router } from 'express';
import webpush from 'web-push';
import pool from '../db.js';

const router = Router();

// POST /api/notifications/subscribe
router.post('/subscribe', async (req, res) => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: 'Invalid subscription object' });
  }

  await pool.execute(
    `INSERT INTO push_subscriptions (endpoint, p256dh, auth)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE p256dh = VALUES(p256dh), auth = VALUES(auth)`,
    [endpoint, keys.p256dh, keys.auth]
  );

  res.status(201).json({ success: true });
});

// DELETE /api/notifications/unsubscribe
router.delete('/unsubscribe', async (req, res) => {
  const { endpoint } = req.body;
  await pool.execute('DELETE FROM push_subscriptions WHERE endpoint = ?', [endpoint]);
  res.json({ success: true });
});

// POST /api/notifications/test  — send a test push to all subscribers
router.post('/test', async (req, res) => {
  const sent = await sendPushToAll({
    title: '🌿 PlantCare Test',
    body: 'Push notifications are working!',
    icon: '/favicon.svg',
  });
  res.json({ sent });
});

export async function sendPushToAll(payload) {
  const [subs] = await pool.execute('SELECT * FROM push_subscriptions');
  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      );
      sent++;
    } catch (err) {
      // Remove expired/invalid subscriptions
      if (err.statusCode === 404 || err.statusCode === 410) {
        await pool.execute('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
      }
    }
  }
  return sent;
}

export default router;
