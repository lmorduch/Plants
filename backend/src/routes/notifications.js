// ABOUTME: Push notification routes — subscribe, unsubscribe, and test pushes.
import { Router } from 'express';
import webpush from 'web-push';
import { query } from '../db.js';

const router = Router();

router.post('/subscribe', async (req, res) => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: 'Invalid subscription object' });
  }
  await query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ($1,$2,$3,$4)
     ON CONFLICT (endpoint) DO UPDATE SET user_id=EXCLUDED.user_id, p256dh=EXCLUDED.p256dh, auth=EXCLUDED.auth`,
    [req.userId, endpoint, keys.p256dh, keys.auth]
  );
  res.status(201).json({ success: true });
});

router.delete('/unsubscribe', async (req, res) => {
  const { endpoint } = req.body;
  await query('DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2', [endpoint, req.userId]);
  res.json({ success: true });
});

router.post('/test', async (req, res) => {
  const sent = await sendPushToUser(req.userId, {
    title: '🌿 PlantCare Test',
    body: 'Push notifications are working!',
    icon: '/favicon.svg',
  });
  res.json({ sent });
});

export async function sendPushToUser(userId, payload) {
  const subs = await query('SELECT * FROM push_subscriptions WHERE user_id = $1', [userId]);
  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      );
      sent++;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]);
      }
    }
  }
  return sent;
}

export default router;
