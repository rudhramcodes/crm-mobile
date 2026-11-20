# Rudhram CRM — Mobile App Plan (React Native + NativeWind)

Source analysed: `/Users/faizalshaikh/Desktop/Faizal/CRM` (Express + MongoDB server, React web). The README there is outdated; this plan is built from the code itself.

---

## 0. What the CRM actually is

- **Business:** one company running **7 ventures/brands**: `panigrahna (PG)`, `aghori (AG)`, `house_of_joggi (HG)`, `damrru (DM)`, `tandavs (TD)`, `kapaalik (KP)`, `kalyannam (KL)`. Mostly event/wedding photo & video production (crew, raw footage, deliverables, drive links).
- **Roles:** `super_admin`, `admin`, `manager`, `employee`, `client`. Extra per-user switches:
  - `readOnlyModules: ['leads','clients']` → can view, cannot write (server: `middleware/readOnlyModules.js`)
  - employees see Leads/Clients only if department = **sales** (or read-only granted)
  - payroll menu only if `canAccessPayroll(user)`
  - `mustChangePassword`, `isEmailVerified`, `onboardingCompleted` (client)
- **Apps inside the web app:** Staff CRM, **Client Portal** (`/portal`), **Freelancer apply form** (`/freelancer-portal`, public), **Inquiry form** (`/inquiry/:brand`, public).
- **Realtime:** Socket.io (`handshake.auth.token`), events `notification:new`, `notification:unread`, `notification:read`, `entity:updated`, `join:room`/`leave:room`.
- **Cron jobs (server, nothing to build on mobile — they just produce notifications):** invoice overdue (00:00), task due soon (06:00), meeting reminder (every 30 min), notification cleanup (Sun 03:00), attendance auto clock-out (every min), auto absent (23:59), auto end breaks (every 5 min).
- **Files:** Cloudinary (local fallback). Project chat images ≤5 files, 10 MB each; lead import 5 MB.
- **PDFs are made on the server** (quotation, invoice, receipt, payslip). Mobile only downloads + shares them. No PDF code in the app.

---

## 1. Key decisions

| Decision        | Choice                                                        | Why                                                                                                                                                                    |
| --------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework       | **Expo (latest SDK) + Expo Router**                           | Android + iOS from one codebase, EAS builds, OTA updates, all native modules we need are first-party                                                                   |
| Styling         | **NativeWind** (Tailwind classes)                             | Web already uses Tailwind, same mental model                                                                                                                           |
| Language        | **JavaScript** (same as web)                                  | Lets us copy web `constants/index.js`, zod schemas and RTK Query services almost as-is. (Smaller option: TypeScript is nice but costs a rewrite of everything copied.) |
| Data            | **Redux Toolkit + RTK Query** (same as web)                   | Web `client/src/services/*Api.js` files can be copied; only `baseQuery` changes (Bearer token instead of cookies)                                                      |
| Forms           | react-hook-form + zod (same as web)                           | Reuse validation rules                                                                                                                                                 |
| One app or two? | **One app**, role-based route groups `(staff)` and `(client)` | Same login endpoint, same API; client role just lands in a different tab bar                                                                                           |

### Libraries (all standard, no custom wrappers)

| Need                                                        | Package                                                      |
| ----------------------------------------------------------- | ------------------------------------------------------------ |
| Navigation                                                  | `expo-router`                                                |
| Styles                                                      | `nativewind`, `tailwindcss`                                  |
| Animation / gestures                                        | `react-native-reanimated`, `react-native-gesture-handler`    |
| Bottom sheets (filters, drawers, quick add)                 | `@gorhom/bottom-sheet`                                       |
| Fast lists                                                  | `@shopify/flash-list`                                        |
| Secure token storage                                        | `expo-secure-store`                                          |
| State + API                                                 | `@reduxjs/toolkit`, `react-redux`                            |
| Forms                                                       | `react-hook-form`, `@hookform/resolvers`, `zod`              |
| Realtime                                                    | `socket.io-client`                                           |
| Push notifications                                          | `expo-notifications`                                         |
| GPS clock-in                                                | `expo-location`                                              |
| Camera / gallery (chat images, avatar, freelancer photo)    | `expo-image-picker`, `expo-image`                            |
| PDF download + share (invoice, quotation, receipt, payslip) | `expo-file-system`, `expo-sharing`                           |
| Open meeting links, Zoho OAuth                              | `expo-web-browser`, `expo-linking`                           |
| Call / WhatsApp / email buttons                             | `Linking` (built in)                                         |
| Calendars (attendance, tasks, meetings)                     | `react-native-calendars`                                     |
| Charts (dashboard, reports)                                 | `victory-native` (or `react-native-gifted-charts`)           |
| Dates                                                       | `date-fns` (same as web)                                     |
| Phone validation                                            | `libphonenumber-js` (same as web)                            |
| Haptics                                                     | `expo-haptics`                                               |
| Notification sound                                          | `expo-audio` (reuse `client/public/sounds/notification.mp3`) |
| Biometric unlock (suggestion)                               | `expo-local-authentication`                                  |
| Builds / OTA                                                | `eas-cli`, `expo-updates`                                    |

