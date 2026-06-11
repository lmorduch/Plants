export function getCurrentSeason() {
  const month = new Date().getMonth() + 1; // 1–12, northern hemisphere
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'fall';
  return 'winter';
}

// Returns the schedule's interval for the current season, falling back to interval_days.
export function effectiveDays(schedule) {
  const key = `${getCurrentSeason()}_days`;
  return schedule[key] ?? schedule.interval_days;
}
