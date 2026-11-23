# Daily DSA: Specifications & Features

Version 1.1.0

## 1. What it is

A website and installable app that gives you a daily DSA problem from LeetCode, in the usual order people learn DSA. It recommends what to revise and what comes next, links straight to the LeetCode problem, and sends a daily reminder notification. It works on computers and phones and runs on free hosting.

## 2. Tech stack

| Layer | Technology | Why |
|---|---|---|
| Runtime | Node.js 20+ (ES modules) | Free on every host, one language for front and back end |
| Web server | Express 4 | Small, well known, stable |
| Database | MongoDB Atlas M0 (free), or a local JSON file | Atlas free tier keeps data across restarts; the JSON file needs no setup for local dev |
| Notifications | Web Push API + VAPID (`web-push` library) | Free and built into browsers, with no Firebase or app store needed |
| Frontend | Plain HTML, CSS and JavaScript modules, no framework, no build step | Fast to load, nothing to compile, easy to change |
| Offline / install | Service Worker + Web App Manifest (PWA) | Installs on Android, iOS, Windows, macOS and Linux |
| Security | Helmet (CSP, HSTS and other headers), express-rate-limit, hashed tokens | Covers the basics a public site needs |
| Performance | gzip compression, cache headers, service-worker caching | Fast on slow mobile networks |
| Tests | Node's built-in `node:test` (36 tests) | No extra test framework |
| CI | GitHub Actions (Node 20 and 22) | Runs the tests on every push |
| Hosting | Render free web service | Free Node hosting with HTTPS |
| Scheduler | cron-job.org (main) + GitHub Actions (backup) + timer inside the server | Wakes the sleeping free server and sends reminders on time |
| Container (optional) | Dockerfile (node:20-alpine, non-root user) | Lets it run on Koyeb, Fly.io, a VPS, etc. |

**Monthly cost: ₹0 / $0.**

## 3. Learning roadmap

- **336 problems in 37 topics and 6 phases:** 87 Easy, 205 Medium, 44 Hard. All are free (non-premium) LeetCode problems. Research and reasoning: [CURRICULUM.md](CURRICULUM.md).
- **Phases and topics:**
  1. *Foundations:* Basics & Complexity → Arrays & Strings → Hashing → Prefix Sum → Matrix → Recursion → Sorting
  2. *Core patterns:* Two Pointers → Sliding Window → Binary Search → Binary Search on the Answer → Linked List → Stack & Queue → Monotonic Stack & Deque → **Mixed Review I**
  3. *Trees, heaps & search:* Binary Trees → BSTs → Heap → Backtracking → Tries
  4. *Graphs:* BFS & DFS → Topological Sort → Union-Find → Shortest Paths & MST → **Mixed Review II**
  5. *Greedy & DP:* Greedy → Intervals → 1-D DP → 2-D DP → Knapsack & LIS → States/Intervals/Trees/Bitmasks
  6. *Specialist:* Bits → Math → String Algorithms → Segment & Fenwick Trees → Data Structure Design → **Capstone: Mixed Review III**
- **Mixed Review** topics are checkpoints with unlabeled problems from earlier phases, so you practise choosing the pattern yourself (interleaved practice).
- Problems go from easy to hard inside each topic.
- Every problem has its LeetCode number, difficulty, a one-line hint (hidden until you ask for it) and a direct link: `https://leetcode.com/problems/<slug>/`.
- You can start from any topic. Earlier topics come after the rest of the roadmap, so nothing is lost.
- At 1 problem a day the roadmap takes about 11 months; at 2 a day, about 5.5 months; at 3 a day, about 4 months. With less time, start from Two Pointers.

## 4. Features

### 4.1 Daily problem ("Today" page)
- Gives 1–5 problems a day (you choose). The day's pick stays fixed, so the notification and the site always show the same problem.
- An unfinished problem stays at the front of the line the next day. Nothing gets skipped by accident.
- **Solve on LeetCode** opens the exact problem in a new tab.
- Each problem can be marked **Solved**, **Solved, revise later** or **Skip** ("I already know this"), and every mark can be undone. An Undo button also appears in the confirmation toast.
- **"Give me one more"** adds a bonus problem once today's goal is done.
- A greeting with your name and the date, a streak counter, and overall progress (x / 336, % done, estimated days left).
- The page refreshes automatically when you come back to it from LeetCode.

### 4.2 Recommendations
- **Revise:** problems you marked "revise later", then spaced repetition. Solved problems come back after 3, 7, 21 and 60 days. Tap **Done** after re-solving.
- **Up next:** the next 3 problems in your roadmap.
- **Stretch goal:** a harder unsolved problem from the topic you're on.