---

## 2. Backend changes needed (small, do these first)

1. **Refresh token in body**: already started in your uncommitted `auth.controller.js` change. **Read §8 first.** One refresh token per user means mobile and web will log each other out.
2. **Push tokens**: add `pushTokens: [String]` to User, `POST /api/auth/push-token` and `DELETE /api/auth/push-token`. In `notification.service.js` (where `notification:new` is emitted, ~line 96) also send an Expo push to the recipient's tokens. One function, uses `fetch` to `https://exp.host/--/api/v2/push/send`. No new dependency.
3. **Nothing else.** Every other endpoint already accepts `Authorization: Bearer` (`middleware/auth.js`) and the socket already takes `auth.token`.

---

## 3. Folder structure

```
crm-mobile/
  app/
    _layout.jsx                 # Redux Provider, socket, push, theme
    (auth)/login.jsx, forgot-password.jsx, reset-password.jsx, verify-email.jsx, change-password.jsx, accept-invite.jsx
    (staff)/(tabs)/_layout.jsx  # tab bar built from role
    (staff)/(tabs)/home.jsx, tasks.jsx, attendance.jsx, inbox.jsx, more.jsx
    (staff)/leads/..., clients/..., meetings/..., projects/..., quotations/..., invoices/...,
            payments/..., reports.jsx, payroll/..., freelancers/..., users/..., settings/...
    (client)/(tabs)/home.jsx, projects.jsx, meetings.jsx, invoices.jsx, profile.jsx
    (client)/onboarding.jsx, guide.jsx
  src/
    services/      # copied from web client/src/services/*Api.js
    store/         # authSlice (SecureStore instead of localStorage)
    constants/     # copied from web client/src/constants/index.js
    components/    # Button, Input, Select(sheet), Badge, Avatar, EmptyState, Skeleton, ConfirmSheet, DateField, ...
    hooks/         # useAuth, useRole, useSocket
    utils/         # formatters (copy from web utils)
```

---

## 4. Design direction (taste-skill rules applied to mobile)

- **Show the real thing on every screen**: the real list, the real numbers. No decorative empty dashboards. Each screen has **one main action**, as a bottom button or a FAB (e.g. Tasks → "+ Task", Attendance → "Clock in").
- **Per-venture accent colour** (client portal is already venture-branded). Neutral base, one accent. **No violet/lavender.**
- **Motion with purpose**: buttons press (scale 0.97 + haptic), cards lift on press, the live attendance timer ticks, list items swipe to reveal actions. Respect _Reduce Motion_.
- **Accessibility**: 44 pt minimum tap targets, labels on every icon button, dynamic font size, contrast AA, dark mode from day one (NativeWind `dark:`).
- **Real icons**: `lucide-react-native` (same icon names as web `lucide-react`). Real brand icons for WhatsApp, Google Meet and Zoho on their buttons.
- **Mobile patterns instead of web ones**: tables → cards; modals → bottom sheets; sidebar → tab bar + "More"; ⌘K command palette → global search screen; hover → long-press menus; Kanban drag → horizontal stage columns + long-press "Move to…" sheet.

---

## 5. Module-by-module build order

Order = what staff use most on a phone first (attendance, tasks), then sales, then finance, then client portal.
Tags: **[Port]** rebuild as on web · **[Native]** better on phone · **[Web-only?]** suggested to keep on web (you decide).

### M0 — Project setup (day 1)

