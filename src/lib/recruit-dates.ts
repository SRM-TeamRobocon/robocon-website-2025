// Date helpers for the recruitment module.
//
// Every recruitment date is a calendar day on campus, not an instant - "today's
// training session", "the day of the exam". Those must be resolved in IST regardless
// of where the server runs, otherwise a session created on the evening of the 9th IST
// lands on the 8th (or the 10th) once the server's clock is UTC.

/**
 * Today's date in the cycle's operating timezone as `YYYY-MM-DD`, matching the `date`
 * column format of `recruit_training_sessions`.
 *
 * `en-CA` is used purely because it formats as ISO `YYYY-MM-DD`; the locale carries no
 * other meaning here.
 */
export function todayInIST(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}