### 4.2a Random extra practice (optional)
- **Off by default.** Turn it on in Settings → Daily plan → *Random extra practice*. When it is off, nothing about it appears on the Today page.
- When it is on, the Today page has an **Extra practice** card. Tap **Give me a random problem** to get a random problem from LeetCode's full problem set, only when you want one.
- **Based on your progress:** problems come from the topics you've already made progress in (for a new user, the topic you're starting with). A problem is only offered if *all* of its LeetCode tags belong to topics you've covered, so it never needs something you haven't learned yet.
- **Difficulty follows progress:** a topic under half done gives mostly Easy problems, a topic past halfway mostly Medium, and a finished topic Medium and Hard.
- Never offers premium problems, roadmap problems, or problems you've already practised.
- Choices for each problem: **Solve on LeetCode**, **Mark solved** (with Undo), **Another one** (skips it), or **Not now** (hides it and records nothing).
- Solved extra problems count toward your streak and heatmap, and show on the Stats page. They never change roadmap progress.
- If LeetCode can't be reached, it offers a roadmap problem you've already solved instead, to practise again.
- Practice history is included in Export/Import and cleared by Reset.

### 4.3 Reminders and notifications
- A **daily push notification** at the time you choose, in your own time zone. Tapping it **opens the LeetCode problem directly**.
- The notification has buttons: **Open on LeetCode** and **Today's plan**.
- An optional **evening nudge** (default 21:00), sent only if today's problem isn't done yet.
- No reminder is sent if you have already finished today's problems.
- At most one reminder and one nudge per day, even if the trigger runs many times or late.
- Works on several devices at once (up to 10 per account). Expired devices are removed automatically.
- **Send a test notification** button in Settings.
- **Calendar reminder (.ics):** a daily repeating event for Google Calendar, Apple Calendar or Outlook. Its link (`/go/<id>`) opens today's LeetCode problem directly. Use it as a backup, or where push notifications aren't available.
- Clear help when notifications are blocked or unsupported, including the iPhone "Add to Home Screen first" step.

### 4.4 Roadmap page
- All 37 topics with progress bars, grouped under phase headings. The topic you're on is marked **You are here**; finished topics get a check mark.
- Expandable topic lists show each problem's number, title (linked to LeetCode), hint and difficulty.
- Change any problem's status from the list (To do / Solved / Revise / Skip), or tap the circle to toggle Solved.
- Search by title, topic or LeetCode number, and filter by difficulty and status.

### 4.5 Stats page
- Current streak, longest streak, problems solved, and days to finish at your pace.
- A 12-week activity heatmap.
- Progress by difficulty (Easy, Medium, Hard) and by topic.
- Counts of problems marked for revision and skipped.

### 4.6 Settings
- **Reminders:** turn push on or off for this device, a master on/off switch, reminder time, evening nudge on/off and time, time zone (detected automatically, can be changed), test notification, calendar reminder.
- **Daily plan:** problems per day (1–5), starting topic, name for the greeting.
- **Appearance:** System, Light or Dark theme.
- **Devices & sync:** show, copy or share your sync link; link this device with a code from another device; make a new link (signs out every other device).
- **Your data:** export progress as JSON, import it, reset progress, sign out of this device, and permanently delete your data.

### 4.7 Accounts (no password)
- Nothing to sign up for. On first visit, a short setup (name, starting topic, problems per day, reminder time) creates an anonymous account.
- The account is a random ID plus a secret token (the **sync code**). Only a SHA-256 hash of the token is stored on the server.
- Opening the sync link on another device shows the same progress there.

### 4.8 Mobile and desktop
- Responsive layout: a top navigation bar on desktop and a bottom tab bar on phones. Touch targets are at least 44 px, and the layout handles notches and safe areas. No sideways scrolling on a 390 px-wide phone (checked).
- **Installable app (PWA):** an "Install app" button appears where the browser supports it. Includes app icons (with a maskable version for Android), an Apple touch icon, a splash colour and home-screen shortcuts (Today, Roadmap).
- **Works offline:** the app shell is cached, and the last data you loaded stays viewable offline, with an "offline" banner.

### 4.9 Basics every website should have
- Page titles, a meta description, Open Graph tags, a theme colour, a favicon and `robots.txt`.
- A custom 404 page (both for server URLs and for in-app routes).
- Clear error messages, a "Try again" option, loading spinners and toast messages.
- Accessibility: semantic HTML, a skip-to-content link, ARIA labels, keyboard focus outlines, screen-reader-only labels, support for the reduced-motion setting, and readable colour contrast in both themes.
- Light and dark mode, following the system setting or your own choice.
- A `/healthz` endpoint for uptime checks.
- An About page covering how it works, install steps, privacy and FAQ.

