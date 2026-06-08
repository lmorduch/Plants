import cron from 'node-cron';
import pool from './db.js';
import { sendPushToAll } from './routes/notifications.js';

/**
 * Runs every day at 8:00 AM.
 * Finds all care schedule items due today or overdue (with notify_enabled = 1)
 * and sends a push notification for each.
 */
export function startCron() {
  cron.schedule('0 8 * * *', async () => {
    console.log('[cron] Checking care schedules...');
    try {
      const [rows] = await pool.execute(`
        SELECT cs.*, p.name AS plant_name
        FROM care_schedules cs
        JOIN plants p ON p.id = cs.plant_id
        WHERE cs.notify_enabled = 1
          AND cs.next_due IS NOT NULL
          AND DATE(cs.next_due) <= DATE_ADD(CURDATE(), INTERVAL cs.notify_days_before DAY)
      `);

      // Group by plant to avoid notification spam
      const byPlant = {};
      for (const row of rows) {
        if (!byPlant[row.plant_id]) byPlant[row.plant_id] = { name: row.plant_name, tasks: [] };
        byPlant[row.plant_id].tasks.push(row.type);
      }

      for (const { name, tasks } of Object.values(byPlant)) {
        const taskList = tasks.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(' & ');
        await sendPushToAll({
          title: `🌿 ${name} needs attention`,
          body: `${taskList} is due today!`,
          icon: '/favicon.svg',
          tag: `care-${name}`,
          data: { url: '/' },
        });
      }

      console.log(`[cron] Sent reminders for ${Object.keys(byPlant).length} plants`);
    } catch (err) {
      console.error('[cron] Error:', err);
    }
  }, { timezone: process.env.TZ || 'America/New_York' });

  console.log('[cron] Daily reminder scheduler started (8:00 AM)');
}