- [x] Expo SDK 58 + Expo Router (routes in `src/app/`), JavaScript
- [x] NativeWind 4 + tailwind config; colour tokens + Manrope/Bricolage fonts from web
- [x] `app.json`: name, bundle ids (`com.rudhram.crm`), icons/splash from `client/public/rudhram-logo.png`, permissions text (location, camera, photos, notifications)
- [x] `.env`: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SOCKET_URL`
- [x] Copy `constants/index.js`, `utils/` formatters, all `services/*Api.js` from web (`api.js` rewritten for Bearer + body refresh token)
- [x] Base UI kit: Text/Heading, Screen, Pressable, Button, Input, Badge, Avatar, Card, EmptyState, Skeleton (sheet-based Select/ConfirmSheet/DateField come with the first module that needs them)
- [x] EAS: `eas init` done (projectId in app.json), `eas.json` added
- [ ] (you) `eas build --profile development` for a dev client (needed for Face ID on iOS, push, location)

### M1 — Auth & session

- [x] Login (email + password) **[Port]**
- [x] Store `accessToken` + `refreshToken` in SecureStore; `baseQuery` adds `Authorization: Bearer`; on 401 → **one** shared refresh call, then retry (two parallel refreshes would invalidate each other) **[Native]**
- [x] `GET /auth/me` on app start → route by role (`client` → `(client)`, others → `(staff)`)
- [x] Forgot password, reset password (deep link `crm://reset-password?token=`) **[Port]**
- [x] Email verification: OTP screen (`/auth/verify-email-otp`), resend, "verify your email" banner **[Port]**
- [x] Forced change password when `mustChangePassword` **[Port]**
- [x] Client invite accept (set password) via deep link **[Port]**
- [x] Logout (`/auth/logout`, clear SecureStore, disconnect socket, remove push token)
- [x] **Suggestion:** Face ID / fingerprint unlock after first login **[Native]**

### M2 — App shell, notifications, realtime

- [x] Tab bar per role:
  - admin/super_admin/manager: Home · Tasks · Attendance · Inbox · More
  - employee: Home · Tasks · Attendance · Inbox · More (Leads/Clients inside More only if sales or read-only)
  - client: Home · Projects · Meetings · Invoices · Profile
- [x] "More" screen = web sidebar groups (CRM & Pipeline, Operations, Financials, Administration), same role filter as `layouts/Sidebar.jsx` (`NAV_ITEMS`, `payrollOnly`, sales check, `readOnlyModules`)
- [ ] Hide write buttons when module is in `readOnlyModules` → done per module, as each one adds write buttons (helper ready: `canSeeNavItem` in `utils/access.js`)
- [x] Socket connect with token; listen `notification:new` / `notification:unread`
- [x] `entity:updated` → invalidate RTK tags (`useEntityRoom`): comes with the first detail screen, which joins its `entity:id` room (M5 Tasks)
- [x] Notifications list: filters (read/unread, date), mark read, mark all read, delete, pagination, unread badge on tab **[Port]**
- [x] Notification types and deep links: task_assigned, lead_assigned, lead_created, lead_converted, meeting_scheduled, meeting_reminder, invoice_paid, invoice_overdue, payment_received, project_assigned, project_chat, project_stage_reverted, project_status_change, mention, contract_expiry
- [x] **Push notifications** (needs backend §2.2); tapping one opens the right screen **[Native]**
- [x] Notification sound on/off (setting) **[Port]**
- [x] Global search (replaces command palette) **[Native]**
- [x] Pull-to-refresh everywhere, skeleton loaders, empty states, error retry, offline banner

### M3 — Dashboards

- [x] **Admin/manager overview** (`GET /dashboard`): total leads, won deals, conversion, revenue (excl. cash) + cash collected separately, pending payments, overdue, active clients, upcoming meetings, lead sources, pipeline, revenue chart, recent activity **[Port]**
- [x] **Venture dashboard** (`GET /dashboard/venture/:brand`): brand switcher, per-brand metrics, comparison **[Port]**
- [x] **Employee dashboard** (`GET /dashboard/employee`): my tasks, completed count, upcoming meetings, attendance card, quick links (Tasks Hub, Meetings, Payslips) **[Port]**
- [x] Attendance clock card on Home (same as web header pill) **[Native]**
- (note) Overview has no "won deals" / "upcoming meetings" tiles: `GET /dashboard` doesn't return them (web doesn't show them either). Employee work calendar comes with M4 "My calendar".

### M4 — Attendance (highest mobile value)

Employee:

- [x] Clock in with **GPS** (`expo-location`, server resolves area/office) + WFH toggle; shows "Cannot clock in" reason (holiday, leave, already out, ...) **[Native]**
- [x] Late detection (shift grace period), multiple sessions per day
- [x] Live timer, break start/end, break history **[Port]**
- [x] Clock out → confirmation sheet + summary (work minutes, breaks, overtime) **[Port]**
- [x] My calendar month view with colours: present, absent, half_day, wfh, leave, holiday, weekend; day detail sheet (sessions, breaks, locations, events) **[Port]**
- [x] My stats (attendance rate, late arrivals)
- [x] Regularization request (date, reason, clock-in/out time, break minutes) + my request status **[Port]**
- [x] Leaves: apply (sick, casual, maternity, paternity; date range), balance (casual 12/yr accrues 1 per month, sick 5), "exceeds balance" error, my leave list **[Port]**
- [x] Holidays list (national / company / optional)
- [x] Clock reminders now come from the **server** as push (`CRM/server/src/jobs/clockReminder.job.js`), so they arrive even if the app is never opened: 9:50 "Time to clock in", 10:05 "You haven't clocked in yet" (Mon-Sat, skips holiday/leave/clocked in), and "Clocked out automatically" when the auto clock-out runs at shift end. Times are fixed for now. Test: `node scripts/sendClockReminder.mjs in|late` (server). Needs a development build on Android.

Admin/manager:

- [x] Today overview: present, absent, on leave, late (`/overview-stats`) **[Port]**
- [x] Attendance list with filters (employee, status, date range), detail, override edit with reason, manual entry (incl. WFH, reset sessions) **[Port]**
- [x] Regularization approvals (approve / reject with required reason) **[Port]**
- [x] Leave approvals (approve / reject with comment) **[Port]**
- [x] Reports daily / weekly / monthly (view) **[Port]**; Excel/PDF export → **[Web-only]** (screen says so)
- [x] Shifts CRUD (name, start, end, grace, default, active), Holidays CRUD **[Port]** (small forms)
- [x] Bulk import attendance → **[Web-only]**, not on mobile
- (note) Shortcuts: records list shows newest 100, reports first 50 records (summary covers all), leaves newest 50. Records/reports/shifts screens rely on the server's role checks (links only show for leads/admins).

### M5 — Tasks

- [x] Views: **My Day** (personal focus), list, **Kanban** (todo / in_progress / review / done), calendar **[Port]**
- [x] Filters: member, priority, project, status, search (title, description, tags); watching list **[Port]**
- [x] Quick add (one line, Enter) + full form: title, description, assignee*, project, milestone, due date*, start date, estimated hours, priority (low/medium/high/urgent), initial status, tags, recurring (daily/weekly/monthly) **[Port]**
- [x] Task detail sheet: edit title/description inline, status, priority, assignee, reschedule
- [x] Subtasks (needs parent assignee + deadline first), checklist (add, tick, remove: admin only), comments (clients can comment too), dependencies (blocked by), watch/unwatch, tags add/remove, activity log
- [x] Time tracking: manual log (hours ≥ 0.25) + **stopwatch** (≥1 min); keep stopwatch running in background via saved start time **[Native]**
- [x] Rule: **only the reviewer can mark Done** (the creator, unless review was handed over); everyone else sends it for review **[Port]**
- [x] Bulk select → status / priority / delete; reorder **[Port]**
- [x] Team workload / analytics (insights sheet) **[Port]**
- [x] Export CSV → share sheet **[Native]**; keyboard shortcuts → skip on mobile
- [x] Swipe right = done/review, swipe left = reschedule **[Native]**
- Shortcuts taken (M5): lists load the first 100 tasks; the project picker shows the first 50 projects; Kanban moves cards with ← → ↑ ↓ buttons, not drag; the stopwatch is saved on the device only (not synced across devices).

- [x] Roles: who can see, change, approve and delete, the same in the app and on the server (`server/src/modules/tasks/taskRules.js`), with tests per role. Full table and who gets which notification: [TASKS-FLOW.md](TASKS-FLOW.md) section 6.
- [x] Owner + helpers, Teams, "copy for each person", workload hint in the people picker, one-line quick add (`Edit teaser @Rahul tomorrow 5pm !high #edit`) (T4)
- [x] Polish pass (Nov 2026): List/Board/Calendar open on unfinished tasks (employees: their own), bulk edits skip tasks you can't change and say how many, no tick or swipe on tasks you're not on, live refresh on task notifications and when the app comes back, "This task is gone" for deleted tasks, chat shows the latest 10 with "Show earlier" and confirms before deleting, log time for yesterday, clearable start date, helpers counted in workload.
- Plan: the full tasks & projects flow is in [TASKS-FLOW.md](TASKS-FLOW.md), phases T1–T6. **Done:** T1 (notifications), T2 (review flow), T3 (task chat with photos and files), T4 (people, teams, quick add), and the simple flow from T5. **Next:** the rest of T5 (stale-task nudge, daily email, auto milestone, "Mute this task"), then T6 (one task system + the Projects page, M6).
- Known gap (kept on purpose): review can be handed to the task's own owner, who can then approve their own work.

### M6 — Projects

- [ ] List + Kanban by SOP stage (brief → planning → execution → review → delivered, progress 0/20/50/80/100), filters (stage, priority, venture, search), stats **[Port]**
- [ ] Create/edit: title, client (create a client inline), venture, priority, status, budget + currency, start/deadline (deadline change needs a reason), team members, tags, description **[Port]**
- [ ] Stage bar: move stage with a reason sheet, stage history, revert handling, legacy "needs SOP migration" notice **[Port]**
- [ ] Quality Check (admin): scope complete, files correct, client commitments met, no open blockers **[Port]**
- [ ] Closing note (delivered what, pending items); Delivered needs QC + closing note + all deliverables **[Port]**
- [ ] Milestones (add, status, due), project tasks (add/edit/remove, "Open in Tasks Hub")
- [ ] Deliverables tracker: title, category (photo/video/others), details, status (pending → in_progress → ready → delivered), Google Drive link (opens in app) **[Port]**
- [ ] Inward data tracking: raw photos/videos received, source, storage location (e.g. HDD 02), status (pending / received / partially_received / verified), custom fields **[Port]**
- [ ] Team deployment: crew counts (photographers, videographers, cinematographers, drone pilots, same-day editors, editors, others), crew members incl. **freelancers**, custom details **[Port]**
- [ ] Project chat: text, **images from camera/gallery** (≤5, 10 MB), **@mentions**, delete own message; realtime **[Native]**
- [ ] Activity log, image viewer (pinch zoom, rotate) **[Native]**

### M7 — Meetings

- [ ] List + calendar view; filters: search, status, venture, client, date range **[Port]**
- [ ] Create/edit: title, date, start/end (end after start), venture, related lead / client / project, attendees, location, video link, recurrence (none/daily/weekly/monthly + count) **[Port]**
- [ ] Generate **Zoho Meeting / Google Meet** link, regenerate, **Join** (opens app/browser) **[Native]**
- [ ] Detail: status change (scheduled/completed/cancelled), discussion notes (employees can edit), recording link
- [ ] Action items: add, assignee, deadline, done, remove, **convert to task** (pick project) **[Port]**
- [ ] Delete single / whole recurring series
- [ ] **Suggestion:** "Add to phone calendar" button **[Native]**

### M8 — Leads (sales)

- [x] List + Kanban (new, contacted, meeting_scheduled, proposal_sent, won, lost), stats per stage **[Port]**
- [x] Filters: search (name/email/company), status, source, venture; unread-lead badge (`isRead`)
- [x] Create: full name*, email*, phone\*, company, venture, source (google_ads, referral, instagram, linkedin, website, email, call, other), assigned rep (**currently hard-wired to "Palak Gupta"** on web), follow-up date, notes **[Port]**
- [x] Detail: notes timeline (author + role), change stage, **lost needs a reason and must be contacted first**, community-group rule before marking new leads, convert to client, copy client ID **[Port]**
- [x] One-tap **Call / WhatsApp / Email** **[Native]**
- [x] Bulk update / bulk delete **[Port]**
- (skipped) Import CSV/Excel → **[Web-only?]** (or document picker if you want it); export CSV/Excel/PDF → **[Web-only?]**
- (later) **Suggestion:** follow-up date reminder as a local notification **[Native]**
- Shortcuts taken (M8): lists load the first 100 leads; Board moves cards with ← → buttons, not drag; assigned rep is hard-wired to Palak Gupta (as on web); import/export skipped; after "Convert to client" you stay on the lead (Clients screens come with M9); the list unread dot clears on refresh, not on return from the lead.

### M9 — Clients

- [x] List + stats, filters (venture, status), search (company, contact, email, GST) **[Port]**
- [x] Create/edit: venture*, company*, contact person*, email*, phone, GSTIN, PAN, address (street, city, state, PIN, country) **[Port]**
- [x] Detail: Call / WhatsApp / Email, schedule meeting, notes feed, active/inactive toggle, delete, **send portal invite**, copy client ID **[Port]**
- [ ] (later) Chat button and related projects, invoices, meetings of this client (not on the web yet)
- Shortcuts: "Schedule meeting" opens `/meetings/new?client=` (Coming soon until M7); notes are read-only (no server endpoint, same as web).

### M10 — Quotations (admin)

- [ ] List, stats by venture (quoted value, accepted value, conversion rate), filters (status, date, search) **[Port]**
- [ ] Detail: preview (server HTML in a WebView), **PDF download + share** **[Native]**
- [ ] Versions: timeline, view a version, send / resend email, set status (draft/sent/accepted/rejected/expired), archive **[Port]**
- [ ] Create invoice from quotation **[Port]**
- [ ] Full document editor (letter text, scope, deliverables, payment terms, conditions, bank/UPI, issuer, templates standard/panigrahna, working copy) → **[Web-only?]**: long document editing is painful on a phone. Smaller option: allow editing price, GST and dates only.

### M11 — Invoices (admin; client read-only)

- [ ] List, stats (total invoiced, collection rate, outstanding, overdue count, by venture), filters **[Port]**
- [ ] Create/edit: client, project, issue/due date, items (description, qty, rate), GST rate, discount %, billing address, notes/terms, issuer & bank details; from quotation **[Port]**
- [ ] Detail: payment progress, timeline, linked quotation, status change, resend email, delete **[Port]**
- [ ] **Record payment** + **split payment** (cash + bank/UPI) **[Port]**
- [ ] PDF download + share (WhatsApp to client) **[Native]**

### M12 — Payments (admin)

- [ ] List, stats, filters (method: upi/bank_transfer/razorpay/stripe/paypal/cash; type: advance/partial/final/other; status; date; reference search) **[Port]**
- [ ] Detail, edit, delete (super_admin), **receipt PDF share** **[Native]**

### M13 — Reports (admin)

- [ ] Date range picker; Revenue (with/without cash, monthly trend), Pipeline (by status, by source, conversion), Clients, Invoices (status, overdue), Productivity (tasks by assignee/priority/status), Brand breakdown **[Port]**

### M14 — Payroll & payslips

- [ ] **My Payslips** for every staff user: list + PDF download/share **[Native]**
- [ ] Payroll runs (payroll access only): list, run detail (employees, gross, deductions: pre-joining / leaving / LOP / other, net, ready vs issues) **[Port]**
- [ ] Generate draft, finalize, reopen with reason → **[Web-only?]**: rare, high-risk money action. Smaller option: view-only on mobile.

### M15 — Freelancers (admin/manager)

- [ ] List, stats, filters (active/inactive), search (name, phone, city, service, code) **[Port]**
- [ ] Detail: profile, services, skill level (junior/mid/senior/specialist/lead), rate card history (per hour/shift/day/function/event/deliverable/monthly/custom, INR/USD), emergency contact, portfolio links, Call/WhatsApp **[Port]**
- [ ] Create/edit, activate/deactivate, archive, hard delete **[Port]**
- [ ] Copy public apply link **[Port]**
- [ ] Public freelancer apply form → **[Web-only?]** (public, no login; a web link works on phones already)

### M16 — Users (admin)

- [ ] List, stats, role filter, search **[Port]**
- [ ] Create/edit: name, email, phone, role, status, employee profile (employee ID, designation, joining/leaving date), compensation (gross salary, effective from), bank (name, account, IFSC), read-only modules **[Port]**
- [ ] Change role (super_admin), delete (super_admin)

### M17 — Settings & profile

- [ ] Profile (name, phone, avatar from camera), change password (policy hints) **[Port]**
- [ ] Notification preferences (in-app / email per type), sound toggle + test **[Port]**
- [ ] Push notifications on/off, biometric lock on/off **[Native]**
- [ ] Organization settings (view; edit for admin) **[Port]**
- [ ] Roles & permissions matrix, security policy, integrations (Zoho OAuth), email template previews → **[Web-only?]**: rare admin setup

### M18 — Client portal (role `client`)

- [ ] First-login onboarding wizard + portal guide / FAQ **[Port]**
- [ ] Home: venture-branded header, previous/next venture switch, totals (invoiced, paid, outstanding), active projects, upcoming meetings, recent invoices **[Port]**
- [x] Home: hello + the 5 most recently updated tasks (the rest of Home below is still to do)
- [x] Projects (tasks part): the client's tasks grouped by project with progress and due date; task page read-only with checklist, files and the **task chat** (photos/PDFs). The server hides internal history, time logs, review notes and staff emails; staff see "The client can read this chat". Task notifications open the portal's task page.
- [ ] Projects (rest): detail with milestone journey, deliverables & asset hub (drive links), crew summary, **project team chat** **[Native]**
- [ ] Meetings: list, request new (title, date, time, agenda, link), detail, cancel **[Port]**
- [ ] Invoices: list, detail, PDF download/share **[Native]**
- [ ] Profile, change password, push notifications **[Native]**

### M19 — Release

- [ ] App icons/splash per platform, store screenshots
- [ ] `eas build --platform all --profile production`, `eas submit`
- [ ] OTA updates channel (`expo-updates`) for JS-only fixes
- [ ] Crash reporting (e.g. Sentry)
- [ ] Privacy policy text for location + camera (stores require it)

---

## 6. Suggestions (my recommendations)

1. **Ship in 3 releases, not one.** R1 = M0–M5 + M14 payslips (every employee uses it daily). R2 = M6–M9 (sales + production). R3 = M10–M13, M15–M18. Real users test R1 while you build R2.
2. **Move "Palak Gupta" out of the code.** Lead assignee is hard-coded in web `LeadForm.jsx`; put it in organization settings so mobile and web share one rule.
3. **Multi-device sessions on the server** (see review below). Without it, logging in on the phone logs you out on the laptop.
4. **Geofence check on the server**: clock-in sends GPS today but nothing blocks clocking in from home without WFH. If that matters, add an office radius check in `attendance.service.js clockIn`.
5. **Offline-tolerant attendance**: if the network drops at clock-in, keep the request with its timestamp and send it when online (server must accept a client time within a few minutes).
6. **Local reminders** (no server needed): clock-in reminder, follow-up date, meeting 10 min before.
7. **Share to WhatsApp** for invoices, quotations and receipts. Your clients live on WhatsApp.
8. **Copy code instead of rewriting**: services, constants, zod schemas and formatters come straight from the web. Later, if both apps stay, move them to a shared package.
9. Keep the **public forms** (inquiry, freelancer apply) on the web. They work in a phone browser already.

### Features suggested to stay web-only (decide yes/no)

Lead import/export · attendance bulk import + Excel/PDF exports · quotation full document editor · payroll generate/finalize/reopen · roles/security/integrations/email-template settings · email preview studio · task keyboard shortcuts · public inquiry & freelancer forms.

---

## 7. How to start (commands)

```bash
cd ~/Desktop/Faizal
npx create-expo-app@latest crm-mobile --template tabs
cd crm-mobile
npx expo install nativewind react-native-reanimated react-native-safe-area-context react-native-gesture-handler expo-secure-store expo-location expo-notifications expo-image-picker expo-file-system expo-sharing expo-web-browser expo-haptics expo-audio
npm i -D tailwindcss
npm i @reduxjs/toolkit react-redux react-hook-form @hookform/resolvers zod socket.io-client date-fns libphonenumber-js lucide-react-native @gorhom/bottom-sheet @shopify/flash-list react-native-calendars
npx expo start
```

Then M0 → M1 → M2, one module at a time; each module ends with: works for every role it serves, on Android + iOS, light + dark.

---

## 8. Server auth change to fix before mobile login

Uncommitted change in `CRM/server/src/modules/auth/auth.controller.js` returns `refreshToken` in the body and accepts it from `req.body`.

- **Problem:** the User model stores **one** `refreshToken` (`auth.service.js generateTokens` overwrites it). Phone login replaces the laptop's token, so the laptop is logged out within 15 min, and the other way round.
- **Fix:** store `refreshTokens: [String]` (keep the last ~5), check with `includes`, replace only the used one on refresh, remove only the current one on logout. Add one test: login twice, both refresh tokens still work.
- **Also:** the web app now gets the refresh token in the JSON body too, so page JavaScript can read it (it was HttpOnly-cookie only before). Return it in the body only when the request sends a header such as `X-Client: mobile`.