## 5. Security and privacy
- Content-Security-Policy allows only same-origin scripts and styles, with no inline scripts or third-party code. HSTS and other headers come from Helmet, and the site can't be embedded in other pages.
- Rate limits: 600 API requests per 15 minutes per IP, and 20 new accounts per hour per IP.
- Every input is checked: settings, push subscriptions, import files, and a 200 KB request-size limit.
- Tokens are stored only as SHA-256 hashes and compared in constant time.
- The cron endpoint is protected by `CRON_SECRET` and turned off if no secret is set.
- A per-user lock stops two devices from overwriting each other's changes.
- Data collected: settings, problem statuses and dates, and push subscription addresses. No email, password, tracking or ads.

## 6. API reference

Requests that need an account send the header `Authorization: Bearer <userId>.<token>`.

| Method | Path | Account needed | Purpose |
|---|---|---|---|
| GET | `/healthz` | – | Health check |
| GET | `/api/config` | – | Public push key, app URL, problem count |
| GET | `/api/curriculum` | optional | Topics and problems (with your statuses if signed in) |
| POST | `/api/users` | – | Create an account → returns the sync code |
| GET | `/api/me` | ✓ | Profile and settings |
| PATCH | `/api/me/settings` | ✓ | Update settings |
| POST | `/api/me/sync-code/rotate` | ✓ | New sync code |
| GET | `/api/me/export` | ✓ | Download progress |
| POST | `/api/me/import` | ✓ | Restore progress |
| POST | `/api/me/reset` | ✓ | Clear progress |
| DELETE | `/api/me` | ✓ | Delete the account |
| GET | `/api/today` | ✓ | Today's problems, recommendations, streak, progress |
| POST | `/api/today/bonus` | ✓ | Add one more problem today |
| POST | `/api/problems/:slug/status` | ✓ | `solved` / `revise` / `skipped` / `todo` (undo) / `reviewed` |
| GET | `/api/stats` | ✓ | Full statistics |
| GET | `/api/practice` | ✓ | Random practice: current problem and counts |
| POST | `/api/practice/next` | ✓ | Get a random problem (skips the current one); 409 if the feature is off |
| POST | `/api/practice/result` | ✓ | `{ result: "solved" \| "skipped" }` for the current problem |
| POST | `/api/practice/undo` | ✓ | Undo the last result |
| POST | `/api/practice/clear` | ✓ | Hide the current problem without recording it |
| POST | `/api/push/subscribe` | ✓ | Register this device for notifications |
| POST | `/api/push/unsubscribe` | ✓ | Remove a device |
| POST | `/api/push/test` | ✓ | Send a test notification |
| GET/POST | `/api/cron/reminders` | cron secret | Send any reminders that are due (call every 5–15 min) |
| GET | `/go/:userId` | – | Redirect to today's LeetCode problem |

## 7. Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | 3000 | Port to listen on |
| `APP_URL` | Render URL or localhost | Public address used in links |
| `MONGODB_URI` | empty → JSON file | MongoDB Atlas connection string |
| `MONGODB_DB` | `daily_dsa` | Database name |
| `DATA_DIR` | `./data` | Folder for the JSON-file store |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | generated once and saved | Web Push keys |
| `VAPID_SUBJECT` | `mailto:admin@example.com` | Contact address for push services |
| `CRON_SECRET` | empty → cron endpoint off | Secret for the reminder trigger |
| `INTERNAL_SCHEDULER_MINUTES` | 5 | Timer inside the server (0 = off) |

## 8. Browser and device support
- **Full support, including push:** Chrome, Edge, Opera and Samsung Internet (desktop and Android); Firefox (desktop and Android); Safari on macOS 13+.
- **iPhone/iPad:** iOS/iPadOS 16.4+ once added to the Home Screen. Older versions can use the calendar reminder.
- Everything except push works in any modern browser.

## 9. Known limits of the free setup
- Render's free server sleeps when idle. The 10-minute cron ping keeps it awake; if it does sleep, the first visit takes about 30–60 seconds.
- Reminders arrive within one cron interval of the chosen time (for example, within 10 minutes).
- Some Android battery savers delay notifications; the calendar reminder is a dependable backup.
- The app doesn't read your LeetCode account; you mark problems yourself.
- MongoDB Atlas M0 has 512 MB of storage, enough for tens of thousands of users.

## 10. Testing
- `npm test` runs 26 automated tests: daily pick, carry-over, daily goal, starting topic, bonus problem, streaks, undo, spaced repetition, recommendations, reminder timing across time zones, the notification link, and stats. API tests cover security headers, login checks, the full daily flow, settings checks, sync and rotation, export and import, push subscribe/test, the cron secret, sending each reminder only once a day, removing expired subscriptions, the `/go` redirect, and account deletion.
- `npm run check:curriculum` checks the roadmap for duplicates and missing fields.
- A headless Chrome walkthrough (onboarding → mark solved → bonus → roadmap search → stats → settings → about → 404, desktop and mobile, light and dark) found no console errors and no sideways scrolling.
