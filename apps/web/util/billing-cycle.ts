/**
 * Front-end mirror of the API's `invoiceDueDateForPurchase` (services/api .../billing-cycle.ts),
 * so a card purchase can preview which invoice it lands in before it is saved. All math is UTC to
 * match the server. Keep the two in sync.
 */

/** A UTC date at `day` of (year, month), clamped to the month's last day for short months. */
function clampDay(year: number, month: number, day: number): Date {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const clamped = Math.min(Math.max(day, 1), lastDay);
  return new Date(Date.UTC(year, month, clamped));
}

/**
 * Invoice due date for a manual card purchase (UTC): a purchase on/before `closingDay` lands in the
 * invoice that closes this month, else the next; the due date is the next `dueDay` after that closing.
 * Ex.: closing=25/due=5 → buy 20/Jan ⇒ due 05/Feb; buy 26/Jan ⇒ due 05/Mar.
 */
export function invoiceDueDateForPurchase(
  purchase: Date,
  closingDay: number,
  dueDay: number,
): Date {
  const year = purchase.getUTCFullYear();
  const month = purchase.getUTCMonth();
  const day = purchase.getUTCDate();
  const closingMonth = day <= closingDay ? month : month + 1;
  const dueMonth = dueDay > closingDay ? closingMonth : closingMonth + 1;
  return clampDay(year, dueMonth, dueDay);
}
