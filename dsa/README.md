# Daily DSA

One LeetCode problem a day, in a proper learning order, with a daily reminder notification that opens the problem straight on LeetCode. Works on phone and computer and can be installed as an app (PWA). Runs completely free.

Full specs and feature list: [docs/SPECIFICATIONS.md](docs/SPECIFICATIONS.md)

## Run it on your computer

Needs Node.js 20 or newer.

```bash
cd dsa
npm install
cp .env.example .env      # then set CRON_SECRET to any random text
npm run dev               # http://localhost:3000
npm test                  # 26 automated tests
```

Locally, data is kept in `dsa/data/db.json`. Push notifications work on `localhost` in Chrome, Edge and Firefox.

## Put it online for free (about 15 minutes)

Free stack: **Render** (web server) + **MongoDB Atlas** (database) + **cron-job.org** (daily trigger). None of them needs a credit card.

### 1. Database: MongoDB Atlas (free M0)
1. Sign up at https://www.mongodb.com/cloud/atlas/register and create a **free M0** cluster.
2. *Database Access* → add a user with a password.
3. *Network Access* → add `0.0.0.0/0` (Render's free tier has no fixed IP).
4. *Connect* → *Drivers* → copy the connection string, e.g.
   `mongodb+srv://user:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`

### 2. Web server: Render (free)
1. Push this repo to GitHub.
2. At https://dashboard.render.com choose **New → Blueprint** and pick the repo. It reads [`render.yaml`](../render.yaml) at the repo root.
   (Or **New → Web Service**: Root Directory `dsa`, Build `npm ci --omit=dev`, Start `npm start`, plan **Free**.)
3. Set the environment variables:
   | Variable | Value |
   |---|---|
   | `MONGODB_URI` | the Atlas connection string |
   | `CRON_SECRET` | generated automatically by the Blueprint (or any long random text) |
   | `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | optional: from `npm run vapid`. If empty, keys are made once and saved in the database. |
   | `VAPID_SUBJECT` | `mailto:you@example.com` |
   | `APP_URL` | optional: Render fills in its own URL |
4. Deploy, then open `https://<your-app>.onrender.com`.

### 3. Daily trigger: cron-job.org (free)
Render's free server sleeps after 15 minutes without visitors, so an outside service wakes it to send reminders.
1. Sign up at https://cron-job.org and create a cron job:
   - URL: `https://<your-app>.onrender.com/api/cron/reminders?key=<CRON_SECRET>`
   - Schedule: **every 10 minutes**
   - Request timeout: the longest available (the first call may wake the server)
2. Save. Each user gets their reminder at their own time, in their own time zone, at most once a day.

Pinging every 10 minutes also keeps the server awake. One always-on free service uses about 730 of Render's 750 free hours a month, so it fits.

**Backup trigger (optional):** the GitHub Actions workflow [`dsa-reminders.yml`](../.github/workflows/dsa-reminders.yml) calls the same endpoint every 15 minutes. Add repository secrets `APP_URL` and `CRON_SECRET` to turn it on.

### 4. On your phone
- **Android:** open the site in Chrome → menu → *Install app* → open it → *Turn on reminders*.
- **iPhone/iPad (iOS 16.4+):** open in Safari → Share → *Add to Home Screen* → open it from the home screen → *Turn on reminders*.
- **Use the same progress on phone and laptop:** Settings → *Devices & sync* → copy the sync link → open it on the other device.

## Project layout

```
dsa/
├── server/
│   ├── index.js            start-up, internal scheduler, graceful shutdown
│   ├── app.js              Express app, security headers, static files, /go shortcut
│   ├── config.js           environment variables
│   ├── planner.js          daily pick, revision, streaks, stats, reminder rules (pure functions)
│   ├── scheduler.js        sends due reminders (safe to call any number of times)
│   ├── push.js             Web Push (VAPID) sending
│   ├── lock.js             per-user lock so parallel requests can't overwrite each other
│   ├── routes/api.js       REST API + validation
│   ├── store/              MongoDB store and local JSON-file store
│   └── data/curriculum.js  the 182-problem roadmap
├── public/                 PWA frontend (no build step)
│   ├── index.html, manifest.webmanifest, sw.js, 404.html, robots.txt
│   ├── css/styles.css
│   ├── js/app.js, views.js, api.js, notifications.js, ui.js
│   └── icons/
├── scripts/                generate-icons, generate-vapid, check-curriculum
├── tests/                  planner + API tests (node:test)
├── Dockerfile              optional, for Docker hosts
└── .env.example
```

## Changing the roadmap

Edit [`server/data/curriculum.js`](server/data/curriculum.js): each line is `p(leetcodeNumber, 'Title', 'slug', 'E'|'M'|'H', 'hint')`. The slug is the part of the LeetCode URL after `/problems/`. Run `npm run check:curriculum` afterwards.
