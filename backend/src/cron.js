// ABOUTME: Daily cron job that sends push notifications for due care schedules.
// ABOUTME: Iterates over all users and sends each user only their own plant reminders.
import cron from 'node-cron';
import pool from './db.js';
import { sendPushToUser } from './routes/notifications.js';

export function startCron() {
  cron.schedule('0 8 * * *', async () => {
    console.log('[cron] Checking care schedules...');
    try {
      const [rows] = await pool.execute(`
        SELECT cs.*, p.name AS plant_name, p.user_id
        FROM care_schedules cs
        JOIN plants p ON p.id = cs.plant_id
        WHERE cs.notify_enabled = 1
          AND cs.next_due IS NOT NULL
          AND DATE(cs.next_due) <= DATE_ADD(CURDATE(), INTERVAL cs.notify_days_before DAY)
          AND p.user_id IS NOT NULL
      `);

      const byUser = {};
      for (const row of rows) {
        if (!byUser[row.user_id]) byUser[row.user_id] = {};
        const byPlant = byUser[row.user_id];
        if (!byPlant[row.plant_id]) byPlant[row.plant_id] = { name: row.plant_name, tasks: [] };
        byPlant[row.plant_id].tasks.push({ type: row.type, notes: row.notes });
      }

      let totalSent = 0;
      for (const [userId, plants] of Object.entries(byUser)) {
        for (const { name, tasks } of Object.values(plants)) {
          const taskList = tasks.map(t => t.type.charAt(0).toUpperCase() + t.type.slice(1)).join(' & ');
          const hint = tasks[0]?.notes ? ` — ${tasks[0].notes}` : '';
          totalSent += await sendPushToUser(Number(userId), {
            title: `🌿 ${name} needs attention`,
            body: `${taskList} is due today!${hint}`,
            icon: '/favicon.svg',
            tag: `care-${name}`,
            data: { url: '/' },
          });
        }
      }

      console.log(`[cron] Sent ${totalSent} reminders across ${Object.keys(byUser).length} users`);
    } catch (err) {
      console.error('[cron] Error:', err);
    }
  }, { timezone: process.env.TZ || 'America/New_York' });

  console.log('[cron] Daily reminder scheduler started (8:00 AM)');
}
