# Brite Spark — Reminder That Reaches (prototype)

This prototype implements the core reminder logic and mocks for channels (SMS, voice, email). It is intentionally small and runnable from a clean clone.

Quick start:

1. Open a terminal in the project root `bs-reminder-app`.
2. Install dependencies:

```bash
npm install
```

3. Run the dev server:

```bash
npm run dev
```

4. Run the reminder job (HTTP):

```bash
curl http://localhost:3000/api/sendReminders
```

Notes:
- Data lives in `data/contacts.json` and `data/appointments.json`.
- The app enforces quiet hours, opt-outs, language selection, channel fallback with a stopping rule, and avoids duplicate sends when one contact point serves multiple residents.
- To switch to Postgres and Prisma: replace the JSON data layer with a Prisma client and set `DATABASE_URL` accordingly. See DECISIONS.md for guidance.

Database integration:
- To seed data from the provided folder (the one you attached), run:

```bash
node scripts/seed-from-csv.js "c:\\Users\\HP\\Downloads\\7\\7\\07-reminder-that-reaches"
```

- If you set `DATABASE_URL` to a Postgres connection string, the seed script will attempt to insert data into Postgres tables (`contacts`, `appointments`). Without `DATABASE_URL` it will write JSON files into `data/` and the runner will use them.
