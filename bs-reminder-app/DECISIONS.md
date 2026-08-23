DECISIONS — Reminder That Reaches (prototype)

- Channel fallback: sequence chosen sms -> voice -> email. Stopping rule: stop on first successful delivery, or stop if a channel reports a non-silent failure (explicit block/bounce).
- Quiet hours and opt-outs: enforced centrally in `pages/api/sendReminders.ts` in `isQuietHours` and opt-out checks. Job-level enforcement ensures new code paths cannot bypass.
- Language selection: use resident `language` field to choose a simple template. Templates kept as strings for clarity.

Regulatory compliance (Direction CR-2026/11):
- Implemented rolling 7-day contact limit: no resident will be sent more than two contact attempts in any rolling seven-day window. The system checks the ContactAttempt table for the resident and withholds further contact when the limit is reached.
- When withholding occurs due to the limit, the system records a `ContactAttempt` with `result='withheld-regulation'` and `counted=false` so the decision and appointment are auditable (per Direction 4.1 and 5.1).
- All outbound attempts (successful or failed) are recorded to `ContactAttempt` and counted, matching the regulator's definition that attempts count whether delivered or not.
- residents with opt-outs (strictly enforced)
