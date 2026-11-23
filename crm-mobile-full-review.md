# Rudhram CRM Mobile: Full Code + UX Review

Repo: `rudhramcodes/crm-mobile`, branch MAIN, HEAD `1ed8f0f4` (merged 21 Nov 2026).
Review date: 23 Nov 2026. Read only. Nothing in the repo was changed, built, or run for this review.
Anything that needs a real device or a running app to confirm is marked UNVERIFIED.

## Verdict

This is not a 2 to 3 module starter app any more. That description is out of date. Fifteen of the planned modules are built and wired to the server: Auth, Dashboards, Tasks, Projects, Clients, Leads, Meetings, Attendance, Users, Teams, Freelancers, Invoices, Payments, Quotations, Reports, and Notifications. The code is generally careful: Redux Toolkit with RTK Query, tokens in SecureStore, one shared token refresh, server pagination on most lists, and small self-check files for the money and date helpers.

But it is not finished, and it is not release ready by its own plan. Three whole areas are missing: Payroll and payslips (M14, no screen at all), Settings (M17, no screen at all), and half the Client Portal (invoices and meetings are placeholders). The release checklist (M19) is entirely unchecked: no crash reporting, no privacy policy text, no store screenshots, no OTA update channel. On top of that there are live traps a user can walk into today: dead nav entries in the More screen that lead to missing routes, a Tasks hub that silently drops every task after the first 100, a lead form that cannot be saved if one hard-coded account lookup fails, and clock-in that waits up to 8 seconds on GPS even when the user picked WFH.

The good news: almost every gap already has the hard half done. The settings API exists, the payroll API exists, the leads board exists, the Dynamic Island already exists. Most of the P0 work below is wiring, guarding, and deleting, not building from zero.

## Repo snapshot

- Stack: Expo SDK 58, React Native 0.88.1, React 19.3, expo-router, Redux Toolkit + RTK Query, NativeWind 4, react-hook-form + zod (in package.json, but see the Leads finding below), FlashList, socket.io-client, date-fns, libphonenumber-js, lucide-react-native, @gorhom/bottom-sheet, react-native-reanimated 4.
- Language: JavaScript, not TypeScript. `jsconfig.json` only, with the `@/*` alias to `src/*`. No `tsconfig.json`.
- Files: 206 source files under `src/`. Routes live in `src/app/` (expo-router groups `(staff)` and `(client)`). Shared code in `src/components/`, `src/services/`, `src/store/`, `src/hooks/`, `src/utils/`, `src/constants/`, `src/widgets/`.
- Tests: none. No test script in `package.json`, no `*.test.*` files anywhere. Nine `src/utils/*.check.js` files exist (clients, freelancers, invoices, leads, meetings, payments, quotations, reports, users) with node-assert checks for money and date logic, but nothing runs them, so they are unverified documentation, not tests.
- Config: `app.json` (scheme `rudhramcrm`, bundle id `com.rudhram.crm`, EAS project id `92e5005b-aeb0-4bd6-a002-53924c6aad6c`), `eas.json` (development/preview/production, production `autoIncrement: true`, no update channels, no per-platform profiles). No `ios/` or `android/` directories: managed workflow with Continuous Native Generation, native behaviour goes in `app.json` and config plugins.
- Design system: `DESIGN.md` is real and specific (Rudhram ochre `#b47737`, beige `#f6f1e0`, brown `#3b2515`, Goldenbook display + Manrope UI, floating pill tab bar, 44px targets). Fonts actually loaded in `src/app/_layout.jsx:90-93` are Manrope and Goldenbook only.
- Docs in repo: `PLAN.md` (407 lines, modules M0 to M19 with checklists), `TASKS-FLOW.md` (phases T1 to T6), `DESIGN.md`, `AGENTS.md`.

## Plan status: what is really built

Checked against `PLAN.md` and the code, not against the checkmarks alone. Several checkmarks overstate what the code does.

| Module | Plan says | Code shows |
|---|---|---|
| M0 Setup | done | done |
| M1 Auth and session | done | done, with small gaps (no biometric sign-in, deep link scheme mismatch, see Auth) |
| M2 Shell, notifications, realtime | done | done, except deep links cover 2 types explicitly, the rest rely on the server link field |
| M3 Dashboards | done | done, but admin home is thin (4 tiles, no trend, no meetings) |
| M4 Attendance | done | done, except offline punch, WFH GPS skip, and in-screen role guards |
| M5 Tasks | done | done, except Tasks hub has no paging and no virtualised list |
| M6 Projects | mostly done | done except edit basics and create-client-inline, both still missing |
| M7 Meetings | done | done, except add to phone calendar and edit recurrence |
| M8 Leads | done | list and detail done, but follow-up date cannot be set and the board toggle is commented out |
| M9 Clients | done | done, except related projects/invoices/meetings and a notes composer |
| M10 Quotations | done | done, full version machinery works |
| M11 Invoices | done | done, except PDF share (download only) and portal invoices |
| M12 Payments | done | done, except the split payment method bug |
| M13 Reports | done | done, except export and custom range |
| M14 Payroll and payslips | not started | not started. No screen, no route. Only a dead service file |
| M15 Freelancers | done | done |
| M16 Users | done | done |
| M16b Teams | done | done |
| M17 Settings and profile | not started | not started. No screen. The whole settings API is dead code |
| M18 Client portal | partial | projects and tasks done. Home nearly empty, invoices and meetings are placeholders |
| M19 Release | not started | not started. No crash reporting, no privacy policy, no store screenshots, no OTA channel |

## How to read this document

- Every finding cites a real file path and line number. If a claim needed a running app, it says UNVERIFIED.
- ADD list and REMOVE list near the end are the prioritised action lists. The module sections point into them.
- The last section is copy-paste prompts for Claude Code, one per module plus Dynamic Island and Notifications. They are text to paste elsewhere, not commands run here.
- "Server" means the web CRM backend (`rudhramcodes/CRM`). Several findings can only be settled there, and those are marked as server questions.

---

# Module by module review

## Auth / Login

**State:** built and coherent. All screens exist: sign-in, forgot password, reset password, change password (including forced change), email OTP verification, accept invite.

**What exists**

- Sign in `src/app/sign-in.jsx:1-56`, forgot password `src/app/forgot-password.jsx:1-39`, reset and accept invite both reuse `src/components/SetPasswordForm.jsx:1-50`, change password `src/app/change-password.jsx:1-60`, verify email OTP `src/app/verify-email.jsx:1-51` (6 digits, 60 second resend cooldown, auto submit on 6 digits).
- Session: `src/store/authSlice.js:1-20`, `src/store/session.js:1-55`, `src/services/authApi.js:1-31`. Refresh token in SecureStore (`src/utils/refreshToken.js:1-6`), one shared refresh via a module level promise so parallel 401s do not race (`src/services/api.js:17-36`), `X-Client: mobile` header (`src/services/api.js:12`).
- Biometric unlock after first login with a 5 minute auto lock (`src/hooks/useAutoLock.js:7`, `src/components/LockScreen.jsx:1-70`, `src/utils/biometric.js:1-27`). Lock screen falls back to passcode and handles lockout, not enrolled, and no passcode distinctly.

**Code quality**

- High: the refresh token depends on a server fix the app cannot verify. `PLAN.md` section 8 says the server stores one refresh token per user, so phone login can log out web and vice versa. UNVERIFIED from the mobile repo alone, needs a server check. `src/services/api.js:17-36`.
- Med: forced logout does not clear the biometric preference. On refresh failure `src/services/api.js:38-40` clears the refresh token and logs out, but the pref stays `on`, so the next sign-in skips the biometric offer (`src/store/session.js:13`). Explicit sign-out does clear it (`src/store/session.js:48-53`).
- Med: refresh rotation silently keeps the old token if the server sends no new one (`src/services/api.js:25` only saves `tokens.refreshToken` when present).
- Med: access token lives only in Redux memory, so every cold start must call `GET /auth/me` and refresh before anything renders (`src/store/session.js:28-42`). No cached user for an instant first paint.
- Low: web refresh token fallback stores the token in localStorage (`src/utils/refreshToken.web.js:3-5`). The file says dev preview only, but any shipped web build would expose it to XSS.
- Low: hardcoded values with no server source shown: reset link "expires in 1 hour" (`src/app/forgot-password.jsx:14`), OTP "expires in 10 minutes" (`src/app/verify-email.jsx:42`), 60 second resend cooldown, 5 minute lock.
- Low: font load failure is silently accepted (`src/app/_layout.jsx:98` passes `fontsReady={loaded || !!error}`).
- Low: sign-in has no client side validation (`src/app/sign-in.jsx:18-19` posts whatever is typed). A malformed email costs a round trip.
- Low: verify email resends a code on every mount (`src/app/verify-email.jsx:20-21`), even if the user just opened the screen after already receiving one.

**UX and flow**

- No biometric sign-in on the sign-in screen. Biometrics only unlock an already signed-in session. A fresh install or a signed-out user must type email and password every time. No saved email, no SSO, no Face ID button on `src/app/sign-in.jsx:1-56`.
- Reset link path is fragile. `src/components/SetPasswordForm.jsx:15-22` only checks that a token exists. PLAN says the deep link is `crm://reset-password?token=`, but `app.json:8` sets the scheme to `rudhramcrm`. Whether real reset and invite emails use the working scheme is UNVERIFIED, it needs a real email link test.
- Forgot password success screen (`src/app/forgot-password.jsx:12-17`) only offers Back to sign in. No resend, no change email. A typo means starting over.
- Verify email is a nudge, not a gate. `_layout.jsx:58` routes by `signedIn` and `mustChangePassword` only, never by `isEmailVerified`. An unverified user reaches Home and only sees a banner.
- A failed OTP wipes the whole entry (`src/app/verify-email.jsx:30` calls `setOtp('')`), so one wrong digit forces retyping all six.
- Forced password change is well handled (back hidden, swipe back disabled, sign out offered), but on success it does `router.replace('/')` (`src/app/change-password.jsx:25`) even for a client whose home is `/portal`. UNVERIFIED at runtime.
- The 5 minute lock window is invisible and unchangeable, hardcoded in `src/hooks/useAutoLock.js:7`.

**Missing:** biometric sign-in on the sign-in screen, remembered email, forgot password resend/change email, deep link verification with a real email, server side multi-device refresh tokens.

**Add:** P1 biometric sign-in button or remembered email; P1 client side email validation on sign-in and forgot password; P1 verify the reset/invite deep links end to end and fix the scheme to match `app.json`. See ADD list.
**Remove:** nothing in this module except the web localStorage token fallback if a web build is ever shipped.

## Dashboard

**State:** works as a summary screen, but the admin home is thin and the data access is unguarded.

**What exists**

- Staff home splits by role: `src/app/(staff)/(tabs)/index.jsx:1-9` (employee gets `EmployeeDashboard`, everyone else `AdminDashboard`).
- Admin dashboard `src/components/Dashboards.jsx:107-152`: 4 stat tiles, Ventures list, Tasks section, AttendanceCard.
- Employee dashboard `src/components/Dashboards.jsx:154-220`: AttendanceCard, My tasks ring plus list, Upcoming meetings.
- Venture dashboard `src/app/(staff)/dashboard/venture/[brand].jsx:1-104`: 7 tiles, brand switcher, revenue, pipeline, sources, task velocity, benchmark, invoice aging, top clients.
- Shared parts `src/components/DashboardParts.jsx:1-187` (StatTile, Section, BarList, MonthBars, Ring, StatusCounts, ActivityRow, BrandMark). Loading skeletons and a retry error state exist (`src/components/Dashboards.jsx:50-72`).

**Code quality**

- High: unguarded dashboard data access can crash on a partial response. Admin tiles read `k.totalLeads`, `k.conversionRate`, `k.activeProjects`, `k.overdueInvoices` with no guard that `k` exists (`src/components/Dashboards.jsx:125-128`). Employee reads `tasks.done` and `tasks.total` (`src/components/Dashboards.jsx:168`, `:184`). Venture reads `k.*` the same way (`src/app/(staff)/dashboard/venture/[brand].jsx:45-51`). The code only checks that `d` exists, not `k` or `tasks`. A missing `kpis` object would crash Home, not show an error state.
- Low: `src/components/Charts.jsx:12-15` includes `#6250d6` in the light series and `#9085e9` in the dark series. PLAN section 4 and DESIGN.md say no violet or lavender. This affects Reports charts, not the dashboard ring and bars.

**UX and flow**

- Admin home has only 4 tiles (leads, clients, revenue, overdue), a Ventures list, and a Tasks section. No revenue trend, no upcoming meetings, no recent activity, no won deals, no pending payments tile. The venture screen has most of those except meetings and activity. `RevenueSection` exists at `src/components/Dashboards.jsx:64-83` but is only used on the venture screen.
- Employee home has tasks ring plus list and upcoming meetings only. No quick links to Payslips, Leaves, or Calendar despite PLAN M3 naming quick links, and no leave balance beyond the AttendanceCard.
- Dashboard tiles assume the user can open their targets. Admin tiles push to `/leads`, `/clients`, `/payments`, `/invoices` (`src/components/Dashboards.jsx:125-128`). A manager sees the same tiles, but there is no role check in the dashboard itself; access relies on the target screens and the server. UNVERIFIED at runtime for a manager with restricted modules.

**Missing:** revenue trend and upcoming meetings on admin home, employee quick links and leave balance, defensive handling when `GET /dashboard` returns data without `kpis`.

**Add:** P0 guard dashboard data before render; P1 add revenue trend and upcoming meetings to the admin dashboard; P2 employee quick links and leave balance. See ADD list.

## Tasks / My Day

**State:** largely built and usable, but the most-used screen in the app has the weakest list in the app.

**What exists**

- Tasks hub `src/app/(staff)/(tabs)/tasks.jsx:36-50`: four views (My Day, List, Board, Calendar) over one filtered query, search, filters, bulk select, insights link, CSV export. My Day is the default.
- My Day `src/components/TaskViews.jsx:94-129`: QuickAddTask plus groups NEEDS MY REVIEW, OVERDUE, TODAY, LATER, WITH THE REVIEWER, DONE TODAY, with a today progress bar.
- Quick add `src/components/TaskViews.jsx:42-92` and `src/utils/quickAdd.js`: one-line add with `@person` / `@team`, dates and times, `!priority`, `#tags`, parsed chips, tap-through to the full form. Full form at `src/app/(staff)/tasks/new.jsx`.
- Task detail `src/app/(staff)/tasks/[id].jsx`: inline title/description edit, people, due, priority, TaskFlow, checklist, subtasks, files strip, chat, time tracker, More details (start date, estimate, tags, recurring display, dependencies, activity, admin-only delete).
- Review flow `src/components/TaskDetailParts.jsx:326-392` (ReviewPanel) and `src/app/(staff)/tasks/review-note.jsx:10-11`: submit note (optional) and ask-for-changes note (required), both with photo/PDF attachments; 1-office-hour clock via `src/utils/tasks.js:26-33` (`reviewClock`); Approve / Ask for changes; hand-review-to-someone-else picker.
- Swipes in `src/components/TaskParts.jsx`: swipe right finishes or sends for review, swipe left reschedules; tick circle does the same; screen-reader actions mirror both swipes.
- Kanban `src/components/TaskViews.jsx:197-265`: horizontal columns per status, Move mode with arrow buttons, no drag. Reorder via `useReorderTasksMutation`.
- Bulk select `src/components/TaskViews.jsx:140-194`: long-press or Select several, set status or priority, export selected, admin bulk delete; unchangeable tasks are skipped with a count.
- Subtasks, checklist, dependencies, time tracker (manual log today/yesterday plus stopwatch), task chat (`src/components/TaskChat.jsx:293-323`: latest 10 plus Show earlier, text/photos/PDFs, @mentions, replies, delete own or admin any).
- Insights `src/app/(staff)/tasks/insights.jsx`: completion ring, status counts, overdue, estimated vs logged hours, priority mix, team workload.

**Code quality**

- High: Tasks hub has no paging and no virtualised list. `src/app/(staff)/(tabs)/tasks.jsx:36-38` hard-codes `page: 1, limit: 100` for every view, with no Pager and no page state. `src/components/TaskViews.jsx:131-136` renders all rows with plain `.map()` inside a ScrollView. No FlashList or FlatList is imported in `tasks.jsx` or `TaskViews.jsx`. At 100 items this mounts 100 `TaskRow` components, each with a `ReanimatedSwipeable`. The 101st task is unreachable, and the first 100 render slowly. UNVERIFIED visually, app not run.
- High: My Day merges two capped queries and can double-count or drop work. `src/app/(staff)/(tabs)/tasks.jsx:46-50` concatenates `doneToday` (limit 100) onto the open-tasks query, and the header total reads only the open query, so it excludes done-today. Reviews come from a separate query (limit 50, no error or loading UI, `src/components/TaskViews.jsx:97`). A reviewer with more than 50 pending reviews silently loses the rest.
- Med: pagination is inconsistent. Numbered Pager on projects, portal projects, and portal tasks. No paging on the Tasks hub (100 cap), insights (same capped 100, labelled "First 100 shown"), My Day reviews (50 cap), time entries (latest 10), chat (latest 10 plus Show earlier).
- Med: overdue is defined two different ways. `src/utils/tasks.js` `isOverdue` excludes `review` status, but the project Overview late count uses `open: 'true'` plus `dueDateTo` (`src/app/(staff)/projects/[id].jsx:146-148`), and its own comment admits review tasks are counted there too.
- Med: review-note attachments are a second, separable write. `src/app/(staff)/tasks/review-note.jsx` sends the status change first, then posts files as a separate chat comment. If the comment fails, the task is already in review and the user only gets a toast.
- Med: reschedule drops the time of day. `src/components/TaskParts.jsx:32-35` passes only `ymd(t.dueDate)` to `src/app/(staff)/tasks/reschedule.jsx`, which is date-only. A 5 pm due time set by quick add is silently lost on any reschedule. UNVERIFIED against the server.
- Med: broad RTK invalidation refetches whole lists on every small mutation. `src/services/taskApi.js:26-30,62-66,94-98` invalidates both the item tag and the generic `Task` tag, and `getTasks` provides only the generic tag. Every checklist tick, time log, or chat message refetches every open task list. `getTasks` also sets `keepUnusedDataFor: 0`, so switching tabs always refetches.
- Med: project Files only covers the tasks on screen (`src/app/(staff)/projects/[id].jsx:151` builds the file list from the current 20 open plus current 20 done tasks).
- Low: progress percent is computed three different ways (`src/utils/tasks.js:37-41`, `src/components/TaskParts.jsx:70-73`, `src/components/TaskDetailParts.jsx:402-404`). They agree today, but any rule change must be edited in three places.
- Low: silent failures on secondary queries. `src/app/(staff)/(tabs)/tasks.jsx:48` never surfaces a `doneToday` error; the reviews query shows no loading or error state, so a failed fetch looks like "nothing needs my review".
- Low: duplicated chat and stage logic. TaskChat vs ProjectChat are near-copies with small divergences (project chat has no replies and no PDFs). Stage visuals are also duplicated three ways.

**UX and flow**

- My Day order is right (review, overdue, today, later, with reviewer, done today), but LATER and DONE TODAY have no collapse, so a long day pushes DONE TODAY far down the scroll, and the today progress bar excludes tasks with the reviewer.
- Quick add is strong, the full form is not. The project picker is a horizontal chip row of the first 50 projects with no search, and the milestone picker only appears after a project is picked. There is no template choice (wedding shoot, pre-wedding, corporate film) anywhere. Quick add inside a project passes only `{ project }`, not the milestone, so project tasks land under NO MILESTONE unless edited later.
- Kanban without drag is workable but slow. Columns are 280 px wide with horizontal snap scrolling, and moving a card from To Do to Done takes three taps plus toggling Move mode, which is not discoverable without tapping the chip. TaskRow swipe is disabled in the board, so the fastest gesture from List is unavailable here.
- Review handover is confusing. Three paths do three different things: TaskFlow opens the note sheet, the row tick and both swipes send for review instantly with no note, bulk status can also move tasks to review. The reviewer sees labels that change by role, and ReviewPanel hides itself entirely when the reviewer looks at a not-yet-submitted task, so a reviewer cannot see what the submit step will ask. The known gap from PLAN is still present: `handTo` (`src/components/TaskDetailParts.jsx:349-351`) has no guard against handing review to the task's own owner, who can then approve their own work.
- Stopwatch is invisible outside the detail screen and device-only, as planned. It lives only inside the Time card on the task detail screen. It stores one global stopwatch in device prefs, survives app close, and shows in the Dynamic Island and Lock Screen, but starting it does not change the task status in client code, stopping under 60 seconds is refused with no partial-log option, and Discard has no confirmation.
- Project stage bar: tapping any future stage jumps straight there with no confirmation and no reason (only moving back asks why), so Brief can jump to Delivered in one tap, subject only to the server refusing. UNVERIFIED whether the server refuses.

**Missing:** T5 remainder (stale-task nudge, daily email, auto milestone, mute this task); T6 remainder (project templates, a Files tab of its own, long-press chat message to Make a task, task templates); review-speed stats in Insights; workload hint on My Day or board; team view for managers; "Show earlier" for time entries beyond 10.

**Add:** P0 page and virtualise the Tasks hub; P1 unify the send-for-review path; P1 show a running-stopwatch indicator outside the detail screen; P1 guard review handover; P1 make Insights honest about the cap and add review speed. See ADD list.
**Remove:** dead embedded project-task mutations, duplicated progress calculations, triple project-message fetch. See REMOVE list.

## Projects

**State:** built, including the SOP stage bar, QC, and closing note. The hole is editing: there is no project edit screen at all.

**What exists**

- List `src/app/(staff)/projects/index.jsx:109`: FlashList, 20 per page, numbered Pager, search, Mine filter, stage chips with counts, venture chips.
- Detail `src/app/(staff)/projects/[id].jsx:20,140-178`: four tabs Overview / Tasks / Chat / More. Overview has StageBar, task progress, owner, deadline, priority, deliverables, milestones, sign-off. Tasks tab groups open tasks by milestone with QuickAddTask and paged done tasks. Chat tab has project chat plus Files strip. More tab has team, crew, inward data, activity.
- Stage bar, QC, closing note: `src/components/ProjectParts.jsx:82-100` (StageBar: tap forward, reason required to move back) and `src/components/ProjectEditParts.jsx:233-294` (SignOffCard: 4-point admin QC plus closing note).
- Client portal: `src/app/(client)/(tabs)/portal/projects.jsx` (FlashList, 10 per page), `src/app/(client)/portal/projects/[id].jsx` (stage, deliverables, milestones, paged task list, project chat, files), `src/app/(client)/portal/tasks/[id].jsx` (read-only apart from chat, checklist, files; no TimeTracker, ActivityLog, or Dependencies).

**Code quality**

- M6 edit basics and create-client-inline were unchecked in PLAN and are still missing. There is no project edit screen or route (only `index.jsx`, `[id].jsx`, `new.jsx`), no title/client/venture/budget/tags/deadline edit UI in `[id].jsx` or `ProjectEditParts.jsx`, and `useUpdateProjectMutation` is only used for deliverables, team, inward data, and crew sub-objects. `useDeleteProjectMutation` (`src/services/projectApi.js`) has zero callers, so there is no project delete UI either. Create-client-inline is absent: `src/components/ClientParts.jsx:67` says "Add the client first in Clients" when no match is found.
- T6 one-task-system: the mobile read path has moved. Project Tasks uses the Task collection (`src/app/(staff)/projects/[id].jsx:143-144`, `useGetTasksQuery` with `project: p._id`), not embedded `Project.tasks[]`. But the legacy embedded-task mutations (`addProjectTask`, `updateProjectTask`, `deleteProjectTask`, `src/services/projectApi.js:72-84`) are still exported with zero callers.
- Project chat is thinner than task chat (`src/components/ProjectParts.jsx:154-235`): text plus photos only, no PDFs, no replies, no task linking (TASKS-FLOW.md 2.8 promised a message can link to a task; only a plain `Task created: {taskTitle}` line is rendered), delete own message only (task chat lets admins delete any). The chat tab count counts all messages, not unread.
- Stage history is buried under the More tab (`src/components/ProjectEditParts.jsx:366-380`, first 3 moves only).
- The list row StageMeter (`src/components/ProjectParts.jsx:27-37`) shows the same five segments with only a text label, and the 0/20/50/80/100 progress values in `src/constants` (`PROJECT_STAGES`) are never displayed as numbers.

**UX and flow**

- Portal task visibility relies entirely on the server. The portal task page reuses the staff Checklist and TaskChat and correctly omits TimeTracker, ActivityLog, and Dependencies. But the checklist renders as disabled checkboxes with no read-only explanation for the client, helpers are not shown (only the owner), and the portal project task list sorts by `-updatedAt` with no status filter, so done and open tasks are mixed. Server-side hiding of internal history, time logs, review notes, and staff emails is asserted in comments, not verifiable from mobile code. UNVERIFIED.

**Missing:** project edit (title, client, venture, priority, budget, tags, deadline with reason), create-client-inline, project delete UI, project templates, a Files tab of its own, task linking from project chat.

**Add:** P0 add the project edit screen; P2 milestone picker in project quick add and auto milestone; P2 create-client-inline. See ADD list.
**Remove:** dead embedded project-task mutations. See REMOVE list.

## Clients

**State:** built and solid. The detail screen is a static profile plus notes; it does not show the client's work.

**What exists**

- List `src/app/(staff)/clients/index.jsx:53,56-57,185`: 20 per page, server pagination with Pager, search, venture chips, stats, super_admin only status filter.
- Detail `src/app/(staff)/clients/[id].jsx:89,94,240-248,292`: Call/WhatsApp/Email, schedule meeting, portal invite, active/inactive toggle, copy client ID, delete, notes feed.
- Create/edit `src/app/(staff)/clients/new.jsx:71-80`: venture, company, contact, email, phone, GSTIN, PAN, address, initial notes on create only.

**Code quality**

- No react-hook-form or zod in this slice, despite PLAN section 1 prescribing them. All three forms in this slice (clients, leads, meetings) use `useState` plus a manual `ready` gate. Validation is duplicated, not shared, and there is no schema to reuse from web.
- No phone validation anywhere in the slice. Client phone is optional with no format check (`src/app/(staff)/clients/new.jsx:71-80`). No `libphonenumber-js` use was found, despite PLAN listing it. Bad numbers fail later at the `tel:` or `wa.me` step.
- Client notes have no add path in code, which matches PLAN, but the UI gives no hint why. Detail only renders the reversed list (`src/app/(staff)/clients/[id].jsx:94,292`), and `src/services/clientApi.js` has no add-note mutation. A user tapping around finds no composer and no explanation.
- Good: pure helpers are well tested for the slice (`src/utils/clients.check.js` covers GSTIN/PAN and status rules). The form screens themselves have no equivalent checks.

**UX and flow**

- PLAN M9 follow-ups are confirmed absent. No chat button and no related projects, invoices, or meetings appear in `src/app/(staff)/clients/[id].jsx`. The detail is a static profile plus notes. The only cross-links out are Schedule meeting and copy client ID.
- Portal invite flow: button shows only when `can.manage` and not portal active (`src/app/(staff)/clients/[id].jsx:240`), calls `invite(c._id)` (`:248`) via `POST /clients/:id/invite` (`src/services/clientApi.js:68`). There is no confirmation dialog, no resend state, no visible invite-sent date, and no guard shown in code for a missing email. Portal active is judged by `!!c.user`.
- Call/WhatsApp/Email: clients hide missing contact actions at row level (`src/components/ClientParts.jsx:111-113`), and `contactClient` catches failures with a toast (`src/components/ClientParts.jsx:35-37`). No `canOpenURL` check exists before opening any of these links.

**Missing:** related projects, invoices, and meetings on client detail; chat button; notes composer or an explicit read-only explanation.

**Add:** P1 related sections on client detail, reusing existing list queries. See ADD list.

## Leads

**State:** the weakest sales module in practice. The list and detail exist, but the follow-up date cannot be set on mobile and the Kanban board exists but cannot be reached.

**What exists**

- List `src/app/(staff)/leads/index.jsx:41,51,57`: list view only in practice, first 100, search with 350 ms debounce, stage/source/venture filters, stats, bulk select, unread dot.
- Detail `src/app/(staff)/leads/[id].jsx:34,76-78,85,95-96,104`: stage chips, Call/WhatsApp/Email, addable notes timeline, lost reason display, convert button, view client link after conversion.
- Create/edit `src/app/(staff)/leads/new.jsx:53-63,93-100,120`: full form except follow-up date.
- Lost screen `src/app/(staff)/leads/lost.jsx`: reason required. Community screen `src/app/(staff)/leads/community.jsx:29,33`: WhatsApp group check before contact or stage move from new.

**Code quality**

- High: lead create is blocked if the Palak lookup fails. `ready` requires `palak.user` (`src/app/(staff)/leads/new.jsx:99`), and `usePalak` (`:54-63`) depends on a live user search by one email. If that account is inactive, renamed, or the query errors, the Save button stays disabled with only an inline error. No fallback assignee or retry on the button.
- High: no react-hook-form or zod in this slice (same finding as Clients).
- Med: pagination is inconsistent across the three sales modules. Clients use numbered server pages, Meetings use infinite scroll at 20 per page, Leads silently cap at the first 100 (`src/app/(staff)/leads/index.jsx:57`) with no pager, no infinite scroll, and no "showing 100 of N" notice.
- Med: search debounce and filter state are copy-pasted. The 350 ms debounce is at `src/app/(staff)/leads/index.jsx:51`, with the same pattern in Clients and Meetings.
- Low: lead assignee email is hard-coded, `palakgupta@rudhramenterprises.com` (`src/utils/leads.js:3`), with the display name fallback "Palak Gupta" (`src/app/(staff)/leads/new.jsx:238,245`). PLAN itself flags this and suggests moving it to organization settings.
- PLAN says lead create includes follow-up date, but `src/app/(staff)/leads/new.jsx` contains no `followUpDate` field at all. Detail only displays it (`src/app/(staff)/leads/[id].jsx:104`).
- PLAN says Leads has Kanban, and `LeadBoard` exists at `src/components/LeadParts.jsx:185`, but the List/Board toggle is commented out (`src/app/(staff)/leads/index.jsx:122`), `view` defaults to list (`:41`), and the board only renders at `:208` when `view` is board. It is unreachable in normal use.
- Convert lead to client does not use the dedicated endpoint. `useConvertLeadToClientMutation` is defined at `src/services/clientApi.js:48` and exported at `:88`, but a whole-src grep finds no call site. Conversion is a plain status PATCH to `won` (`src/components/LeadParts.jsx:49`), triggered from `src/app/(staff)/leads/[id].jsx:95`. Whether the server creates the client on `won` is UNVERIFIED from this clone alone. After convert the user stays on the lead, as PLAN says, and only gets a View client button if `convertedToClient._id` exists (`:96`).

**UX and flow**

- Lead follow-up friction is the biggest gap in this slice. There is no follow-up reminder and no way to set a follow-up date. There is no overdue flag, no sort by follow-up, and no local notification scheduling.
- Board code is complete, with arrow moves (`src/components/LeadParts.jsx:185,192`), but it is dead UI because the toggle is commented out. Users get list only, with no stage columns and no drag alternative.
- Lost-reason rule verified: `statusStep` returns `contact_first` for lost from new and `lost` otherwise (`src/utils/leads.js:10`), enforced in the form and centrally in `useLeadStatus` (`src/components/LeadParts.jsx:49`). Lost from a contacted lead routes to the reason screen. Bulk cannot mark lost or won at all because `BULK_STATUSES` (`src/utils/leads.js:6`) is early stages only.
- Community-group rule verified but friction-heavy: calling or messaging a `new` lead intercepts to the community screen (`src/app/(staff)/leads/[id].jsx:34`), and stage moves from `new` do the same. Email bypasses it (`:78`). The check is a manual toggle with no deep link to WhatsApp and no verification that the group was actually created.
- Call/WhatsApp/Email reliability: leads gate Call/WhatsApp by `!!l.phone` (`src/app/(staff)/leads/[id].jsx:76-77`), but Email (`:78`) has no `.catch`, so a missing mail app fails silently. `waLink` (`src/utils/leads.js:24`) prepends 91 only for exactly 10 digits, otherwise passes digits through, so an 11 digit, short, or non-Indian number builds a wrong `wa.me` link.
- Unread lead dot: shown when `isRead === false` (`src/components/LeadParts.jsx:75-76`), but no mutation in the slice marks a lead read on open. PLAN notes it clears on refresh, not on return from the lead.

**Missing:** lead follow-up date input on create and edit, plus any overdue, today, or reminder treatment; reachable Leads Kanban toggle; lead import and export UI (`importLeads` exists in `src/services/leadApi.js` but no screen calls it); a shared assignee picker to replace the hard-wired Palak assignment; lead list pagination beyond the first 100; mark lead as read on open.

**Add:** P0 lead follow-up date; P0 un-comment and ship the Leads board toggle; P1 replace hard-wired Palak assignment with a picker plus a default; P1 lead list pagination. See ADD list.
**Remove:** the dead `convertLeadToClient` mutation OR wire the Convert button to it and remove the status-PATCH conversion path instead. Do not remove both without confirming the server behaviour first, since that part is UNVERIFIED. See REMOVE list.

## Meetings

**State:** the strongest module in this slice. List, calendar, create, detail, and convert-to-task all exist.

**What exists**

- List and calendar `src/app/(staff)/meetings/index.jsx:59,123-128,234`: infinite scroll at 20 per page (`src/services/meetingApi.js:20`), month calendar, search/status/client/date/venture filters.
- Detail `src/app/(staff)/meetings/[id].jsx:152,215,263`: status change, Join, client/lead links, editable discussion notes, action items with done/remove/convert.
- Create/edit `src/app/(staff)/meetings/new.jsx:102,122,127,231-238,241,248`: client/lead pickers, date, start slots, duration chips, recurrence on create only, Google Meet/Zoho link generation, attendees.
- Convert action item `src/app/(staff)/meetings/convert.jsx:14,31`: project, assignee, deadline, then back to the meeting.

**Code quality**

- Med: meeting KPIs and venture counts are computed over loaded pages only, not server totals. `count()` and `MiniStats` are at `src/app/(staff)/meetings/index.jsx:123-128`, and `brandCounts(meetings)` at `:234` with the helper at `src/utils/meetings.js:86`. Until all pages load, Scheduled, Completed, Cancelled, and venture counts under-report. Clients avoid this by using server stats.
- Recurrence handling verified in code: types none/daily/weekly/monthly, 2 to 60 occurrences, interval fixed at 1 (`src/utils/meetings.js:53-54`). Delete offers single occurrence versus whole series in the list, while detail notes that detail delete is occurrence-only. Visual recurrence state is only a badge and a `seriesId` flag.

**UX and flow**

- Meeting creation friction is medium. Date uses `DateField` (`src/app/(staff)/meetings/new.jsx:221`), but start time is typed text parsed by `parseTime` (`:231-238`), plus 30 minute slot chips (`:241`). End time is duration chips only (`:248`), with no direct end-time picker. Changing start clears end. Recurrence is create-only: `badOcc` is gated by `!editing` (`:126`), and `meetingBody` only sends recurrence when not editing (`src/utils/meetings.js:53-54`). There is no edit-recurrence, no end-date option, and no "Add to phone calendar" action, which PLAN already lists as later.
- Convert meeting action item to task: detail routes to convert, the convert screen requires project, assignee, and deadline, returns to the meeting, and the item then shows "Converted to task" with no link to the created task. Project choice is a horizontal chip row over the first 100 projects (`src/app/(staff)/meetings/convert.jsx:14`), with no search, so finding a project in a long list is slow.
- Meeting join link behaviour is UNVERIFIED for app versus browser. `joinMeeting` is a single `Linking.openURL(url)` with a toast on failure (`src/components/MeetingParts.jsx:38`), used at `:83` and `src/app/(staff)/meetings/[id].jsx:215,263`. There is no `canOpenURL` check, no `expo-web-browser` use, and no Zoho versus Meet branching in code. Whether it opens the native app when installed or falls back to the browser cannot be confirmed without running the app.

**Missing:** add to phone calendar, recording link, edit recurrence, end-date for recurrence, link from a converted action item to the created task, follow-up and meeting local reminders.

**Add:** P1 meeting KPIs from the server; P2 link the converted task from a meeting action item; P2 add `canOpenURL` checks for join and contact links. See ADD list.

## Attendance (clock in / out)

**State:** built and largely matching PLAN. The real weaknesses are silent failure modes, not missing screens.

**What exists**

- Home clock card with live timer, 1-tap clock-in, clock-out shortcut: `src/components/AttendanceCard.jsx:18-57`, used on both dashboards (`src/components/Dashboards.jsx:120` and `:163`).
- Attendance tab with ClockPanel, month stats, team-today tiles for leads, pending leave/regularization badges: `src/app/(staff)/(tabs)/attendance.jsx:19-66`.
- Clock in/out, WFH toggle with optional reason, live timer, break start/end, break history, multi-session days: `src/components/ClockPanel.jsx:32-132`, `src/app/(staff)/attendance/clock-out.jsx:14-77`, `src/components/AttendanceParts.jsx:110-145` (SessionList), `src/utils/attendance.js:20-33` (workedSeconds pauses on open break).
- Calendar month view with status dots, late dot, legend, day detail sheet: `src/app/(staff)/attendance/calendar.jsx:20-101`, `src/app/(staff)/attendance/day.jsx:20-83`.
- Leaves: apply with live day/balance check, balance cards, Team/Mine toggle, inline approve/reject: `src/app/(staff)/attendance/apply-leave.jsx:14-64`, `src/app/(staff)/attendance/leaves.jsx:17-96`, `src/components/AttendanceParts.jsx:179-193` (BalanceCards).
- Regularization request form and approvals (reject needs a reason): `src/app/(staff)/attendance/regularize.jsx:10-50`, `src/app/(staff)/attendance/regularization.jsx:14-56`.
- Admin: records list with filters (newest 100), reports daily/weekly/monthly (first 50), shifts CRUD, holidays CRUD, manual add/edit entry: `src/app/(staff)/attendance/records.jsx:17-71`, `reports.jsx:18-85`, `shifts.jsx:12-41`, `shift-form.jsx:19-68`, `holidays.jsx:18-64`, `holiday-form.jsx:13-58`, `edit.jsx:19-113`.
- Dynamic Island / Lock Screen work timer while clocked in (pauses on break): `src/hooks/useClockTimer.js:8-27`, wired in `src/app/(staff)/_layout.jsx:14`, implementation in `src/services/liveActivity.ios.js:11`.

**Code quality**

- High: WFH clock-in still calls `getLocation()` before sending, even though the label says "No location check" (`src/components/ClockPanel.jsx:59-70`, `:98-99`). A WFH user still gets the permission prompt and can wait up to the 8 second GPS timeout in `src/utils/attendance.js:45-57` before clocking in.
- High: no offline support anywhere in this slice. No NetInfo check, no queue, no cached punch, no retry. Clock-in, clock-out and break all fail on dead network with only a toast from `runAction` (`src/utils/attendance.js:58-72`). A failed punch has no recovery path except a regularization request afterwards.
- Med: only `isLoading` is handled; `isError` from `useGetTodayStatusQuery` is never read (`src/components/ClockPanel.jsx:33,75`). On a network or server error the panel renders as "Not clocked in yet" with a live Clock in button, so an error looks identical to a normal morning. Same pattern in `src/components/AttendanceCard.jsx:20,43` and in leaves balance (`src/app/(staff)/attendance/leaves.jsx:66`, dashes with no explanation).
- Med: no in-screen role guard on Shifts, Holiday form, Attendance edit, Reports, Records, Users new/edit, or Freelancers new/edit. Gating is link-only (for example Shifts link only for admins at `src/app/(staff)/(tabs)/attendance.jsx:62`). A manager deep-linking to `/attendance/shifts` or any staff user opening `/users/new?id=...` reaches the form and relies entirely on the server refusing the mutation. Contrast with the correct pattern in `src/app/(staff)/users/index.jsx:31-41` and `src/app/(staff)/freelancers/index.jsx:52-58`, which render an "Admins only" / "Managers only" state.
- Med: UTC date bugs. `newRate()` builds `effectiveFrom` from `new Date().toISOString().slice(0, 10)` (`src/utils/freelancers.js:61`), which is the UTC date. Before 5:30 AM IST that is yesterday's date, so a rate added in the early morning starts a day early. Same UTC-slice pattern in `freelancerForm` (`:84`) and in `src/components/AttendanceParts.jsx:197-198` / `src/app/(staff)/attendance/holidays.jsx:29` (date-only strings parsed as UTC midnight). Mostly harmless in IST but fragile.
- Med: `leaveDays` counts plain calendar days, including Sundays and holidays, and the over-balance check blocks submit on that count (`src/components/AttendanceParts.jsx:145`, `src/app/(staff)/attendance/apply-leave.jsx:25-27,55-56`). If the server excludes Sundays and holidays, the client overstates the request and can wrongly refuse a valid application. The server's counting rule is UNVERIFIED in this repo.
- Med: pending regularization cards have no self-approval guard (`src/app/(staff)/attendance/regularization.jsx:21-56`). Leaves do exclude the requester's own card (`src/app/(staff)/attendance/leaves.jsx:89`), but a manager with a pending correction of their own sees Approve/Reject on it here. Server enforcement is UNVERIFIED.
- Low: `manualOverride` mutation is defined and exported but never used (`src/services/attendanceApi.js:92-100`); edit uses only `manualEntry` (`src/app/(staff)/attendance/edit.jsx:19,36-47`). There is no "reset sessions" control, only an alert that saving replaces the day's sessions (`:52`).
- Low: `attendanceRate` puts `half_day` in the denominator but not the numerator (`src/utils/attendance.js:73-76`), so a half day drags the rate down exactly like an absence. The comment says it is the web formula, so confirm against web before changing.
- Low: "My requests" is derived from the attendance list capped at 100 records over 90 days (`src/app/(staff)/attendance/regularization.jsx:57-61`), so older or numerous requests silently disappear.
- Low: leave reject comment is optional while regularization reject requires a reason (`src/app/(staff)/attendance/leaves.jsx:27-28,40-46` vs `src/app/(staff)/attendance/regularization.jsx:44`). PLAN says leave approvals happen "with comment", so the leave flow is the inconsistent one.
- Low: clock-out and Home clock-in both await `getLocation()` first, so a slow GPS fix delays an otherwise instant action by up to 8 seconds, and clock-out has no way to proceed without waiting (`src/app/(staff)/attendance/clock-out.jsx:33`, `src/components/AttendanceCard.jsx:39`). `getLocation()` also calls `requestForegroundPermissionsAsync()` on every clock-in and clock-out instead of checking the existing permission status first (`src/utils/attendance.js:46`).
- PLAN discrepancies: leave balance math (casual 12 a year accruing 1 a month, sick 5) is server-side, the client only displays `balance/used/total` from `getLeaveBalance`; accrual math is UNVERIFIED here. Auto clock-out has no client code, only the event label `auto_clock_out` (`src/app/(staff)/attendance/day.jsx:15`); behaviour is UNVERIFIED. Late detection is server-computed; the client only displays `isLate` / `lateMinutes`.

**UX and flow**

- Clock-in speed: Home is 1 tap, Attendance tab is 1 tap for office and 2 taps for WFH (toggle then clock in). In practice the tap is not instant: every path awaits GPS first (up to 8 seconds), and on first use the permission prompt appears before anything happens. No loading state explains the wait on Home beyond the button spinner.
- GPS failure states: there is no GPS failure state in the UI at all. Denial, timeout and location errors all return `undefined` silently (`src/utils/attendance.js:45-57`), the mutation is sent without location, and the user only learns the outcome from a server error toast, if at all. The "within 100 m of the office" rule is stated once (`src/components/ClockPanel.jsx:99`) but a user outside the radius gets no distance hint, no "try again with location" action, and no explicit "clock in without GPS" choice.
- Break UX: Break / End break is one tap each with loading states, the timer visibly pauses, and history with times is shown per session. Gaps: the panel shows total break minutes but not the running length of the current break, there is no nudge for an unusually long break, and the only place break length is visible live is the session list below the fold. Clock-out does warn that an open break ends now (`src/app/(staff)/attendance/clock-out.jsx:70`).
- Leave apply friction: good parts are type chips, inline calendar date pickers, live "3 days. 8 casual days left." feedback and a disabled submit when over balance. Friction: no half-day option, no one-tap "today" / "tomorrow" shortcut, the 10-character reason minimum is only in a hint, and maternity/paternity being uncounted is a footnote under the balance cards rather than shown on the type chips where the choice is made.
- Calendar readability: dots are 6 px with a legend, late is a second red dot, today has an accent border, and each cell has a screen-reader label. Readable as a status map, weak as a work log: no hours on any day, future days are tappable and open an empty day sheet, and a month with mixed statuses is only distinguishable by dot colour.
- Approval flows: pending counts surface as badges on the Attendance tab and the Leaves tab defaults to Team + Pending. Leave approve/reject is inline on the card with an optional comment (two taps to reject: arm, then confirm). Regularization approve is one tap with no comment, reject needs a reason. There is no bulk approve, no way to see the requester's calendar around the requested dates from the approval card, and no self-approval guard on regularization.
- Reports UX: period chips plus prev/next stepping with future navigation disabled is clean, and "Most hours" plus status bars give the summary without scrolling. But records are capped at 50 with only a "FIRST 50 OF N" label and no paging, unlike Users/Freelancers which have a Pager. The "Export to Excel from the web app." note only renders inside the has-data branch (`src/app/(staff)/attendance/reports.jsx:80`), so the empty state gives a manager no pointer to the web export.

**Missing:** offline clock-in/out/break queue with retry and a visible "pending punch" state; WFH clock-in that skips GPS; in-screen role guards; self-approval guard on regularization; half-day leave and leave cancel/withdraw; leave day count that excludes Sundays/holidays (or the server's day count shown instead); any client surfacing of auto clock-out; per-employee shift assignment UI; "who is on break now" team view; bulk approve; approver view of the requester's surrounding calendar.

**Add:** P0 offline-tolerant clock-in/out; P0 skip GPS for WFH clock-in and clock-out; P1 in-screen role guards; P1 GPS failure messaging; P1 self-approval guard on regularization; P1 server-confirmed leave day count; P2 half-day leave; P2 live break length on the ClockPanel. See ADD list.
**Remove:** `manualOverride` mutation, duplicate block-reason logic, two delete-confirm patterns. See REMOVE list.

## Users and Teams

**State:** built, with the correct role-gate pattern on the list screens and link-only gating on the forms.

**What exists**

- Users list (admin only) with role chips and counts, search, 20 per page, delete for super_admin only: `src/app/(staff)/users/index.jsx:28-45,149-170`.
- Create/edit form: account, role, location, employment, compensation and bank for payroll admins, Active switch on edit, password create-only: `src/app/(staff)/users/new.jsx:45-193`, `src/utils/users.js:14-68`.
- Teams: Surat / Mumbai / Delhi location cards with counts, admin-only "No location" card, team detail list, custom teams with lead star for the task picker: `src/app/(staff)/teams/index.jsx:18-39,109-140`, `src/app/(staff)/teams/[location].jsx:32-131`, `src/components/UserPicker.jsx:58-112` (PeoplePicker).

**Code quality**

- Low: `userBody` does not trim `phone`, and for payroll editors an emptied salary field is sent as `0` (`monthlyGrossSalary === '' ? 0`, `src/utils/users.js:53,62`), which can zero a salary on edit if the field is cleared. `userFormError` (`src/utils/users.js:34-46`) also never validates email format client-side.
- Low: duplicated logic. The 350 ms search debounce is copy-pasted in `src/app/(staff)/users/index.jsx:60-64`, `src/app/(staff)/teams/[location].jsx:37-41`, and `src/app/(staff)/freelancers/index.jsx:44-48`. The FlashList + Pager + header pattern is repeated across the same three screens, and the form scaffold is repeated across the attendance forms. Two delete-confirm patterns exist: `ConfirmDelete` (`src/components/AttendanceParts.jsx:187-206`) and `ConfirmDialog` (used in users and freelancers).
- Low: the date assertion in `src/utils/users.check.js:37` accepts either 4 or 5 January, which means the test passes under any timezone instead of pinning the IST behaviour it claims to check. The `dateInput` helper itself (`src/utils/users.js:10-16`) is correct local-date handling.
- Low: per-card count queries in `src/app/(staff)/teams/index.jsx:18-39`. Each `LocationTeamCard` fires its own `useGetUsersQuery({ location, limit: 1 })` just for the total. A single counts endpoint (or one query) would replace three to four parallel requests.

**UX and flow**

- Role chips double as filters with counts (`src/app/(staff)/users/index.jsx:100-113`), salary shows only for payroll admins (`src/components/UserParts.jsx:46-50`), and the Active switch explains itself ("Inactive people can't sign in", `src/app/(staff)/users/new.jsx:119-133`).
- Team location cards show counts but give no hint which office a person belongs to until tapped, and the "No location" card is admin-only with no equivalent prompt for managers who spot an unplaced person.
- No in-screen role guard on `users/new.jsx` (see Attendance C4). A deep link reaches the form and relies entirely on the server refusing the mutation.

**Missing:** resend invite / reset password action on users, read-only modules UI (explicitly skipped in PLAN M16), bulk import (web-only).

**Add:** P1 in-screen role guards on Users create/edit and Teams admin actions; P2 trim phone and fix the emptied-salary-sends-0 bug; P2 resend invite / reset password action. See ADD list.
**Remove:** `getPortalStaff` query (`src/services/userApi.js:17-23`, no usage anywhere in `src/`). See REMOVE list.

## Freelancers

**State:** built and good on detail. The list rate is ambiguous for multi-venture freelancers.

**What exists**

- List with stats, status and venture filters, search, 20 per page, manager-only view: `src/app/(staff)/freelancers/index.jsx:29-163`.
- Detail: profile, Call/WhatsApp/Email, Active/Inactive chips, per-venture cards with current rate and full rate history (past rates greyed), emergency contact, portfolio links, archive/restore/hard delete: `src/app/(staff)/freelancers/[id].jsx:48-115,138-226`.
- Create/edit form with photo picker (5 MB limit), ventures and rates up front, "More details" collapsed: `src/app/(staff)/freelancers/new.jsx:56-108,232-306`, `src/utils/freelancers.js:61-131`.
- Access rules in one place: view for super_admin/admin/manager, manage needs write access, archive/delete admin only: `src/components/FreelancerParts.jsx:18-22`.

**Code quality**

- Low: the photo uploads immediately on pick, before the form is saved (`src/app/(staff)/freelancers/new.jsx:58-76`), so cancelling the form orphans an uploaded image on Cloudinary. Also the 5 MB check at `:69` reads `a.fileSize`, which is undefined on some platforms, so the client-side limit is silently skipped there and only the server enforces it.
- Low: `setStatus` sends the freelancer's email on every status change with the comment "older servers blank it on any update that leaves it out" (`src/app/(staff)/freelancers/[id].jsx:119-124`). That is a workaround for a server bug baked into the client; it should be fixed server-side and the workaround removed.
- Low: hard-coded venture list in `src/app/(staff)/freelancers/new.jsx:266`. `addVenture` lists seven venture keys inline while `SERVICE_OPTIONS` in `src/utils/freelancers.js:5-20` only catalogues two of them. Derive the list from one shared constant so adding a venture does not need edits in two places.
- Med: UTC date bug in `newRate()` (see Attendance C5). A rate added before 5:30 AM IST starts a day early.

**UX and flow**

- Detail is good: a "Current rate" box plus a dated history with past rates greyed (`src/app/(staff)/freelancers/[id].jsx:60-92`). The list row is ambiguous: `headlineRate` picks the best current rate across all venture profiles (`src/utils/freelancers.js:59`, `src/components/FreelancerParts.jsx:56-58`) but the formatted rate carries no venture label, so on a multi-venture freelancer the list rate cannot be attributed to a venture. Also `currentRate` falls back to the latest-starting rate when none is live (`src/utils/freelancers.js:52-58`), so a future-dated rate can display as the "current" rate.
- No in-screen role guard on `freelancers/new.jsx` (see Attendance C4).

**Missing:** freelancer availability, payout/billing linkage, overlapping-rate validation in `RateEditor` (`src/app/(staff)/freelancers/new.jsx:109-131` allows overlapping effective ranges with no warning). Public freelancer apply form is skipped in PLAN M15, and the unused `createFreelancerPublic` mutation remains.

**Add:** P2 venture label on freelancer list rate; P2 upload the photo only on save and fix the 5 MB check; P2 overlapping-rate validation. See ADD list.
**Remove:** `createFreelancerPublic` mutation (`src/services/freelancerApi.js:24-27`). See REMOVE list.

## Invoices

**State:** substantially built. List, detail, create/edit, record payment, split payment, and create-from-quotation all exist. PDF share does not.

**What exists**

- List `src/app/(staff)/invoices/index.jsx`: 20 per page, search with 350 ms debounce, status and venture chips, issue-date filter, Collected / Outstanding / Overdue stats, paid-progress bar and red past-due date per row (`src/components/InvoiceParts.jsx`).
- Detail `src/app/(staff)/invoices/[id].jsx`: Total / Paid / Balance card, items and server totals, payments list with running total, timeline, status actions by state, linked quotation link, Preview via `src/app/(staff)/document-preview.jsx`, PDF download.
- Create/edit `src/app/(staff)/invoices/new.jsx` plus `src/components/InvoiceForm.jsx`: client/project pickers, item rows, GST chips, discount, live totals, collapsible billing address and printed issuer/bank details. Edit is draft-only, enforced in `new.jsx`.
- Record payment / advance / split: `src/app/(staff)/invoices/pay.jsx`. Mark as paid / Collect remaining: modal in `[id].jsx`.
- Create from quotation: `new.jsx` `FromQuotation`, prefilled by `fromQuotation` in `src/utils/invoices.js`, one invoice per quotation enforced with a 409 fallback that opens the existing invoice.

**Code quality**

- Med: PDF "share" does not exist. PLAN M11 claims "PDF download + share (WhatsApp to client)" and PLAN section 6 suggests WhatsApp sharing, but the only PDF helper is download-to-device (`downloadServerPdf`, with a 90 second timeout at `src/components/ServerDocument.jsx:12` and a first-use Android folder picker). There is no `Sharing.shareAsync` call anywhere in this slice; the only `expo-sharing` use in the repo is the tasks CSV export (`src/utils/tasks.js:100`). Filenames are correct and consistent: invoice `${invoiceNumber}.pdf` (`src/app/(staff)/invoices/[id].jsx:233`), quotation `QTN-...-V{n}.pdf` via `pdfTarget` in `src/utils/quotations.js`, receipt via `receiptName` in `src/utils/payments.js`.
- Med: split payment mislabels the bank leg (`src/utils/invoices.js:215-235`, `paymentRequest`). The bank/UPI portion is hardcoded to `paymentMethod: 'bank_transfer'`, the reference goes only on that leg, and notes go only on the cash leg. A user who splits a UPI plus cash payment gets a bank_transfer record, and there is no way to attach a reference to the cash leg. The pay screen label says "Bank / UPI portion" (`src/app/(staff)/invoices/pay.jsx`), which the code cannot honour.
- Med: numeric inputs strip characters but do not validate the result. `num()` keeps digits and dots, so `1.2.3` passes through and `parseFloat` silently reads `1.2` (`src/app/(staff)/invoices/pay.jsx:51`, `src/components/InvoiceForm.jsx:20`). The same applies to quantity, rate, price and budget fields. The amount cap check in `paymentProblem` (`src/utils/invoices.js`) runs on the parsed value, so the stored amount can differ from what the user typed without any warning.
- Med: unrounded client-side money math. `invoiceTotals` sums `parseFloat` products with no rounding (`src/utils/invoices.js:20-25`). Display is saved by `formatCurrencyExact` (2 dp), but any future use of these raw totals for comparison or a request body would carry float dust. Only `paymentRequest` and `markPaidBody` use `round2`. Note the form never sends a client total: `invoiceBody` sends items, tax rate and discount only, so the server stays the authority for invoice totals.
- Low: date filters send timezone-naive strings (`2026-11-21T23:59:59.999`, no offset) in `invoiceParams`, `paymentParams`, `quotationParams`. The "To covers the whole day" intent is right, but how the server parses a naive timestamp is not established from this code. Reports avoids this by sending plain local `YYYY-MM-DD` dates (`src/utils/reports.js`, `rangeFor`), which the server reads as whole India days.
- Low: O(n squared) recompute of payment running totals (`src/app/(staff)/invoices/[id].jsx`, `slice(0, i + 1).reduce(...)` per row). Fine at payment-list sizes, but a single pass accumulator is the obvious shape.
- Low: paid percent is computed in three places: `paidPercent` (`src/utils/invoices.js`), inline in `src/app/(staff)/payments/[id].jsx` (`paidPct`), and via `PaidBar` (`src/components/InvoiceParts.jsx`). Quotation money math duplicates the GST formula separately from `invoiceTotals`.
- Checked and sound: `invoiceTotals` matches the stated server formula (GST and discount both on subtotal), with node self-checks in `src/utils/invoices.check.js`. `paymentProblem` caps at balance due plus 0.001, split requires both legs positive, `afterPayment` counts only completed payments, `isPastDue` uses end of day. PDF fetch errors surface the server message or a timeout/connection message (`src/components/ServerDocument.jsx:17-33`).

**UX and flow**

- Invoice creation friction: one long scrolling form with 18 printed fields across two collapsed sections, item cards each with their own description/qty/rate inputs, and no autosave or draft persistence. Leaving the screen loses everything typed. Client and project pickers load only the first 100 records (`useGetClientsQuery({ limit: 100 })`, `useGetProjectsQuery({ limit: 100 })`), so a client beyond the first 100 cannot be selected at all, even though the picker is searchable (search only filters the loaded 100). Same 100 cap in `src/components/QuotationForm.jsx`.
- Validation feedback: the blocking problem is shown as muted helper text and only once a client is chosen (`{!!problem && !!f.client && ...}`), and the submit button is simply disabled. A user who has not picked a client gets no explanation of what is missing. There is no per-field validation for printed email, GST, IFSC or pincode; those rely on the server round trip.
- Payment recording clarity: mostly good. Balance Due card with a "Full amount" shortcut, live "After this payment" preview (paid, balance, new status, and the note that only completed payments count), and the advance-on-draft explanation are all clear. Weak spots: the split toggle hides the method picker entirely, so the user never sees that the bank leg is forced to bank_transfer; the payment purpose chips are labelled Advance / Part / Final / Other with only a one-line hint for Advance; and the Mark as paid modal records a final completed payment with no reference, date or notes field.

**Missing:** PDF share and WhatsApp share for invoices; invoice list export; a standalone "record payment" entry point (payments can only be recorded from an invoice, by design); per-field validation for printed email/GST/IFSC/pincode; autosave or draft persistence for the long form.

**Add:** P0 PDF share including WhatsApp; P1 fix split payment to let the user pick the bank-leg method and attach a reference to either leg; P1 lift the 100-record cap on client/project pickers or make them server-searched; P2 persist form drafts locally; P2 show the blocking form problem prominently and validate printed fields client-side. See ADD list.
**Remove:** duplicated paid-percent computation, O(n squared) running-total loop. See REMOVE list.

## Payments

**State:** built. List, detail, edit, receipt PDF. No "New payment" button by design.

**What exists**

- List `src/app/(staff)/payments/index.jsx`: method / type / status / date filters, Collected / Cash / Outstanding stats, 20 per page. No "New payment" here, as on the web: recording comes with invoices (M11).
- Detail `src/app/(staff)/payments/[id].jsx`: amount, receipt number with copy, purpose/method/date/reference, invoice card with paid bar and other payments, receipt PDF download, delete for super_admin only.
- Edit `src/app/(staff)/payments/edit.jsx`: amount capped at balance due plus this payment, date sent only if changed.

**Code quality**

- Low: when the invoice is not loaded, `maxEditable` returns `null` and the edit form applies no cap at all, relying entirely on the server to reject an over-amount edit (`src/app/(staff)/payments/edit.jsx`, `maxEditable` in `src/utils/payments.js`). The same file otherwise handles this well (cap hint, clear error, date not re-sent when unchanged).
- Low: duplicated paid-percent computation (see Invoices). Edit caps the amount at balance due plus this payment; the server does not check on edit, the web shows "Max Rs 0".
- Checked and sound: `paymentProblem` caps, `maxEditable` adds back only completed payments, receipt naming, PDF fetch errors surfaced.

**UX and flow**

- Receipt: server PDF downloaded with the user's token and opened in the share sheet, named after the receipt number. Download only, no in-app share action.
- Figures: Collected (excl. cash) / Cash / Outstanding. The web's "Bank / Online" card repeats Collected, so it is dropped here. "To" date sends the end of that day, so that day's payments are included (the web drops them).

**Missing:** PDF share for receipts, standalone record payment entry point, manager/employee read-only view (payments are super_admin/admin only).

**Add:** P0 PDF share including WhatsApp (same work as Invoices); P1 split payment method fix (same work as Invoices). See ADD list.

## Quotations

**State:** built, including the full version machinery and the document editor. The form has a render-phase state bug.

**What exists**

- List `src/app/(staff)/quotations/index.jsx`: Quoted / Accepted / Conversion stats, status and venture chips, date filter, Show archived toggle.
- Detail `src/app/(staff)/quotations/[id].jsx`: version chips, MoneyCard, version history timeline, send/resend, accept/reject/expire per version, create revision, save working draft as next version with note, discard draft, archive/restore, legacy baseline to enable version history, create invoice from the selected version or open the linked invoice.
- Create/edit `src/app/(staff)/quotations/new.jsx` and `edit.jsx` plus `src/components/QuotationForm.jsx`: template cards, server-suggested text with dirty-field protection and per-page "Restore suggested text", collapsible PDF pages, GST, budget/price with live totals, printed recipient/issuer/bank details, client/project locked on edit.
- Create invoice from quotation is built (see Invoices).

**Code quality**

- Med: `setState` during render. When new server defaults arrive and differ from `applied`, the component calls `setApplied` and `setF` directly in the render body (`src/components/QuotationForm.jsx:97-101`). It is guarded by the `defaults !== applied` check, but it is still the discouraged pattern: it forces an extra render per defaults change and is fragile under StrictMode double rendering. Move it into an effect keyed on the defaults object.
- Low: `saveVersion` in `src/app/(staff)/quotations/[id].jsx` picks the new selection as `res.data?.revision?.version ?? q.latestVersion + 1`. If the server response shape ever differs, the fallback guesses the version number instead of refetching.
- Low: unrounded client-side money math in `money()` (`src/utils/quotations.js:15-20`), same finding as Invoices.
- Checked and sound: version rules match the web (send draft versions, resend sent ones, accept/reject draft or sent, expire sent; create a revision from a version; archive/restore). Node self-checks in `src/utils/quotations.check.js`.

**UX and flow**

- The per-PDF-page collapsible sections with "Restore suggested text" and dirty-field protection are the right phone pattern, and the submit button correctly waits for server defaults (`defaultsReady`) so a quick tap cannot freeze the previous client's details.
- Weak spots: only one page section opens at a time, so reviewing a 4-page Panigrahna quotation means constant open/close; a zero-price quotation is submittable (`ready` only requires price >= 0); and if the defaults request fails, the submit stays disabled with only a small inline error row and a retry button to explain why.
- Same 100-record cap on client/project pickers as Invoices.

**Missing:** PDF share, quotation price greater than zero validation, per-field validation for printed email/GST/IFSC/pincode, autosave or draft persistence.

**Add:** P0 PDF share including WhatsApp (same work as Invoices); P1 lift the 100-record cap on pickers; P2 fix the render-phase setState and add price greater than zero validation; P2 persist form drafts. See ADD list.

## Reports

**State:** built. Five tabs, six preset ranges, cash toggle, charts. No export, no custom range.

**What exists**

- `src/app/(staff)/reports/index.jsx`: five tabs (Revenue, Pipeline, Clients, Invoices, Productivity), six preset ranges (7D, 30D, This Month, Last Month, This Year, All), With/Without cash toggle on Revenue, monthly ColumnCharts, DonutCharts, BarLists, monthly breakdown rows, aging card.
- Charts in `src/components/Charts.jsx:22` (`DonutChart`, `ColumnChart`, `BarList`). Reports uses DonutChart in five places (lines 91, 144, 169, 208, 261: payment methods, lead sources, client status, invoice status, task status), alongside ColumnChart and BarList. The `Ring` component exists in `src/components/DashboardParts.jsx:126` but Reports never uses it.
- Fixes over the web: the With/Without cash toggle also changes the figures (the web only relabels them), and ranges start at local midnight (the web's "This Month" starts a day early in India). The aging card reads "Nothing past due" when every bucket is empty.

**Code quality**

- PLAN says charts are "bar lists, month bars and a ring instead of donuts". That is out of date. The code uses donuts. Either correct PLAN.md M13 to say Reports uses donuts, or replace the donuts with the Ring/BarList the plan describes.
- Date handling `rangeFor` (`src/utils/reports.js`): preset ranges only, correctly built from local calendar days (This Month starts on the 1st, Last Month handles January correctly, All sends no dates). Server fixes noted in PLAN (plain dates are whole days in India time, months group in India time, average conversion uses `convertedAt`, aging covers all unpaid invoices with no gaps, bad dates return 400) are server-side and not verifiable from this repo.

**UX and flow**

- The donuts are well built (tap a legend row for exact value and percent, values always shown as text beside colour), but the centre label is constrained (`max-w-[96px]`, `numberOfLines={1}`) and `ColumnChart` hides alternate month labels once there are more than 8 months, so the All range is hard to read. UNVERIFIED visually.
- Stat tiles show compact money (`formatCompactCurrency`, `src/utils/formatters.js`: `Rs 6.21L` style) with the full amount only in the monthly rows below.
- The Clients tab mixes all-time totals with range-filtered new clients, which is labelled in the UI (`src/app/(staff)/reports/index.jsx`, Clients note) but still easy to misread.
- No export anywhere in this slice. Reports has no CSV/PDF/share export (PLAN notes this is also missing on the web). Invoice, payment and quotation lists have no export either, even though the tasks module already has a CSV share helper (`src/utils/tasks.js:100`).

**Missing:** report export (CSV/PDF), custom date range, manager access (the server allows super admin and admin only).

**Add:** P1 reports export (CSV share, reusing the tasks pattern) and a custom date range; P2 correct PLAN.md M13 or replace donuts with Ring/BarList. See ADD list.

## Notifications

**State:** mostly wired and working in code. The pipeline, channels, action buttons, badge sync, and socket fallback are genuinely built. The weak points are routing (most types have no explicit destination) and permission (the system prompt is shown cold).

**What exists**

- Android channels in `src/services/push.js:19-27`: `reviews` MAX, `tasks` HIGH, `chat` HIGH, `sales` HIGH, `people` HIGH, `money` DEFAULT, `default` DEFAULT. Channel creation at `src/services/push.js:76-82`. Note `money` is DEFAULT, so invoice/payment pushes do not sound by default on Android. Channels are created in `registerPush` before permission is asked, and once created on a device their importance cannot be changed by later code edits.
- Action-button categories in `src/services/push.js:30-35`: `review` (Approve/Open), `task_new` (Start work/Open), `chat` (Reply with text input/Open), `open` (Open). Handled in `src/hooks/useLiveUpdates.js:25-43` (`QUICK`/`runQuick`): approve sets task done, start sets in progress, reply posts a task comment; failure falls back to opening the item.
- Foreground handler in `src/services/push.js:40-45`: banner shows while the app is open, suppressed only when the open screen is the same task (`setViewing`, `src/services/push.js:14-15`), sound gated by the in-app sound setting.
- Socket fallback in `src/services/push.js:54-70` and `src/hooks/useLiveUpdates.js:52-63`: if the phone has no push token, `showLocalNotification` posts the same banner from the socket event. `CATEGORY_OF` (`src/services/push.js:54-57`) only maps `task_review_*`, `task_assigned`, `task_comment`, `mention`; every other type gets no category, so no action buttons on the local copy.
- Push registration in `src/services/push.js:73-94`: Android channels, then `getPermissionsAsync` / `requestPermissionsAsync`, then Expo token sent to `/auth/push-token` (`src/services/authApi.js:7`). No-op on web and simulators, warns and continues without a project id (`src/services/push.js:89`). An EAS project id now exists in `app.json`, so that warning path should no longer trigger.
- Tap handling in `src/hooks/usePushTaps.js:6-13`: `useLastNotificationResponse` covers the cold-start tap from a killed app, and `clearLastNotificationResponseAsync` prevents re-handling. Web stub in `src/hooks/usePushTaps.web.js:1-2` is a no-op.
- Inbox screen `src/app/(staff)/(tabs)/notifications.jsx`: FlashList, All/Unread chips with unread count, Today/Week/Month date filters (`:23-31`), page size 20 (`:31`), swipe-to-delete with 5 second Undo (`:118-136`), mark-all-read (`:138-144`), pull to refresh, skeleton, error retry, empty states. API in `src/services/notificationApi.js:4-24`: list, unread count (`keepUnusedDataFor: 30`), mark one read, mark all read, delete.
- Badge sync in `src/app/(staff)/(tabs)/_layout.jsx:10-16`: tab badge from `useGetUnreadCountQuery` (99+ cap) plus `Notifications.setBadgeCountAsync(unread)` to keep the app icon in step; live count updates via socket `notification:unread` in `src/hooks/useLiveUpdates.js:66`.
- Sound toggle exists in `src/components/AccountSettings.jsx:41,69` ("Notification sound", on by default, stored via `src/utils/notificationSound.js:8-9` in SecureStore-backed prefs). No test-sound button.

**Code quality**

- Med: permission is requested raw with no priming. `registerPush` calls `requestPermissionsAsync()` immediately on first signed-in mount (`src/services/push.js:83-84`), with no screen explaining why. On iOS a denial is a one-way door to Settings. No "push on/off" toggle exists either (PLAN M17 unchecked).
- Med: no timeout and no retry configured on `fetchBaseQuery` (`src/services/api.js:9-17`). `src/utils/apiError.js:5` handles `TIMEOUT_ERROR`, but nothing can produce one, so that branch is dead. A hung request hangs the screen until the user pulls to refresh.
- Med: the local socket notification always uses `sound: 'default'`, ignoring the user's sound-off setting (`src/hooks/useLiveUpdates.js:52-63` vs `src/services/push.js:58-70`). Only the foreground handler (`src/services/push.js:43`) and web toast respect `isSoundOn`. A user who turned sound off still hears background socket notifications on a phone without push.
- Low: `src/utils/notificationSound.js:12-16` creates one shared audio player and seeks to 0 before replay; rapid successive notifications reuse the same player, so a second sound can cut off or restart the first.
- Low: `cancelAllScheduledNotificationsAsync()` runs at module import on every app start (`src/services/push.js:49`). Correct today (server pushes replaced local reminders), but it will silently cancel any future scheduled local notification added elsewhere unless this line is removed first.
- Low: the `useLiveUpdates` effect depends on `client`, so toggling the prop would reconnect the socket and re-register push; in practice the layouts mount it once.
- PLAN mismatches: M2 claims deep links for 15 types including `project_stage_reverted`, but `src/constants/notifications.js:7-26` has no `project_stage_reverted` entry and `src/utils/notificationRoute.js` has no rule for it, so it falls back to the generic icon and the server link or `/notifications`. M2 claims "unread badge on tab", true for staff only; the client layout has no badge and no inbox tab. PLAN lists realtime event `notification:read`, but no listener for it exists anywhere in `src` (grep zero hits).

**UX and flow**

- Deep links are partially wired. `src/utils/notificationRoute.js:3-9` has exactly two explicit rules: `regularization_request` goes to `/attendance/regularization`, and a Task reference goes to `/tasks/:id` (except `task_deleted`). Everything else returns the server `link` field, or `/notifications` when there is no link, with `/dashboard` rewritten to `/`. There is no verified per-type route for lead, meeting, invoice, payment, project, contract, or leave notifications; they work only if the server sends a correct in-app path. If the link is missing, the user lands on `/notifications`; if it is an absolute URL, `router.push` may fail. UNVERIFIED without a sample server payload. Only Task and regularization notifications have guaranteed destinations.
- Client mapping in `src/hooks/useLiveUpdates.js:16-22`: `/tasks/:id` becomes `/portal/tasks/:id`, anything else non-portal collapses to `/portal` home, so a client tapping an invoice or meeting notification loses the destination entirely.
- Permission priming: no explanation screen precedes the system prompt, and there is no later re-ask path or settings deep link for a user who denied. AccountSettings has biometric and sound toggles but no push toggle or permission status.
- Quiet hours: none. Grep for quiet, DND, do-not-disturb, and notif prefs across `src` finds no quiet-hours logic. The notification-preference API exists (`src/services/settingsApi.js:5-13`, `getNotifPrefs` / `updateNotifPrefs`) but no screen imports `useGetNotifPrefsQuery`, so per-type in-app/email preferences have no UI. Sound on/off is the only notification setting a user can change.
- Push while open vs killed: open app shows the system banner (suppressed only for the task on screen); backgrounded app relies on the server push or the socket local notification; killed app relies on the push tap via `useLastNotificationResponse`. The killed-app path is UNVERIFIED without running the app, and the badge count in that path depends on the push payload, which this repo cannot confirm.
- Mark read: there is no per-row mark-as-read action. A notification is marked read only by tapping it open (`src/hooks/useLiveUpdates.js:21`), or all at once via the mark-all button (icon-only, `accessibilityLabel="Mark all as read"`). If the destination fails to open, the item is already marked read.
- Delete: swipe-to-delete with 5 second Undo is good, and leaving the screen flushes pending deletes (`src/app/(staff)/(tabs)/notifications.jsx:109-113`). But the delete fires even when offline with no retry: the item vanishes from the list and the DELETE is attempted after 5 seconds regardless of connectivity.
- Offline UX: the banner (`src/components/OfflineBanner.jsx:9-18`) shows only when `isInternetReachable === false`, is `pointerEvents="none"`, and announces politely. Good. But mutations made offline (mark read, delete, quick approve/start/reply) fail with a generic toast and no queue or retry, so offline work is lost. The banner promises "Showing what was last loaded", but many endpoints set `keepUnusedDataFor: 0` (for example `src/services/attendanceApi.js:45-277`, `src/services/clientApi.js:11-65`, `src/services/freelancerApi.js:9`), so RTK Query evicts their data on unmount and an offline screen shows an error or empty state, not the last load.

**Missing:** notification permission priming screen and a re-ask/settings path after denial; push on/off toggle and per-type notification preferences UI (API exists, UI does not); quiet hours / do-not-disturb; explicit deep-link routes for lead, meeting, invoice, payment, project, contract, and leave notification types; client inbox screen and client badge count; client notification routing that preserves invoice/meeting/project destinations; notification icon config for `task_review_requested`, `task_review_reminder`, `task_review_late`, `project_stage_reverted`, and leave types (all fall back to the generic Bell icon via `src/constants/notifications.js:28-29`); offline mutation queue or retry; any test runner; notification sound test button.

**Add:** P0 permission priming before the raw system prompt; P0 explicit deep-link map for every notification type; P1 client inbox and badge; P1 notification preferences UI; P1 offline mutation queue; P2 quiet hours. See ADD list.

## Client Portal

**State:** half a product. Projects and tasks are genuinely built. Home is nearly empty, invoices and meetings are placeholders.

**What exists**

- Tabs in `src/app/(client)/(tabs)/_layout.jsx:5-24` (Home, Projects, Meetings, Invoices, Profile).
- Projects list `src/app/(client)/(tabs)/portal/projects.jsx` (FlashList, 10 per page, stage meter, deadline), project detail `src/app/(client)/portal/projects/[id].jsx` (stage, deliverables, milestones, paged tasks, project chat, files), task detail `src/app/(client)/portal/tasks/[id].jsx` (read-only apart from chat, checklist, files, `setViewing` at line 21 to suppress its own banners).
- Profile `src/app/(client)/(tabs)/portal/profile.jsx` reuses `AccountSettings` (avatar, biometric lock, sound, change password, sign out).
- Client socket/push via `src/app/(client)/_layout.jsx:7` (`useLiveUpdates({ client: true })`).
- Confirmed placeholder: `src/app/(client)/(tabs)/portal/invoices.jsx:1-5` and `src/app/(client)/(tabs)/portal/meetings.jsx:1-5` are only `<ComingSoon title="..." tabs />`. The ComingSoon copy (`src/components/ComingSoon.jsx:8-21`) tells the client to use the web.
- Home is thin: `src/app/(client)/(tabs)/portal/index.jsx:6-19` shows a greeting plus the 5 most recently updated tasks and a "See all projects" button, and nothing else. It ignores loading and error states entirely (no `isLoading`/`isError` read).

**Code quality**

- PLAN M18 is checked, but the home line directly under it admits "the rest of Home below is still to do", and meetings/invoices/profile rows are unchecked, matching the placeholders found.
- PLAN already flags portal invoices as blocked server-side (clients can see drafts, `?brand=` overrides the client filter), so the mobile placeholder is not just a missing screen. Server fix needed first.
- No badge sync exists for the client shell. `src/app/(client)/_layout.jsx:7` mounts live updates but never calls `setBadgeCountAsync`, and there is no client inbox tab to show a count.
- Empty/error states: the inbox has good coverage (skeletons, CloudOff retry, contextual empty copy). `src/components/EmptyState.jsx:5-17` and `src/components/Skeleton.jsx:8-17` (reduced-motion aware) are solid shared pieces. Portal home uses neither.

**UX and flow**

- When the client has no tasks, the screen shows only the greeting header and nothing else: no empty state, no loading skeleton, no error state, no link to projects except the button that only renders when tasks exist. A new client with zero tasks sees an almost blank screen.
- Portal gaps: invoices and meetings tabs are dead ends that send the client to the web. PLAN M18 also lists as missing: onboarding wizard/FAQ, venture-branded header, totals (invoiced/paid/outstanding), active projects, upcoming meetings, recent invoices.
- Client notification taps collapse to `/portal` home for anything that is not a task (see Notifications).

**Missing:** portal home loading/empty/error states, totals, upcoming meetings, recent invoices, venture header; portal invoices list and detail with PDF download/share (blocked server-side first); portal meetings list, request-new, detail, and cancel; portal onboarding wizard / FAQ; client inbox and badge.

**Add:** P0 portal home loading/empty/error states; P1 client inbox and badge; P2 portal invoices and meetings, only after the server fixes the client invoice filter. See ADD list.

## Settings / Profile

**State:** not built. Every staff user sees a Settings row that lands on Coming Soon, and none of the PLAN M17 screens exist.

**What exists**

- AccountSettings `src/components/AccountSettings.jsx:1-74` shows a read-only profile card (name, email, role, avatar), a biometric toggle, a notification sound toggle, Change password, Verify email if needed, and Sign out. It sits at the bottom of the More screen (`src/app/(staff)/(tabs)/more.jsx:64`) and is reused by the client Profile tab.
- `src/services/settingsApi.js:1-88` defines the endpoints (notification prefs, org settings, profile update, roles, security, integrations, Zoho, email previews), but no screen uses them. The tag types exist in `src/services/api.js:52-54` (`NotifPrefs`, `OrgSettings`, `RolesPerms`, `SecuritySettings`, `IntegrationSettings`, `EmailPreviews`) but nothing reads or writes them.
- Duplicate change password endpoint: `src/services/settingsApi.js:26-28` defines `changePassword` (`PUT /auth/password`) and exports `useChangePasswordMutation`, duplicating `src/services/authApi.js:17` and `:26`. Only the authApi one is used, in `src/app/change-password.jsx:14`. The settingsApi copy is dead and can drift.

**UX and flow**

- More screen: search results include dead routes. `src/app/(staff)/(tabs)/more.jsx:30-33` searches all `NAV_ITEMS` plus quick actions. `src/constants/index.js:218` lists Settings at `/settings`, and lines 201-217 list Dashboard at `/dashboard`, Payroll at `/payroll`, My Payslips at `/my-payslips`. None of those routes exist: there is no `src/app/(staff)/settings`, no `src/app/(staff)/dashboard/index.jsx` (only `venture/[brand].jsx`), no `src/app/(staff)/payroll`, and no `src/app/(staff)/my-payslips`. Tapping one pushes to `src/app/+not-found.jsx:1-5`, which renders `ComingSoon`. The section list hides `/dashboard` via `IN_TABS` at `src/app/(staff)/(tabs)/more.jsx:12`, but search does not.
- More screen depth is otherwise good. Sections mirror the web sidebar groups, role filtering uses `canSeeNavItem` (`src/app/(staff)/(tabs)/more.jsx:19-21`).
- Biometric toggle proves the biometric first (`src/components/AccountSettings.jsx:36-39`). Good.
- Dead `SignedInHome` export in `src/components/SignedInHome.jsx:43-50`: a placeholder screen nothing renders, and `HomeHeader` is the only used export from that file.

**Missing:** Settings screen at `/settings` and every M17 screen: profile edit with avatar upload, notification preferences, push on/off, biometric settings, org settings, roles and permissions matrix, security policy, integrations (Zoho OAuth), email template previews.

**Add:** P0 build the real Settings screen at `/settings` and wire it to the existing settingsApi (start with profile edit, notification preferences, push on/off, and the existing account block); P0 exclude dead routes from More search until the screens exist; P1 profile edit with avatar upload; P1 notification preferences and push on/off toggle. See ADD list.
**Remove:** duplicate `changePassword` in settingsApi; dead `SignedInHome` export; dead routes from More search until the screens exist. See REMOVE list.

## Finance

**State:** there is no Finance module in the app. Payroll and payslips do not exist as a usable module.

**What exists**

- No `src/app/(staff)/payroll/` directory and no `my-payslips` route file.
- The only payroll code is `src/services/payrollApi.js:3-43` (endpoints for runs, finalize, reopen, my slips, slip PDF) with exported hooks at lines 33-42. No file in `src/` imports it (verified by grep; `src/store/index.js:1-8` imports only `api` and `authSlice`). RTK Query `injectEndpoints` only registers when the module is imported, so all seven payroll hooks are unreachable even though the tag types exist in `src/services/api.js:84-85`.
- Nav entries in `src/constants/index.js:211-212` (`Payroll` at `/payroll`, `My Payslips` at `/my-payslips`), grouped under Financials at line 226 and Self-Service and HR at line 232.
- `canAccessPayroll` in `src/utils/access.js:5-9`, used only for salary visibility in Users (`src/app/(staff)/users/index.jsx:54`, `src/app/(staff)/users/new.jsx:47`) and the `payrollOnly` nav filter (`src/utils/access.js:17`).
- Dead nav is live: the More screen renders every `NAV_ITEMS` entry that passes `canSeeNavItem` and pushes `router.push(i.path)` on tap (`src/app/(staff)/(tabs)/more.jsx:60`). `Payroll` and `My Payslips` pass the filter for eligible users but `/payroll` and `/my-payslips` have no route files, so tapping them leads nowhere useful (UNVERIFIED at runtime: expected Expo Router unmatched-route screen, not verified by running the app).
- Also note: `src/utils/access.js:1` hardcodes a personal email, `jaimishchhowala@rudhramenterprises.com`, in the payroll access allowlist. Client-side allowlists are bypassable and rot when people change; this should be server-driven.

**Missing:** My Payslips list and PDF view, payroll runs list and run detail, generate/finalize/reopen UI. PLAN M14 is entirely unchecked, and that matches code.

**Add:** P0 remove or hide the dead Payroll / My Payslips nav entries until the routes exist; P1 build My Payslips (read-only list plus slip PDF download/share), the highest-value payroll slice, endpoints already exist in `payrollApi.js` (`getMySlips`, `downloadSlipPdf`). See ADD list.
**Remove:** `src/services/payrollApi.js` or wire it up; remove the `PayrollRun` / `SalarySlip` tag types from `src/services/api.js:84-85` if payrollApi is removed. See REMOVE list.

---

# iOS: Dynamic Island and widgets

## Verdict

Dynamic Island Live Activities are already built and wired for exactly two cases, clock-in and the task stopwatch, via `expo-widgets`. This is further along than the brief assumed. But the lifecycle is fragile: the task timer can go stale or orphaned after the app is killed or restarted, and there is no push-to-update path. There is no home-screen widget at all.

A JS toast library (Dynaura, Sileo, or any other) cannot run on the Dynamic Island. A JS toast renders inside the app window only, like the existing custom toast in `src/components/Toast.jsx` (one toast at a time, newest wins, 4 seconds, top-anchored with safe-area insets). The Dynamic Island and Lock Screen are native ActivityKit surfaces driven only by the `expo-widgets` `createLiveActivity` path already in the repo. No toast library can replace, restyle, or extend that native surface; it can only change the in-app toast. No Dynaura or Sileo import was found in the repo.

## What exists

- Plugin and deps: `app.json:83` lists `"expo-widgets"`; `package.json:42` has `"expo-widgets": "~58.0.29"`, `package.json:33` has `"expo-notifications": "~58.1.9"`, `package.json:26` has `"expo-haptics": "~58.0.8"`.
- Layout: `src/widgets/WorkTimer.jsx:3` imports `createLiveActivity` from `expo-widgets`; `:50-51` exports two types, `ClockTimer` and `TaskTimer`, sharing one layout. Accent is `#C98B4A` (`:11`). Icon is `stopwatch.fill` for tasks, `cup.and.saucer.fill` when paused, `clock.fill` otherwise (`:12`).
- Timer: `src/widgets/WorkTimer.jsx:15` sets `timerInterval` from `props.start` to `start + 24h`, counting up, with `pauseTime` at `:17`. iOS ticks the timer itself; the app only updates on change, per the comment at `:7`.
- Layouts: banner at `:22-31` (icon, title, sub, large timer), `compactLeading`/`compactTrailing` at `:33-34`, `minimal` at `:35`, expanded leading/trailing/bottom at `:36-44` (expanded shows "Stopwatch" or "Clocked in" plus title or sub).
- Service: `src/services/liveActivity.ios.js:5-7` loads the widget module only if the native `ExpoWidgets` module exists, via `requireOptionalNativeModule`, so Expo Go or an old dev build silently gets no Live Activity. `showWorkTimer(kind, props)` at `:11-20` takes the first instance of that type, ends extras at `:15-16`, ends the live one when `props` is null at `:17`, updates it if one exists, or starts it at `:20`.
- Android/web stub: `src/services/liveActivity.js:1-2` is a no-op `showWorkTimer`, with the comment "Web and Android: no Dynamic Island."
- Clock-in wiring, verified end to end in code: mounted in the staff shell (`src/app/(staff)/_layout.jsx:13-14` calls `useLiveUpdates()` and `useClockTimer()`). `src/hooks/useClockTimer.js:9` polls today status every 60 seconds. `:11-13` derives active session and open break. `:17` ends the clock Live Activity when not active. `:19-24` starts or updates it with title "On a break" or "Clocked in", sub "Since <time>", `start` recomputed as now minus worked seconds, and `paused: now` on break. Worked seconds come from `src/utils/attendance.js:29-36`, which stops the count at an open break start and subtracts finished breaks.
- Task stopwatch wiring, verified end to end in code: `src/utils/tasks.js:104-111` persists one stopwatch as `{taskId, title, startedAt}` under key `task-stopwatch`, and `setStopwatch` calls `showWorkTimer('task', ...)` with `start: v.startedAt` and `taskId`, or `showWorkTimer('task', null)` to end it. `src/components/TaskDetailParts.jsx:199-206` blocks a second stopwatch on a different task with a toast, then calls `setStopwatch`, plus a light haptic. `:207` discards via `setStopwatch(null)`. `:208-213` stops only after 60 seconds, logs the time entry, then discards, which ends the Live Activity.
- Deep links: scheme is `rudhramcrm` (`app.json:8`). Live Activity taps use `rudhramcrm://tasks/<id>` for tasks and `rudhramcrm://attendance` for clock (`src/services/liveActivity.ios.js:20`). Routes exist in code: staff task detail is `src/app/(staff)/tasks/[id].jsx`; the attendance tab is `src/app/(staff)/(tabs)/attendance.jsx` (no standalone `src/app/attendance` file; the `/attendance` path comes from the tab). Cold-start tap behaviour through the auth guards in `src/app/_layout.jsx` is UNVERIFIED.
- Push, and no push-to-Live-Activity path: `src/services/push.js` contains no Live Activity handling, no ActivityKit push token, and no update call. Push taps go through `src/hooks/usePushTaps.js` and `src/hooks/useLiveUpdates.js`, which only route, mark read, or run quick actions. So a Live Activity can only start, update, or end while the app code runs; the server cannot push an update to it.
- Home-screen widgets: none. `src/widgets/` contains only `WorkTimer.jsx`. A repo-wide grep for `createWidget` or `Widget(` found nothing. `expo-widgets` is used only for the two Live Activities above.
- iOS entitlement: only time-sensitive notifications, at `app.json:17-19`. No Live Activity entitlement is present, and none is required for this path.
- No `ios/` or `android/` directory exists at repo root. `AGENTS.md:39` states they are generated by Continuous Native Generation and must not be created or edited by hand; native behaviour goes in `app.json` and config plugins. No ActivityKit Swift code exists in the repo; the native side is entirely the `expo-widgets` plugin.

## Code quality

- High: after an app restart, the stopwatch is reloaded into local state with `getStopwatch().then(setWatch)` (`src/components/TaskDetailParts.jsx:189`) but `showWorkTimer` is never called on mount. `setStopwatch` is the only caller that syncs the TaskTimer Live Activity. A TaskTimer left running when the app was killed is therefore never re-synced or ended by the app until the user opens that exact task and stops or discards it.
- High: the clock Live Activity only ends when this hook runs and the query says not active (`src/hooks/useClockTimer.js:9`, `:17`, `:27`). If the user clocks out from web or another device, or the app is killed or backgrounded, the island can stay live until the app is foregrounded and the next poll (up to 60 seconds) runs. There is no background, push, or server-driven end.
- Med: ClockTimer and TaskTimer are separate types and dedup is per type only (`src/services/liveActivity.ios.js:15-20`, `src/widgets/WorkTimer.jsx:50-51`), so clock-in and a task stopwatch can both be live at once, showing two Dynamic Island entries with no coordination or priority rule. This may be intended, but no comment or product rule says so.
- Med: `registerPush` registers only an Expo push token (`src/services/push.js:74-95`). There is no ActivityKit push-token registration and no handler that updates a Live Activity from a notification, so meeting reminders, leave decisions, and clock-out from another device cannot move the island. Fixing this needs server work, not just client code.
- Low: the timer hard-caps at `start + 24h` (`src/widgets/WorkTimer.jsx:15`). A worked-seconds value over 24h, or a stale `start`, stops the count instead of clamping or ending cleanly.
- Low: all Live Activity failures are swallowed with `console.warn` (`src/services/liveActivity.ios.js:21-23`). If Live Activities are off in Settings, or the device has no Dynamic Island, the user gets no in-app explanation and no fallback surface is offered.
- Low: the effect deps in `src/hooks/useClockTimer.js:27` are `[!!data, active, onBreak, firstIn]`. A change in worked seconds alone does not re-run it, which is fine because iOS ticks the timer, but a break that starts while the app is backgrounded is not reflected until the next foreground poll.
- Low: the task deep link embeds `props.taskId` with no guard (`src/services/liveActivity.ios.js:20`). `setStopwatch` always passes it (`src/utils/tasks.js:110`), but a future caller passing props without `taskId` would build `rudhramcrm://tasks/undefined`.

## What the user actually experiences on iOS

- While clocked in, the user sees "Clocked in" or "On a break" with "Since <time>" and a live monospaced timer. On break the icon switches to `cup.and.saucer.fill` and the timer freezes at the break start.
- While a task stopwatch runs, the island shows the task title and "Stopwatch running" with a stopwatch icon.
- Compact and minimal states show only the icon and the timer; the expanded state labels the kind. Tapping the clock activity opens `rudhramcrm://attendance` and tapping the task activity opens `rudhramcrm://tasks/<id>`.
- Actual rendering, tap behaviour, and Lock Screen layout are UNVERIFIED on a real device.

## Missing on iOS

- Home-screen widget: none exists. Only Live Activities are implemented; no `createWidget` definition, no widget layout, and no widget data source.
- Push-to-start or push-to-update for Live Activities: no client code and no server contract in this repo. Needs an ActivityKit push token flow plus a server sender; out of scope for a client-only change.
- Live Activity re-sync on app launch for the task stopwatch: clock recovers via `useClockTimer`, task does not.
- Live Activity end on phone restart, app kill, or clock-out from another device: no handler exists; iOS ends activities on restart, and the app only re-syncs the clock one on next launch.
- Live Activity for meeting countdown: no type, no trigger, no meeting-start hook. Would need a new `createLiveActivity` type in `src/widgets/WorkTimer.jsx` (or a new widget file), a service call from a meeting reminder path, and a dev-client build because `expo-widgets` is native. No new App Store entitlement is needed for Live Activities.
- Live Activity for today's tasks count: no type and no count source wired to a Live Activity. The count logic exists in-app (`myDay` in `src/utils/tasks.js`), but nothing pushes it to the island.
- Live Activity for leave approval nudge: no type and no trigger. The notification path already exists (push.js has an Approve button on review notifications), but that is a push banner, not a Live Activity.
- Exact native route for the next Live Activity use cases: add a `createLiveActivity` type in `src/widgets/WorkTimer.jsx`, add a start/update/end helper beside `showWorkTimer` in `src/services/liveActivity.ios.js`, trigger it from the relevant hook or screen, keep the Android stub in `src/services/liveActivity.js` as a no-op, and test in a dev-client build from `eas.json:7-10` (development profile). No App Store entitlement is needed for Live Activities; push-to-update would need server work on top.

## iOS adds

- P0 fix the task stopwatch orphan on launch: on staff-shell mount, reload the persisted stopwatch and re-sync or end the TaskTimer Live Activity, mirroring what `useClockTimer` does for the clock. Files: `src/components/TaskDetailParts.jsx:189`, `src/utils/tasks.js:105-111`, `src/services/liveActivity.ios.js:11-20`.
- P0 end stale Live Activities when state changes off-device: on foreground and on socket `notification` or attendance invalidation, re-run the clock sync immediately instead of waiting for the 60 second poll, and end the clock activity when the server says no active session. Files: `src/hooks/useClockTimer.js:9-27`, `src/hooks/useLiveUpdates.js:57-72`.
- P1 add a meeting-countdown Live Activity: new type with a countdown timer and a deep link to the meeting, started from the meeting reminder path. Files: `src/widgets/WorkTimer.jsx:50-51`, `src/services/liveActivity.ios.js:11-20`.
- P2 add a home-screen widget for today's tasks count using `expo-widgets`, reusing `myDay` counts. Files: `src/widgets/WorkTimer.jsx`, `src/utils/tasks.js`.
- P2 add a user-visible fallback when Live Activities are disabled: one line in Attendance explaining the island is off in Settings, shown only when `getInstances` returns nothing after a start attempt. Files: `src/services/liveActivity.ios.js:21-23`.

---

# Android

## Verdict

Android has no Dynamic Island equivalent at all: no Live Activity, no ongoing notification, and no widget, while its config carries unused audio and foreground-service permissions and predictive back is switched off.

## What exists

- The Live Activity call is a no-op stub on Android (`src/services/liveActivity.js:1-2`), and the stopwatch is visible only inside the task detail screen (`src/components/TaskDetailParts.jsx:189-198`).
- What Android does get is standard push banners with per-type channels (`src/services/push.js:19-28` and `:76-84`), notification action buttons (`:30-48`), a Material bottom tab bar with an inbox badge (`src/app/(staff)/(tabs)/_layout.jsx:8-32`), haptics on presses and success or error states, and the same in-app toast. Clock-in state is only visible by opening the Attendance tab.
- Haptics are used in 12 files, all through `expo-haptics`, with no Platform guard. Representative: every shared pressable fires `selectionAsync` (`src/components/Pressable.jsx:14`); clock-in/out success and error (`src/components/ClockPanel.jsx:65-68`, `src/utils/attendance.js:62-67`); task approve and mark-done (`src/components/TaskDetailParts.jsx:347`, `:408`); long-press select (`src/components/LeadParts.jsx:63`); dialog show (`src/components/ConfirmDialog.jsx:14`). There is no haptic tied to Live Activity start, update, or end itself.
- Safe area and edge-to-edge: `src/components/Screen.jsx:44` defaults `edges` to `['top']` only; `:55` renders `SafeAreaView` with those edges. The comment at `:48-50` says Android is edge-to-edge with no window resize, so `KeyboardAvoidingView` is enabled only on Android. 13 form screens override edges per platform, for example `src/app/(staff)/clients/new.jsx:278` and `src/app/(staff)/meetings/new.jsx:362` use `edges={Platform.OS === "android" ? ["top", "bottom"] : ["bottom"]}`.
- Platform branching is small and concentrated: navigation animation in `src/app/(staff)/_layout.jsx:8-17` and `src/app/(client)/_layout.jsx:9`, keyboard behaviour in `src/components/Screen.jsx:48` and `src/components/SelectField.jsx:53`, Android-only channels in `src/services/push.js:76`, biometric labels in `src/utils/biometric.js:6-16`, and the web CSV branch in `src/utils/tasks.js:89`.
- Native tabs: `src/app/(staff)/(tabs)/_layout.jsx:8` notes liquid glass on iOS 26 and a Material bottom bar on Android, with `sf` icons for iOS and `md` icons for Android at `:16-37`, and an inbox badge at `:32`.
- Config: `app.json:11-12` iOS bundle `com.rudhram.crm`, `supportsTablet: true`. `app.json:23-27` Android adaptive icon with background `#F6F1E0` plus foreground and monochrome images. `app.json:28` `predictiveBackGestureEnabled: false`. `app.json:29-38` permissions `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, `USE_BIOMETRIC`, `USE_FINGERPRINT`, `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION`.

## Code quality

- Med: predictive back is off, and both staff and client stacks force `ios_from_right` animation on Android (`src/app/(staff)/_layout.jsx:17`, `src/app/(client)/_layout.jsx:9`). The forced iOS-style animation fights the Android back gesture model; enabling predictive back without removing that override is likely to look wrong. No `BackHandler` usage exists in `src`.
- Med: `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`, `FOREGROUND_SERVICE`, and `FOREGROUND_SERVICE_MEDIA_PLAYBACK` are declared (`app.json:30-33`), but no recording API and no foreground service call was found in `src`. The only `expo-audio` use found is playback in `src/utils/notificationSound.js:1` (`createAudioPlayer`). Unused permissions add Play Store review surface and user concern for no feature.
- Med: neither `POST_NOTIFICATIONS` nor `VIBRATE` nor `RECEIVE_BOOT_COMPLETED` is listed explicitly (`app.json:29-38`). They may be added by the `expo-notifications` plugin at prebuild, but that is not visible in this repo, so it is a prebuild verification gap, not a proven bug.
- Med: there is no explicit edge-to-edge setting in `app.json` and no edge-to-edge API call; the only window call is `SystemUI.setBackgroundColorAsync(theme.bg)` (`src/app/_layout.jsx:35`). Edge-to-edge safety is per-screen `SafeAreaView` edges, with the default `['top']` and 13 form screens patching in `["top", "bottom"]` on Android. A screen that forgets the override can sit under the Android gesture bar. Rendering on Android 15 is UNVERIFIED.
- Low: `formSheet` and `sheetAllowedDetents` are iOS-only presentations applied unconditionally to clock-out, day, regularize, leave, and several form screens (`src/app/(staff)/_layout.jsx:18-48`), with no Platform guard. On Android they fall back to the modal path, so the sheet behaviour is iOS-only by accident, not by decision.

## Android adds

- P1 add one Android persistent timer surface: an ongoing notification for clock-in and stopwatch, using the existing channels in `src/services/push.js:19-28`, so Android gets parity with the iOS island. Files: `src/services/push.js`, `src/hooks/useClockTimer.js`, `src/utils/tasks.js:108-111`.
- P1 enable predictive back and remove the forced iOS slide on Android: set `predictiveBackGestureEnabled` to true and drop the Android `ios_from_right` override, then test back from every modal and form sheet. Files: `app.json:28`, `src/app/(staff)/_layout.jsx:8-17`, `src/app/(client)/_layout.jsx:9`.
- P2 add an explicit edge-to-edge and safe-area rule: one `Screen` default that is correct on Android (bottom inset included) instead of 13 per-screen overrides, plus an `app.json` note or prebuild check. Files: `src/components/Screen.jsx:44-55`, `app.json`.

## Android removes

- Remove `android.permission.RECORD_AUDIO` and `android.permission.MODIFY_AUDIO_SETTINGS` from `app.json:30-31` unless a recording feature is planned.
- Remove `android.permission.FOREGROUND_SERVICE` and `android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK` from `app.json:32-33` unless the Android ongoing-notification work actually starts a foreground service.
- Remove the per-screen Android edges overrides (13 sites) once the single `Screen` default lands.

---

# Cross-cutting code quality

## State management and API layer

- Store is minimal (`src/store/index.js:5-8`): auth slice plus RTK Query only. Session restore and sign-out in `src/store/session.js:24-59` is sound: refresh token in SecureStore, biometric lock offered once, push unregistered before logout, API state reset on sign out.
- API layer `src/services/api.js:9-17`: baseQuery with Bearer token from Redux state and `X-Client: mobile` header. `:21-30` refresh posts the stored refresh token to `/auth/refresh-token` and rotates it. `:32-43` single-flight refresh (`refreshing ??=`) so parallel 401s share one rotation, then retries once, then clears the token and logs out. After a failed refresh the original 401 result is returned and the user is logged out, which is correct, but the logout also fires for a 401 caused by a single revoked endpoint token rather than a dead session. Acceptable, but logout is the only recovery path.
- No timeout and no retry configured on `fetchBaseQuery`. `src/utils/apiError.js:5` handles `TIMEOUT_ERROR`, but nothing can produce one, so that branch is dead. A hung request hangs the screen until the user pulls to refresh.
- Socket `src/services/socket.js:9-23`: one socket.io connection, websocket transport only, token read from state on every reconnect, one retry after a `getMe` refetch on auth errors (`Invalid token`, `Authentication required`). `transports: ['websocket']` only, no polling fallback. If a network blocks websockets, the socket never connects and the app silently loses live updates, with no user-visible state. It also retries auth failure exactly once and then gives up silently.
- `src/hooks/useEntityRoom.js:8-26` joins `type:id` rooms and re-joins on reconnect. `src/hooks/useLiveUpdates.js:52-69` listens for `notification:new`, `notification:updated`, `notification:unread`, and refetches Task/Notification tags when the app returns to foreground. That refetch is correct for freshness but refetches whole lists even for a brief backgrounding.
- Broad RTK invalidation: almost every task mutation invalidates both the item tag and the generic `Task` tag, and `getTasks` provides only the generic tag, so every checklist tick, time log, or chat message refetches every open task list. `getTasks` also sets `keepUnusedDataFor: 0`, so switching tabs always refetches.
- Offline behaviour: the banner promises "Showing what was last loaded", but many endpoints set `keepUnusedDataFor: 0`, so RTK Query evicts their data on unmount and an offline screen shows an error or empty state, not the last load. Mutations made offline fail with a generic toast and no queue or retry.
- Password rules disagree. `src/utils/validators.js:7-10` allows 6 characters with no complexity; user creation requires 8 characters with upper, lower, and number (`src/utils/users.js:40-43`). Which rule a user meets depends on which form they hit.
- `src/utils/access.js:1` hardcodes a personal email, `jaimishchhowala@rudhramenterprises.com`, in the payroll access allowlist. Client-side allowlists are bypassable and rot when people change; this should be server-driven.
- Date and timezone handling: several UTC-slice bugs (see Attendance C5). Reports does it right with plain local `YYYY-MM-DD` dates. Invoice/payment/quotation date filters send timezone-naive strings. The `dateInput` helper (`src/utils/users.js:10-16`) is correct local-date handling; the `users.check.js` date assertion is loose (accepts Jan 4 or 5).

## Security

- Tokens: refresh token in SecureStore (Keychain/Keystore), access token only in Redux memory. Good. The web variants store the refresh token in localStorage (`src/utils/refreshToken.web.js:1-6`, `src/utils/prefs.web.js:1-3`); the file comments say web is only a dev preview, but any shipped web build would expose the refresh token to XSS. Do not ship web without the httpOnly cookie the comment itself prescribes.
- Role gating is link-only on several admin screens (see Attendance C4). The server is the backstop, but a deep link reaches the form. Client portal visibility rules rely entirely on the server; the hiding of internal history, time logs, review notes, and staff emails is asserted in comments, not verifiable from mobile code. UNVERIFIED.
- No secrets were found in the reviewed code. `.env.example` exists; no `.env` file is in the repo listing. API URL comes from `EXPO_PUBLIC_API_URL`.
- `src/utils/apiError.js` centralises error mapping, but several screens read only `isLoading` and never `isError`, so errors render as empty states (see Attendance C3).

## Performance

- Tasks hub renders up to 100 tasks with plain `.map` inside a ScrollView (`src/components/TaskViews.jsx:131-136`, `src/app/(staff)/(tabs)/tasks.jsx:42-47` fetches `limit: 100`). No virtualization, no paging.
- Leads list renders with `.map` in a View (`src/app/(staff)/leads/index.jsx:212-220`). Attendance records likewise (`src/app/(staff)/attendance/records.jsx:62`, `rows.map`).
- FlashList is used in 11 screens (notifications, portal projects, clients, freelancers, invoices, meetings, payments, projects, quotations, teams/[location], users) and tasks, leads, and attendance are confirmed NOT in that list. `src/components/SelectField.jsx` is the only `FlatList` user.
- None of the FlashList usages pass `estimatedItemSize`, so initial layout measurement is unhinted.
- `src/app/(staff)/(tabs)/notifications.jsx:92` and `src/app/(staff)/(tabs)/_layout.jsx:10` both subscribe to `useGetUnreadCountQuery`; harmless duplication, but the count query also refetches on every notification invalidation.
- `src/components/Toast.jsx` is a single-toast, newest-wins surface. Fine.
- Design tokens are used consistently; no raw hex in components was flagged except the Charts violet (see Dashboard) and the Live Activity accent `#C98B4A` (a dark-mode ochre, consistent with DESIGN.md).

## Accessibility

- 237 `accessibilityLabel` uses across 73 files in `src`. Inbox rows carry a full label, delete is an accessibility action, Pager buttons are labelled with disabled state, Toast announces via `AccessibilityInfo`. DESIGN.md requires 44x44 minimum targets with chips at 36 plus `hitSlop` 8; Pager buttons and the mark-all button are `h-11` (44px), but the Toast action button uses only `hitSlop={12}` and chip `hitSlop` was not verified in this slice. No accessibility audit was run; target sizes below 44px outside the checked files are UNVERIFIED.
- Skeletons are reduced-motion aware (`src/components/Skeleton.jsx:8-17`). Empty states are solid shared pieces (`src/components/EmptyState.jsx:5-17`).
- DESIGN.md also requires: light and dark both checked, 130 percent text, Reduce Motion on, empty/loading/error states, 44px targets, `npx expo lint` passing. Whether each screen was checked against those is UNVERIFIED without running the app.

## Pagination: three models in one app

- Numbered Pager (Previous / Page X of Y / Next) from the server: projects list, project open/done tasks, clients, notifications, portal projects, portal tasks, users, teams.
- Infinite scroll at 20 per page: meetings list only.
- No paging, fixed caps: Tasks hub (100), leads (100), insights (100), My Day reviews (50), attendance records (100), attendance reports (50), time entries (latest 10), chat (latest 10 plus Show earlier).
- `usePaged` (`src/hooks/usePaged.js:11-18`) is a separate client-side pager used only for already-loaded lists. Three paging models in one app, and the capped lists never say "showing first N of M" except Insights.

## Dead code and unused dependencies (all verified by grep)

Dead code with proof:

- `src/services/payrollApi.js:3-43`: no importer in `src/`. Endpoints never register.
- `src/services/settingsApi.js:1-88`: no caller outside the file. Whole surface dead until Settings is built.
- `manualOverride` mutation, `src/services/attendanceApi.js:92-100`: exported, never called.
- `createFreelancerPublic` mutation, `src/services/freelancerApi.js:24-27`: no screen calls it; PLAN M15 explicitly skipped the public apply form.
- `getPortalStaff` query, `src/services/userApi.js:17-23`: no usage anywhere in `src/`.
- `useConvertLeadToClientMutation`, `src/services/clientApi.js:48,88`: defined and exported, no call site. Conversion uses a status PATCH instead. Remove it OR wire Convert to it, not both, and confirm the server behaviour first (UNVERIFIED).
- `useMarkNotificationReadMutation` export, `src/services/notificationApi.js:33`: never imported; single-read is done via `notificationApi.endpoints.markNotificationRead.initiate`.
- `getStatusColor` in `src/utils/formatters.js:38`: zero callers.
- `addMinutes` in `src/utils/time.js`: zero callers outside its definition.
- `CATEGORIES.open` in `src/services/push.js:34`: registered but `CATEGORY_OF` never maps any type to it; only fires if the server sends `categoryId: 'open'` directly. UNVERIFIED against the server payload.
- Legacy embedded project-task mutations `addProjectTask`, `updateProjectTask`, `deleteProjectTask` in `src/services/projectApi.js:72-84`: zero callers; project tasks now go through the Task collection.
- `useDeleteProjectMutation` in `src/services/projectApi.js`: zero callers; no project delete UI.
- `importLeads` in `src/services/leadApi.js`: no screen calls it.
- Dead `SignedInHome` export in `src/components/SignedInHome.jsx:43-50`: placeholder screen nothing renders.
- `notification:read` realtime event documented in PLAN but never listened to anywhere in `src`.
- `LeadBoard` component exists but is unreachable (toggle commented out, see Leads).
- Duplicate `changePassword` endpoint in `src/services/settingsApi.js:26-28` (authApi has the used one).

Unused dependencies, verified by grep over `src` and `app.json`:

- `expo-glass-effect` (package.json): zero imports in `src`, not in `app.json` plugins. Only a comment mentions "liquid glass" (`src/app/(staff)/(tabs)/_layout.jsx:8`). Remove it, after checking whether `@expo/ui` needs it as a peer.
- `@expo-google-fonts/marcellus` (package.json): zero imports in `src`. Fonts actually loaded are Manrope plus Goldenbook only (`src/app/_layout.jsx:90-93`).

Verified as used, do NOT remove: `expo-audio` (only `src/utils/notificationSound.js:1`, notification sound), `expo-document-picker` (only `src/components/TaskChat.jsx:4`), `expo-clipboard` (6 files), `expo-network` (only `src/components/OfflineBanner.jsx:2`), `expo-device` (only `src/services/push.js:3`, simulator guard), `react-native-webview` (only `src/app/(staff)/document-preview.jsx:16` via lazy require), `socket.io-client` (only `src/services/socket.js:1`), `@expo/ui` (only `src/widgets/WorkTimer.jsx:1-2`), `expo-widgets` (only `src/widgets/WorkTimer.jsx:3` plus the `app.json` plugin entry).

## Duplicated logic worth unifying

- The 350 ms search debounce is copy-pasted in leads, clients, meetings, users, teams/[location], and freelancers list screens.
- The FlashList + Pager + header pattern is repeated across users, teams, and freelancers.
- The form scaffold (SheetHeader, Alert, runAction, ConfirmDelete/ConfirmDialog) is repeated across holiday-form, shift-form, apply-leave, regularize, and edit screens. Two delete-confirm patterns exist.
- Progress percent computed three ways (tasks). Paid percent computed three ways (invoices/payments). Block-reason logic duplicated between `AttendanceCard.jsx:15` and `ClockPanel.jsx:22-29`.
- TaskChat vs ProjectChat are near-copies with small divergences. Stage visuals are duplicated three ways.
- Password rules disagree between `src/utils/validators.js` and `src/utils/users.js`.

---

# ADD list (prioritised)

## P0: must-have (fix before anything new)

1. **Remove or hide the dead Payroll / My Payslips nav entries until the routes exist.** Eligible users can tap into a missing route from the More screen today. Files: `src/constants/index.js:211-212`, `src/app/(staff)/(tabs)/more.jsx:60`.
2. **Exclude dead routes from More search, or add the missing routes.** Search currently offers Dashboard, Settings, Payroll, and My Payslips, and all four land on Coming Soon. Until the screens exist, filter search to routes that exist. Files: `src/app/(staff)/(tabs)/more.jsx:12-33`, `src/constants/index.js:201-218`.
3. **Build the real Settings screen at `/settings` and wire it to the existing settingsApi.** Every staff role sees Settings in More and search, and today it lands on Coming Soon, which reads as a broken app. Start with profile edit (name, phone, avatar via image picker, using `updateProfile`), notification preferences (using `getNotifPrefs` and `updateNotifPrefs`), push on/off, and the existing AccountSettings block. Files: new `src/app/(staff)/settings/index.jsx`, `src/components/AccountSettings.jsx`, `src/services/settingsApi.js`, `src/constants/index.js:218`.
4. **Guard dashboard data before render.** A partial `GET /dashboard` response can crash Home, the first screen every staff user sees. Add a null check for `k` and `tasks` and fall back to the error state or zero tiles. Files: `src/components/Dashboards.jsx:107-220`, `src/app/(staff)/dashboard/venture/[brand].jsx:20-51`.
5. **Page the Tasks hub and virtualise it.** Replace the 100-cap with the same numbered Pager + FlashList pattern Projects uses. The most-used screen silently drops task 101 and mounts 100 swipeable rows. Files: `src/app/(staff)/(tabs)/tasks.jsx`, `src/components/TaskViews.jsx` (ListView, MyDayView), `src/components/Pager.jsx`, `src/hooks/usePaged.js`.
6. **Add the project edit screen (basics, deadline with reason, budget, tags).** There is no way to fix a typo in a title or move a deadline from the app, and the mutation already exists. Files: new `src/app/(staff)/projects/edit.jsx` (or an edit sheet), `src/app/(staff)/projects/[id].jsx` (Edit entry point), `src/services/projectApi.js` (`useUpdateProjectMutation` already exported), `src/components/ClientParts.jsx` (client picker reuse).
7. **Offline-tolerant clock-in and clock-out.** Queue the punch locally with its timestamp when the network fails, show a "Punch pending, will send when online" state on the ClockPanel and Home card, and auto-retry on reconnect. Attendance is PLAN's "highest mobile value" module and a dead network today silently loses the punch. Files: `src/utils/attendance.js`, `src/components/ClockPanel.jsx`, `src/components/AttendanceCard.jsx`, `src/app/(staff)/attendance/clock-out.jsx`, `src/services/attendanceApi.js`.
8. **Skip GPS for WFH clock-in (and clock-out).** Do not call `getLocation()` when WFH is on, and show "No location check" truthfully. The current code contradicts its own label and adds up to 8 seconds plus a permission prompt to a flow that needs no location. Files: `src/components/ClockPanel.jsx:59-70`, `src/utils/attendance.js:45-57`.
9. **Lead follow-up date.** Add a `DateField` for `followUpDate` to `src/app/(staff)/leads/new.jsx`, send it in the save body, keep showing it at `src/app/(staff)/leads/[id].jsx:104`, and add an overdue or due-today badge plus sort in `src/app/(staff)/leads/index.jsx`. PLAN claims the field exists, sales follow-up is the core job of this module, and today the date can only be set on web. Files: `src/app/(staff)/leads/new.jsx`, `src/app/(staff)/leads/[id].jsx`, `src/app/(staff)/leads/index.jsx`, `src/components/LeadParts.jsx`.
10. **Un-comment and ship the Leads board toggle.** Restore the List/Board switch at `src/app/(staff)/leads/index.jsx:122`, keep the existing `LeadBoard` at `src/components/LeadParts.jsx:185`. It is already built and it is the only stage-overview view for sales. Files: `src/app/(staff)/leads/index.jsx` only.
11. **PDF share (including WhatsApp) for invoice, quotation, and receipt.** PLAN M11 promises it, clients live on WhatsApp, and download-only forces a manual re-share from Files. Files: `src/components/ServerDocument.jsx` (add a share action beside `PdfActions` using `expo-sharing`, reusing the already downloaded file), `src/app/(staff)/invoices/[id].jsx`, `src/app/(staff)/quotations/[id].jsx`, `src/app/(staff)/payments/[id].jsx`, `src/app/(staff)/document-preview.jsx`.
12. **Notification permission priming before the raw system prompt.** Show a one-time explainer ("Get notified when a task is assigned or reviewed") with Allow / Not now, and only then call `requestPermissionsAsync`. A denied iOS permission can only be fixed in Settings, and the current code burns the one ask on first sign-in with no context. Files: `src/services/push.js:73-85`, new priming component, `src/components/AccountSettings.jsx` for a later re-enable path.
13. **Explicit deep-link map for every notification type.** Add a type-to-route table covering all 20 types in `src/constants/notifications.js:7-26` plus `task_review_*` and `project_stage_reverted`, keyed off `referenceModel`/`referenceId` first and `link` only as fallback, with a client variant that maps to `/portal/...` routes. Taps are the core notification UX and today most types have no guaranteed destination. Files: `src/utils/notificationRoute.js`, `src/hooks/useLiveUpdates.js:16-22`, `src/constants/notifications.js`.
14. **Portal home loading/empty/error states.** Read `isLoading`/`isError` from the existing `useGetTasksQuery` call and render Skeleton / error retry / empty state with a link to projects. A new client currently sees a blank screen. Files: `src/app/(client)/(tabs)/portal/index.jsx:6-19`.
15. **Fix the task stopwatch orphan on launch.** On staff-shell mount, reload the persisted stopwatch and re-sync or end the TaskTimer Live Activity, mirroring what `useClockTimer` does for the clock. A stale island after restart shows wrong time with no in-app correction. Files: `src/components/TaskDetailParts.jsx:189`, `src/utils/tasks.js:105-111`, `src/services/liveActivity.ios.js:11-20`.
16. **End stale Live Activities when state changes off-device.** On foreground and on socket `notification` or attendance invalidation, re-run the clock sync immediately instead of waiting for the 60 second poll, and end the clock activity when the server says no active session. Clock-out from web currently leaves the island up. Files: `src/hooks/useClockTimer.js:9-27`, `src/hooks/useLiveUpdates.js:57-72`.

## P1: should-have

17. **Build My Payslips (read-only list plus slip PDF download/share).** The highest-value payroll slice, every employee uses it, and the endpoints already exist in `src/services/payrollApi.js` (`getMySlips`, `downloadSlipPdf`). Files: new `src/app/(staff)/my-payslips/index.jsx`, import `payrollApi` from a real screen, `src/constants/index.js:212`.
18. **Add the revenue trend and upcoming meetings to the Admin dashboard.** Admins open Home to answer what came in and what is next, and today they must open Reports or a venture screen for both. Reuse `RevenueSection` and the meetings list from the employee dashboard. Files: `src/components/Dashboards.jsx:64-83,107-152`, `src/services/dashboardApi.js:1-31`.
19. **Unify the send-for-review path.** Make the row tick, both swipes, bulk, and TaskFlow all open the review-note sheet (or all skip it, explicitly). The same action currently sometimes asks for a note and sometimes does not, and the no-note path is the one users will hit most. Files: `src/components/TaskParts.jsx` (`useFinishTask`), `src/components/TaskViews.jsx` (BulkBar), `src/components/TaskDetailParts.jsx` (TaskFlow).
20. **Show a running-stopwatch indicator outside the detail screen.** A small banner or chip on the Tasks tab and My Day, tapping back to the task, plus a confirm before Discard. The stopwatch is invisible once you leave the task, so sessions are forgotten or double-started. Files: `src/components/TaskDetailParts.jsx` (TimeTracker), `src/utils/tasks.js` (`getStopwatch`), `src/app/(staff)/(tabs)/tasks.jsx`.
21. **Guard review handover.** Block handing review to the task owner (and to the reviewer themselves) in `handTo`, with a toast explaining why. The PLAN known gap lets someone approve their own work. Files: `src/components/TaskDetailParts.jsx:349-351`, `src/utils/tasks.js` (`isOnTask`, `reviewerOf`).
22. **Make Insights honest about the cap and add review speed.** Show "showing first 100 of N" using the pagination total, and add average time to review per reviewer. Insights currently reports on a truncated sample without saying so, and review speed was promised in TASKS-FLOW.md. Files: `src/app/(staff)/tasks/insights.jsx`, `src/app/(staff)/(tabs)/tasks.jsx`.
23. **Replace hard-wired Palak assignment with a picker plus a default.** Add a `UserPicker` for `assignedTo` in `src/app/(staff)/leads/new.jsx`, defaulting to the Palak account found by `usePalak`, and keep the existing lost and community rules untouched. The current form is unusable if that one account is missing, and PLAN already asks for this. Files: `src/app/(staff)/leads/new.jsx`, `src/utils/leads.js`.
24. **Lead list pagination.** Replace the fixed first 100 at `src/app/(staff)/leads/index.jsx:57` with the same numbered `Pager` pattern used by Clients, or the infinite pattern used by Meetings. A sales list routinely passes 100 and currently truncates silently. Files: `src/app/(staff)/leads/index.jsx`, `src/services/leadApi.js` if a new infinite query is needed.
25. **Meeting KPIs from the server.** Add a stats endpoint or reuse the list total so `src/app/(staff)/meetings/index.jsx:123-128` does not count only loaded pages. The current counts mislead as soon as there is more than one page. Files: `src/app/(staff)/meetings/index.jsx`, `src/services/meetingApi.js`.
26. **Client detail related sections.** Add read-only related projects, invoices, and meetings lists to `src/app/(staff)/clients/[id].jsx`, reusing existing list queries. This is the main reason to open a client after the first call. Files: `src/app/(staff)/clients/[id].jsx`, `src/services/projectApi.js`, `src/services/invoiceApi.js`, `src/services/meetingApi.js`.
27. **In-screen role guards.** Add the same "Admins only" / "Managers only" empty state used in `users/index.jsx:31-41` to Shifts, Holiday form, Attendance edit, Reports, Users new/edit, and Freelancers new/edit. Deep links bypass every link-level gate today. Files listed in Attendance C4.
28. **GPS failure messaging.** When `getLocation()` returns undefined, show an inline note ("Location unavailable, clocking in without GPS") and let the user explicitly retry with location or proceed. Silent fallback plus a server 100 m rejection is the most confusing failure in the daily flow. Files: `src/utils/attendance.js:45-57`, `src/components/ClockPanel.jsx:59-75`, `src/components/AttendanceCard.jsx:38-41`.
29. **Self-approval guard on regularization.** Hide Approve/Reject on a manager's own pending requests, matching the leave cards. Files: `src/app/(staff)/attendance/regularization.jsx:14-56`.
30. **Server-confirmed leave day count.** Return the counted days from the apply-leave response (or a preview endpoint) and use that for the over-balance check instead of local calendar-day math. Local counting includes Sundays/holidays and can wrongly block a valid request. Files: `src/app/(staff)/attendance/apply-leave.jsx:25-27`, `src/components/AttendanceParts.jsx:145`, `src/services/attendanceApi.js` (applyLeave).
31. **Fix split payment to let the user pick the bank-leg method (UPI vs bank transfer) and attach a reference to either leg.** The current code silently records UPI splits as bank_transfer. Files: `src/utils/invoices.js` (`paymentRequest`), `src/app/(staff)/invoices/pay.jsx`.
32. **Lift the 100-record cap on client/project pickers or make them server-searched.** Clients beyond the first 100 are unselectable in invoice and quotation creation. Files: `src/components/InvoiceForm.jsx`, `src/components/QuotationForm.jsx`, `src/services/clientApi.js`, `src/services/projectApi.js`.
33. **Reports export (CSV share, reusing the tasks pattern) and a custom date range.** The most asked-for reporting gap, and the CSV share helper already exists. Files: `src/app/(staff)/reports/index.jsx`, `src/utils/reports.js`, `src/utils/tasks.js:100` (pattern reference).
34. **Client inbox and badge.** Reuse the staff inbox list behind the client shell with client-scoped routing, plus badge sync in `src/app/(client)/_layout.jsx`. Clients currently have no way to revisit a notification they missed.
35. **Notification preferences UI.** Wire the existing `getNotifPrefs` / `updateNotifPrefs` endpoints (`src/services/settingsApi.js:5-13`) into AccountSettings with per-type toggles and a push on/off switch. The API is built and the setting is a PLAN M17 item; users cannot currently mute noisy types.
36. **Offline mutation queue.** Queue mark-read, delete, and quick-action mutations while offline and flush on reconnect, instead of failing with a toast. Deletes already vanish from the UI optimistically, so offline users lose data silently. Files: `src/hooks/useLiveUpdates.js:32-43`, `src/app/(staff)/(tabs)/notifications.jsx:118-144`.
37. **Virtualize tasks and leads lists and add `estimatedItemSize` to all FlashList usages.** The two most-used lists render up to 100 rows without virtualization. Files: `src/components/TaskViews.jsx:131-136`, `src/app/(staff)/leads/index.jsx:212-220`, all FlashList screens.
38. **Android persistent timer surface.** An ongoing notification for clock-in and stopwatch, using the existing channels in `src/services/push.js:19-28`, so Android gets parity with the iOS island. Files: `src/services/push.js`, `src/hooks/useClockTimer.js`, `src/utils/tasks.js:108-111`.
39. **Enable predictive back and remove the forced iOS slide on Android.** Set `predictiveBackGestureEnabled` to true and drop the Android `ios_from_right` override, then test back from every modal and form sheet. Files: `app.json:28`, `src/app/(staff)/_layout.jsx:8-17`, `src/app/(client)/_layout.jsx:9`.
40. **Add a meeting-countdown Live Activity.** New type with a countdown timer and a deep link to the meeting, started from the meeting reminder path. Highest-value new island use case, reuses the proven pattern. Files: `src/widgets/WorkTimer.jsx:50-51`, `src/services/liveActivity.ios.js:11-20`.
41. **Verify the reset password and accept invite deep links end to end with real emails, and fix the scheme to match `app.json`.** PLAN says `crm://` and app.json says `rudhramcrm`, and a broken reset link locks a user out. Files: `app.json:8`, `src/components/SetPasswordForm.jsx`, server email templates (outside this repo).
42. **Add client side email format validation on sign-in and forgot password.** Saves a failed round trip and gives instant feedback on the most common typo. Files: `src/app/sign-in.jsx:18-53`, `src/app/forgot-password.jsx:9-36`.
43. **Profile edit with avatar upload.** The most used M17 item and the mutation already exists, so this is a small screen, not a new backend. Files: `src/components/AccountSettings.jsx`, `src/services/settingsApi.js:23-25`.

## P2: nice-to-have

44. **Milestone picker in project quick add, and auto milestone.** Pass the milestone into QuickAddTask per group and auto-complete a milestone when its tasks are done (with a confirm). Project quick add currently strands tasks under NO MILESTONE, and milestone status is manual. Files: `src/components/TaskViews.jsx` (QuickAddTask), `src/app/(staff)/projects/[id].jsx` (ProjectTasks), `src/components/ProjectEditParts.jsx` (MilestonesCard).
45. **Create-client-inline on the project form.** The current dead end ("Add the client first in Clients", `src/components/ClientParts.jsx:67`) breaks project creation flow. Files: `src/components/ClientParts.jsx`, `src/app/(staff)/projects/new.jsx`.
46. **Mute this task.** Per-task mute toggle on the detail screen, wired to notification preferences. TASKS-FLOW.md T1/T5 deferred it, and chatty tasks currently cannot be silenced. Files: `src/app/(staff)/tasks/[id].jsx`, `src/services/taskApi.js`, notification settings (M17, currently unbuilt).
47. **Half-day leave.** Add a half-day option to apply-leave and the balance display. The attendance model already has a `half_day` status (`src/constants/index.js:256`), but leave cannot produce one. Files: `src/app/(staff)/attendance/apply-leave.jsx`, `src/app/(staff)/attendance/leaves.jsx`, `src/components/AttendanceParts.jsx:179-193`.
48. **Live break length on the ClockPanel.** Show "On break 12 min" next to the End break button. The running break length is currently only visible in the session history below the fold. Files: `src/components/ClockPanel.jsx:84-91`, `src/components/AttendanceParts.jsx:128-139`.
49. **Venture label on freelancer list rate.** Show which venture the headline rate belongs to. Multi-venture freelancers show an unattributable rate on the list row. Files: `src/utils/freelancers.js:59`, `src/components/FreelancerParts.jsx:56-58`.
50. **Reports paging and export note in the empty state.** Page the attendance report record list like Users/Freelancers and move the web-export note out of the has-data branch. Files: `src/app/(staff)/attendance/reports.jsx:30-34,80`.
51. **Persist invoice and quotation form drafts locally** so leaving the screen does not lose work. Both forms are long and single-session today. Files: `src/components/InvoiceForm.jsx`, `src/components/QuotationForm.jsx`, `src/utils/prefs.js`.
52. **Show the blocking form problem prominently before a client is picked, and validate printed email/GST/IFSC/pincode client-side.** Disabled submit with muted text is the weakest feedback in the money slice. Files: `src/components/InvoiceForm.jsx`, `src/components/QuotationForm.jsx`, `src/utils/validators.js`.
53. **Correct PLAN.md M13 to say Reports uses donuts, or replace the invoice/payment-method donuts with the Ring/BarList the plan describes.** Plan and code disagree, which will mislead the next reviewer. Files: `PLAN.md`, `src/app/(staff)/reports/index.jsx`, `src/components/Charts.jsx`.
54. **Local follow-up and meeting reminders via `expo-notifications`.** Useful on a phone, but only after the follow-up date itself exists and is reliable. Files: `src/app/(staff)/leads/new.jsx`, `src/app/(staff)/meetings/new.jsx`, plus a notifications helper.
55. **Link the converted task from a meeting action item.** After convert, show the task ID or a link on the meeting detail item instead of only the text label. Today the user cannot find the task they just created. Files: `src/app/(staff)/meetings/convert.jsx`, `src/app/(staff)/meetings/[id].jsx`, `src/services/meetingApi.js`.
56. **Add `canOpenURL` checks and a WhatsApp-installed fallback** for `contactClient` (`src/components/ClientParts.jsx:35-37`), `joinMeeting` (`src/components/MeetingParts.jsx:38`), and the lead contact path (`src/app/(staff)/leads/[id].jsx:34,76-78`). Failures today are a generic toast or, for lead email, silent.
57. **Quiet hours.** Add a quiet-hours window stored in prefs, checked in the foreground handler (`src/services/push.js:40-45`) and in `showLocalNotification`. Attendance and review reminders fire overnight by cron.
58. **Portal invoices and meetings.** Build the list/detail screens only after the server fixes the client invoice filter (PLAN.md:282). Files: `src/app/(client)/(tabs)/portal/invoices.jsx`, `src/app/(client)/(tabs)/portal/meetings.jsx`.
59. **Test runner.** Add a `test` script and run the nine existing `src/utils/*.check.js` files under it, then add route tests for `notificationRoute`. Zero tests today; the check files already exist and just need wiring.
60. **Explicit edge-to-edge and safe-area rule.** One `Screen` default that is correct on Android (bottom inset included) instead of 13 per-screen overrides, plus an `app.json` note or prebuild check. Files: `src/components/Screen.jsx:44-55`, `app.json`.
61. **Home-screen widget for today's tasks count using `expo-widgets`, reusing `myDay` counts.** Cheap once Live Activities exist, and it is the only widget-shaped request in the brief. Files: `src/widgets/WorkTimer.jsx`, `src/utils/tasks.js`.
62. **User-visible fallback when Live Activities are disabled.** One line in Attendance explaining the island is off in Settings, shown only when `getInstances` returns nothing after a start attempt. Files: `src/services/liveActivity.ios.js:21-23`.
63. **Biometric sign-in button on the sign-in screen, or at least a remembered email.** Reduces daily friction for returning users. Files: `src/app/sign-in.jsx`, `src/utils/biometric.js`, `src/store/session.js`.
64. **Employee quick links and leave balance on the employee dashboard.** Turns Home into a starting point for the day instead of only tasks and meetings. Files: `src/components/Dashboards.jsx:154-220`.
65. **Make the auto lock timeout a setting (for example 1, 5, 15 minutes)** instead of a hardcoded 5 minutes. Files: `src/hooks/useAutoLock.js:7`, `src/utils/prefs.js`, settings screen from P0 item 3.
66. **Keep the failed OTP on a wrong code instead of clearing all six digits.** Small kindness on a screen users reach while switching apps to copy a code. Files: `src/app/verify-email.jsx:30-34`.
67. **Add resend and change email actions to the forgot password success screen.** A typo currently forces a full restart. Files: `src/app/forgot-password.jsx:12-17`.
68. **Upload the freelancer photo only on save, fix the 5 MB check, and add overlapping-rate validation.** Cancelling the form today orphans an uploaded image on Cloudinary, and the size check reads `fileSize`, which is undefined on some platforms. Files: `src/app/(staff)/freelancers/new.jsx:58-76,109-131`.
69. **Trim phone and fix the emptied-salary-sends-0 bug in the user form.** An emptied salary field is sent as `0`, which can zero a salary on edit. Files: `src/utils/users.js:53,62`.
70. **Fix the QuotationForm render-phase setState and add price greater than zero validation.** Move the defaults application into an effect keyed on the defaults object, and reject a zero-price quotation. Files: `src/components/QuotationForm.jsx:97-101`, `src/app/(staff)/quotations/new.jsx`, `src/app/(staff)/quotations/edit.jsx`.

## Server-side items (not mobile code, needed to unblock mobile)

- Multi-device refresh tokens: store `refreshTokens: [String]` (keep the last 5), check with `includes`, replace only the used one on refresh, remove only the current one on logout. Without it, phone login can log out web and vice versa. See PLAN.md section 8.
- Client invoice filter fix: clients currently see their drafts, and `?brand=` overrides the client filter. Portal invoices cannot ship until this is fixed. See PLAN.md:282.
- Lead convert behaviour: confirm whether the server creates the client on status `won`, so the mobile code can use one conversion path instead of two.
- Leave day counting rule: confirm whether the server excludes Sundays and holidays, so the mobile over-balance check stops overstating.
- Freelancer status email: fix the server blanking the email on updates that leave it out, so the client can drop the `setStatus` workaround.
- Reviewer manager field: late reviews currently alert the reviewer and all admins, since users have no manager field yet.
- Live Activity push-to-update: ActivityKit push token flow plus a server sender, needed before the island can update from a push.
- `GET /dashboard` should return `kpis` reliably, and meeting KPIs should come from a server stats endpoint rather than counting loaded pages.

---

# REMOVE list

- Remove `@expo-google-fonts/marcellus` from `package.json:10`. Zero imports or uses anywhere in src, config, or docs. DESIGN.md and `_layout.jsx` use only Manrope and Goldenbook.
- Remove `expo-glass-effect` from `package.json:25` if a prebuild check confirms it is unused. No import of it was found anywhere in `src`. Do not remove if `@expo/ui` needs it as a peer; check first.
- Remove `src/services/payrollApi.js` or wire it up. It is dead code today: no importer, no registered endpoints, no screen. Keeping it implies payroll works. Either delete it until M14 is built, or keep it only as part of the My Payslips add.
- Remove the `PayrollRun` / `SalarySlip` tag types from `src/services/api.js:84-85` if payrollApi is removed, or keep them only with the wired-up service.
- Remove the duplicate `changePassword` endpoint in `src/services/settingsApi.js:26-28`. `src/services/authApi.js:17` already defines it and is the only one used.
- Remove the dead `SignedInHome` export in `src/components/SignedInHome.jsx:43-50`. Either delete it or use it as the real client home when M18 lands.
- Remove the dead `convertLeadToClient` mutation at `src/services/clientApi.js:48` and its export at `:88` if the server really converts on status `won`, or wire the Convert button to it and remove the status-PATCH conversion path instead. Do not remove both without confirming the server behaviour first, since that part is UNVERIFIED.
- Remove the commented List/Board toggle block at `src/app/(staff)/leads/index.jsx:122` by either restoring it (P0 add 10) or deleting it and the unused `view` state at `:41` plus the unreachable `LeadBoard` render at `:208`.
- Remove the `manualOverride` mutation in `src/services/attendanceApi.js:92-100`. Exported but never called; edit uses `manualEntry`.
- Remove the `createFreelancerPublic` mutation in `src/services/freelancerApi.js:24-27`. No screen calls it; PLAN M15 explicitly skipped the public apply form.
- Remove the `getPortalStaff` query in `src/services/userApi.js:17-23`. No usage anywhere in `src/`.
- Remove the dead embedded project-task mutations `addProjectTask`, `updateProjectTask`, `deleteProjectTask` in `src/services/projectApi.js:72-84`. Project tasks now go through the Task collection. Keep them only if the web still needs them, which is a server question.
- Remove the `useMarkNotificationReadMutation` export in `src/services/notificationApi.js:33`. Keep the endpoint. All call sites use `notificationApi.endpoints.markNotificationRead.initiate`.
- Remove `getStatusColor` in `src/utils/formatters.js:38`. Grep returns only the definition, zero callers.
- Remove `addMinutes` in `src/utils/time.js`. Grep returns zero callers outside its definition.
- Remove the duplicated paid-percent computation in `src/app/(staff)/payments/[id].jsx` (`paidPct` inline) in favour of the shared `paidPercent` from `src/utils/invoices.js` already used by `PaidBar`.
- Remove the O(n squared) running-total loop in `src/app/(staff)/invoices/[id].jsx` (Payments) in favour of a single-pass accumulator.
- Remove the duplicated progress calculations. Keep `taskProgress` in `src/utils/tasks.js:37-41` as the single source and delete the inline copies in `src/components/TaskParts.jsx:70-73` and `src/components/TaskDetailParts.jsx:402-404`.
- Remove the triple project-message fetch. `src/app/(staff)/projects/[id].jsx:149`, `src/components/ProjectParts.jsx:145-152` (ProjectFiles), and `ProjectChat` each query the same messages. One query, passed down.
- Remove the duplicated 350 ms search debounce across the list screens (leads, clients, meetings, users, teams/[location], freelancers). Extract one `useDebouncedValue` hook; three-plus copies will drift, as the pagination already has.
- Remove the duplicate block-reason logic. `BLOCKED` in `src/components/AttendanceCard.jsx:15` and `blockReason` in `src/components/ClockPanel.jsx:22-29` encode the same leave/holiday/Sunday rules slightly differently. Unify into one helper in `src/utils/attendance.js`.
- Remove one of the two delete-confirm patterns. `ConfirmDelete` (`src/components/AttendanceParts.jsx:187-206`, two-tap arm) vs `ConfirmDialog` (users, freelancers). Pick one and use it everywhere.
- Remove the hard-coded venture list in `src/app/(staff)/freelancers/new.jsx:266`. Derive the list from one shared constant so adding a venture does not need edits in two places.
- Remove the per-card count queries in `src/app/(staff)/teams/index.jsx:18-39`. Each `LocationTeamCard` fires its own `useGetUsersQuery({ location, limit: 1 })` just for the total. A single counts endpoint (or one query) would replace three to four parallel requests.
- Remove the per-screen Android edges overrides (13 sites) once the single `Screen` default lands (P2 add 60). One rule beats thirteen copies. Do not remove before the default is fixed.
- Remove `android.permission.RECORD_AUDIO`, `android.permission.MODIFY_AUDIO_SETTINGS`, `android.permission.FOREGROUND_SERVICE`, and `android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK` from `app.json:30-33` unless a feature that needs them is built. No recording API and no foreground service code exists in `src`.
- Remove `CATEGORIES.open` in `src/services/push.js:34` if the server never sends `categoryId: 'open'`. Confirm against the server payload first, since this one is UNVERIFIED from the mobile repo alone.
- Simplify the two review clocks. `reviewClock` in `src/utils/tasks.js:26-33` is rendered in both `TaskRow` and `ReviewPanel` with slightly different surrounding copy. One shared ReviewClock component would keep the "32 min left" wording identical everywhere.
- Simplify the verify email mount effect: do not resend a code automatically if one was just sent (`src/app/verify-email.jsx:20-21`). It can send duplicate codes and starts the cooldown even when the user already has a code.
- Simplify `src/services/liveActivity.ios.js:20`: guard `props.taskId` before building the deep link, or build the link only when it exists. A future caller without `taskId` would produce `rudhramcrm://tasks/undefined`.
- Do NOT remove the nine `src/utils/*.check.js` files. They are the only tests in this slice of the codebase and they cover the money and date logic that matters most. Either wire them to a `test` script or keep them. If anything, extend `src/utils/invoices.check.js` with a split-payment case asserting the bank-leg method.
- Do NOT remove `src/services/settingsApi.js` as a whole, and do NOT remove `src/components/Charts.jsx`. The settings endpoints are the backend for the Settings screen, and Charts is used by Reports even though dashboards do not use it. Only the duplicate change password inside settingsApi should go.
- Do NOT remove `expo-audio`, `expo-document-picker`, `expo-clipboard`, `expo-network`, `expo-device`, `react-native-webview`, or `socket.io-client`. Each has verified imports. Do NOT remove `@expo/ui` or `expo-widgets` while `src/widgets/WorkTimer.jsx` ships; if the widget is dropped, remove both plus the `app.json` plugin entry together.
- Do NOT remove the version machinery, the working-draft tokens, the dirty-field protection, or the "After this payment" preview in the money modules. They earn their complexity.
- Do NOT build a separate Files tab by duplicating ProjectFiles. The Files strip already exists inside the Chat tab; if TASKS-FLOW.md 2.8 wants a Files tab, move the existing `ProjectFiles` component there rather than building a second file list.

---

# Copy-paste prompts for Claude Code

One prompt per module, plus Dynamic Island and Notifications. Paste one prompt at a time into Claude Code on the repo. Each prompt is self-contained: goal, files to touch, acceptance criteria, what NOT to change. Do not run any build, install, or git command as part of these prompts unless the prompt itself says so.

## 1. Auth / Login: biometric sign-in and email validation

Goal: a returning user can sign in with Face ID or fingerprint from the sign-in screen instead of typing email and password every time, and a malformed email is caught before the request leaves the phone. Files to touch: src/app/sign-in.jsx, src/utils/biometric.js, src/store/session.js, src/app/forgot-password.jsx, src/utils/validators.js if a shared email check is needed. Steps: 1) On the sign-in screen, if a biometric preference exists and the device has biometrics enrolled, show a "Sign in with Face ID / fingerprint" button under the password field that runs the existing biometric check and then restores the session with the stored refresh token. 2) If no biometric preference exists, keep the email/password form exactly as it is. 3) Add client side email format validation to sign-in and forgot password, showing an inline error under the field and disabling submit until the email is valid. 4) Reuse the existing LockScreen biometric handling and the existing session restore, do not write a new token flow. Acceptance criteria: a user who enabled biometrics can sign in with one tap after a fresh app start; a user who never enabled it sees no change; an invalid email shows an inline error with no network request; a valid email still signs in exactly as before; sign-out still clears the biometric preference. What NOT to change: do not change the refresh token flow, the forced password change flow, the OTP flow, the reset deep link, or any other screen.

## 2. Dashboard: guard the data and add trend plus meetings to admin home

Goal: Home never crashes on a partial dashboard response, and the admin home shows a revenue trend and upcoming meetings. Files to touch: src/components/Dashboards.jsx, src/app/(staff)/dashboard/venture/[brand].jsx, src/services/dashboardApi.js only if a new field is needed. Steps: 1) Before rendering tiles, guard `kpis` and `tasks` for null or undefined on the admin, employee, and venture dashboards, and fall back to the existing DashboardState error or zero tiles. 2) Add a revenue trend section to the admin dashboard by reusing `RevenueSection` from src/components/Dashboards.jsx, and an upcoming meetings section by reusing the meetings list from the employee dashboard. 3) Keep the existing 4 tiles, Ventures list, Tasks section, and AttendanceCard unchanged. Acceptance criteria: a dashboard response with no `kpis` object shows an error state instead of crashing; a normal response shows the same tiles plus a revenue trend and upcoming meetings on the admin home; the employee dashboard is unchanged; run npx expo lint and fix any new lint errors. What NOT to change: do not change the dashboard API endpoints, the venture dashboard, the tab bar, or any other module.

## 3. Tasks / My Day: paged, virtualised task lists

Goal: the Tasks tab (My Day, List, Board, Calendar) must load tasks page by page from the server with numbered Previous / Next paging, render rows with FlashList instead of mapping all rows inside a ScrollView, and never silently drop tasks past 100. Files to touch: src/app/(staff)/(tabs)/tasks.jsx, src/components/TaskViews.jsx (ListView, MyDayView, BoardView, CalendarView), src/components/Pager.jsx and src/hooks/usePaged.js only if the existing Pager needs a small change to fit; reuse the existing usePage and usePageNav helpers and the Pager component used by src/app/(staff)/projects/index.jsx. Keep the current behaviour for: My Day groups (Needs my review, Overdue, Today, Later, With the reviewer, Done today), the separate reviews query, filters, search, bulk select, swipe actions, QuickAddTask, and CSV export. Acceptance criteria: (1) List view shows 20 tasks per page with Page X of Y and Previous / Next, and page 2 loads the next 20 from the server; (2) changing a filter or search resets to page 1; (3) My Day keeps its groups but pages within them or caps each group with a clear "showing first N of M" label instead of silently truncating; (4) Board and Calendar keep working on the current page of tasks and do not mount all 100 rows at once; (5) no task is unreachable: the total count shown matches the server pagination total; (6) bulk select only ever selects tasks on the current page and clears on filter, search, or page change, as today. What NOT to change: do not change any API endpoints, RTK tags, task rules in src/utils/tasks.js, the review flow, the stopwatch, project screens, or the client portal; do not add infinite scroll; do not change the visual design of TaskRow; do not run any build, install, or git command; verify by reading the edited files back and reporting the exact lines changed.

## 4. Projects: add the project edit screen

Goal: a staff user can edit a project's basics (title, client, venture, priority, budget, tags, deadline with a reason) from the app, and delete is available to admins. Files to touch: create src/app/(staff)/projects/edit.jsx (or an edit sheet), edit src/app/(staff)/projects/[id].jsx to add the Edit entry point, reuse useUpdateProjectMutation and useDeleteProjectMutation from src/services/projectApi.js, reuse the client picker from src/components/ClientParts.jsx and the existing form components (Input, SelectField, DateField, Button, ConfirmDialog). Steps: 1) Add an Edit button on the project detail Overview tab, visible to users who can manage projects. 2) The edit screen prefills title, client, venture, priority, budget, tags, start date, and deadline from the loaded project. 3) Changing the deadline requires a reason, matching the stage-move-back rule. 4) Save calls useUpdateProjectMutation and shows a toast on success or the server error inline on failure. 5) Add a Delete action for admins with a confirm dialog, using useDeleteProjectMutation. Acceptance criteria: editing a title saves and the detail screen shows the new title after refetch; editing a deadline without a reason is blocked with an inline error; editing a deadline with a reason saves; budget and tags save; a non-admin does not see the Edit or Delete actions; the stage bar, QC, closing note, tasks, chat, and files are unchanged. What NOT to change: do not change the stage flow, the sign-off rules, the task system, the client portal, or any other module; do not add create-client-inline in this task.

## 5. Clients: related projects, invoices, and meetings on client detail

Goal: opening a client shows their work, not just their profile. Files to touch: src/app/(staff)/clients/[id].jsx, reuse existing list queries from src/services/projectApi.js, src/services/invoiceApi.js, src/services/meetingApi.js. Steps: 1) Add three read-only sections under the profile on the client detail screen: Projects, Invoices, Meetings, each listing the client's records with the same row style as the module lists, tapping through to the existing detail screens. 2) Each section shows a count and an empty state ("No projects yet") when there is nothing to show. 3) Load each section only when the detail screen is open, paged at 10 per section with a "See all" link to the module list filtered to this client where the module supports it. Acceptance criteria: a client with projects, invoices, and meetings shows all three sections with correct counts; a client with none shows the three empty states; tapping a row opens the right detail screen; the existing Call/WhatsApp/Email, portal invite, toggle, and delete actions still work exactly as before. What NOT to change: do not change the client form, the portal invite flow, the notes feed, or any other module; do not add a chat button in this task.

## 6. Leads: restore the missing lead follow-up date

Goal: a user can set, edit, and see a lead follow-up date in the mobile app, and overdue leads are visible in the list. Files to touch: src/app/(staff)/leads/new.jsx, src/app/(staff)/leads/[id].jsx, src/app/(staff)/leads/index.jsx, src/components/LeadParts.jsx, src/utils/leads.js if a date helper is needed. Do not touch Clients, Meetings, auth, navigation, or the server. Steps: 1) Add a DateField for followUpDate to the lead create and edit form in src/app/(staff)/leads/new.jsx, prefilled from lead.followUpDate when editing, optional, and include followUpDate in the create and update request bodies only when set. 2) Keep the existing follow-up display in src/app/(staff)/leads/[id].jsx and show Overdue in red when the date is before today and the lead is not won or lost, Due today when it is today, and the date otherwise. 3) In src/app/(staff)/leads/index.jsx add a Follow-up sort or filter for Overdue, Due today, and No date, and show the same overdue or due-today label on each LeadRow in src/components/LeadParts.jsx. 4) Reuse the existing DateField component and date helpers already used by Meetings, and do not add a new date library. Acceptance criteria: creating a lead with a follow-up date saves it and the detail screen shows the same date after refetch; editing the date updates it; clearing the date removes it; an overdue lead shows the overdue label in both list and detail; a won or lost lead never shows as overdue; the existing Palak assignment, lost-reason rule, and community-group rule still work exactly as before; no other screen changes. What NOT to change: do not change the lead status flow, do not change the convert to client flow, do not add local notifications in this change, do not change Clients or Meetings screens, do not add react-hook-form or zod, and do not edit PLAN.md.

## 7. Meetings: server KPIs and an end-time picker

Goal: meeting counts are true even with many pages, and setting an end time does not depend on duration chips alone. Files to touch: src/app/(staff)/meetings/index.jsx, src/services/meetingApi.js, src/app/(staff)/meetings/new.jsx, src/utils/meetings.js. Steps: 1) Add a server stats query (or reuse the list total plus a status breakdown from the server) and use it for the Scheduled, Completed, Cancelled counts and the venture counts, instead of counting only the loaded pages. 2) Add a direct end-time picker next to the start time in the meeting form, keeping the duration chips as a shortcut that sets the end time; changing the start time keeps the same duration instead of clearing the end. 3) Keep recurrence create-only and the existing date, client/lead, link, and attendee behaviour unchanged. Acceptance criteria: with more than 20 meetings, the KPI counts match the server totals; the end-time picker sets the end time and the duration chips still work; changing the start time preserves the duration; creating and editing a meeting still saves exactly as before. What NOT to change: do not change the calendar view, the recurrence rules, the convert-to-task flow, the join link behaviour, or any other module.

## 8. Attendance: offline-tolerant clock-in and clock-out

Goal: when the user taps Clock in, Clock out, Break or End break while offline (or the request fails with a network error), save the punch locally with the time it was tapped, show it as pending on the Attendance tab and the Home card, and send it automatically when the connection returns. A pending punch must never be silently dropped, duplicated, or re-timestamped to the retry time. Files to touch (all under src/): utils/attendance.js (queue helpers and a pending-punch store, AsyncStorage if no store exists yet), components/ClockPanel.jsx (show pending state, disable double taps while a punch is pending, retry button), components/AttendanceCard.jsx (same pending state on Home), app/(staff)/attendance/clock-out.jsx (queue clock-out the same way), services/attendanceApi.js (add a mutation or flag path the queue can call; do not change existing endpoint URLs), hooks/useClockTimer.js only if the timer needs to know about a pending punch. Acceptance criteria: (1) With network off, Clock in shows a visible "Clock-in pending, will send when you are back online" state on both the Attendance tab and Home, with the tapped time shown, and the timer does not start until the server confirms. (2) With network off, Clock out and Break / End break queue the same way and show their pending state. (3) When the network returns, queued punches send automatically in tap order, each with its original tapped timestamp, and the pending state clears only after the server confirms each one. (4) A queued punch survives closing and reopening the app. (5) If the server rejects a queued punch (for example the day is now a holiday or leave was approved), the pending state is replaced by the server error message and the punch is not retried forever. (6) Double-tapping Clock in while a punch is pending cannot create a second queued punch. What NOT to change: do not change any API endpoint URLs or request bodies; do not change the GPS behaviour in utils/attendance.js getLocation (WFH skipping GPS is a separate task); do not change leave, regularization, shifts, holidays, users, teams or freelancer code; do not add new dependencies without asking; do not change the visual design of the ClockPanel or AttendanceCard beyond the pending state itself; do not run any build, install or git command, only edit code and report the files changed.

## 9. Users and Teams: in-screen role guards and form fixes

Goal: admin-only user and team screens refuse non-admins inside the screen, not only by hiding the link, and the user form stops sending a zero salary by accident. Files to touch: src/app/(staff)/users/new.jsx, src/app/(staff)/teams/index.jsx, src/app/(staff)/teams/[location].jsx, src/utils/users.js, src/components/UserParts.jsx only if the guard UI needs it. Steps: 1) Add the same "Admins only" empty state used in src/app/(staff)/users/index.jsx:31-41 to the user create/edit screen and to the team admin actions (No location card, location edit), so a deep link shows the guard instead of the form. 2) In src/utils/users.js, trim phone in userBody, validate email format in userFormError, and never send monthlyGrossSalary as 0 when the field was cleared (omit it or keep the existing value). 3) Keep the role chips, Active switch, salary visibility for payroll admins, and custom teams behaviour unchanged. Acceptance criteria: opening /users/new as a non-admin shows the guard state and no form; a manager cannot reach the team location edit; a cleared salary field does not zero the salary on save; an invalid email shows an inline error; an untrimmed phone saves trimmed. What NOT to change: do not change the users list, the role model, the payroll gate, the freelancer screens, or any attendance screen; do not change the server.

## 10. Freelancers: upload the photo only on save, and validate rates

Goal: cancelling the freelancer form never orphans an uploaded photo, the 5 MB limit is enforced on every platform, and overlapping rate ranges are refused with a clear message. Files to touch: src/app/(staff)/freelancers/new.jsx, src/utils/freelancers.js. Steps: 1) Hold the picked photo locally and upload it only when the form saves; on cancel, discard it without uploading. 2) Fix the 5 MB check to use a size value that exists on both iOS and Android (check the picker asset fields actually returned on each platform), and show an inline error when the photo is too large. 3) In the rate editor, refuse a new rate whose effective range overlaps an existing rate for the same venture, with an inline message naming the overlapping rate. 4) Keep the ventures and rates up front, the "More details" collapse, archive/restore/delete, and the rate history display unchanged. Acceptance criteria: picking a photo then cancelling uploads nothing; saving uploads once; a photo over 5 MB is refused on both platforms with a message; an overlapping rate range is refused with a message; a non-overlapping rate saves. What NOT to change: do not change the freelancer list or detail screens, the access rules, the user screens, or any other module.

## 11. Invoices, Quotations, Payments: PDF share

Goal: after downloading a server PDF, the user can share it through the native share sheet, including WhatsApp, without leaving the app. Files to touch: src/components/ServerDocument.jsx, src/app/(staff)/invoices/[id].jsx, src/app/(staff)/quotations/[id].jsx, src/app/(staff)/payments/[id].jsx, src/app/(staff)/document-preview.jsx. Also add expo-sharing if it is not already a dependency, using npx expo install expo-sharing. Acceptance criteria: (1) Each of the four screens shows a Share button next to the existing Download PDF button, using the same file name the download uses (invoice number, quotation number with version, receipt number). (2) Tapping Share downloads the PDF with the user's token through the existing fetchServer helper (90 second timeout, server error message shown) and opens the native share sheet with the saved file. (3) If the download fails, show a toast with the server message and do not open the share sheet. (4) On Android the shared file comes from the same folder logic download uses; on iOS it comes from the app Documents folder. (5) Run npx expo lint and fix any new lint errors. What NOT to change: do not change download behaviour, file names, PDF endpoints, role gating, or any payroll code; do not add a WhatsApp deep link or a direct wa.me share, the native share sheet is enough; do not touch the quotation version logic, payment recording, or reports.

## 12. Payments: fix split payment method and references

Goal: a split payment records the method the user actually picked for each leg, and a reference can be attached to either leg. Files to touch: src/utils/invoices.js (paymentRequest), src/app/(staff)/invoices/pay.jsx, src/utils/invoices.check.js (add a split-payment case). Steps: 1) In the pay screen, when the split toggle is on, show a method picker for the bank/UPI leg (UPI, bank transfer) instead of hiding the method picker, and a reference field for each leg. 2) In paymentRequest, send the picked method for the bank leg instead of hardcoding bank_transfer, and attach each reference to its own leg. 3) Keep the amount cap (balance due plus 0.001), the both-legs-positive rule, the "After this payment" preview, and the advance-on-draft explanation unchanged. 4) Add a check in src/utils/invoices.check.js asserting a UPI plus cash split records method upi on the first leg and cash on the second, with the right references. Acceptance criteria: a UPI plus cash split shows method upi on the first payment and cash on the second in the payments list; a bank transfer plus cash split shows bank_transfer; each leg keeps its own reference; the amount cap and preview still work; the new check file case passes. What NOT to change: do not change the invoice form, the quotation flow, the receipt PDF, the reports, or any other module.

## 13. Quotations: fix the render-phase setState and validate price

Goal: the quotation form applies server defaults safely and refuses a zero-price quotation. Files to touch: src/components/QuotationForm.jsx, src/app/(staff)/quotations/new.jsx, src/app/(staff)/quotations/edit.jsx. Steps: 1) Move the defaults application in src/components/QuotationForm.jsx:97-101 (setApplied and setF during render) into an effect keyed on the defaults object, with the same guard (only apply when defaults differ from applied). 2) Require price greater than zero before the form is submittable, with an inline error under the price field. 3) When the defaults request fails, show a clear inline error with a retry button instead of only a small error row, and keep submit disabled until defaults load or the user retries. 4) Keep the per-page collapsible sections, "Restore suggested text", dirty-field protection, template cards, and client/project locking on edit unchanged. Acceptance criteria: defaults load without an extra render loop; a zero-price quotation cannot be submitted and shows the inline error; a failed defaults load shows the retry UI and succeeds on retry; a normal quotation still saves exactly as before. What NOT to change: do not change the version logic, the invoice-from-quotation flow, the PDF preview, the reports, or any other module.

## 14. Reports: export and custom date range

Goal: a report can be exported as CSV through the share sheet, and any date range can be picked, not just the six presets. Files to touch: src/app/(staff)/reports/index.jsx, src/utils/reports.js, reuse the CSV share helper pattern in src/utils/tasks.js:100. Steps: 1) Add an Export button on the Reports screen that builds a CSV of the visible tab (rows plus totals) and opens the native share sheet, reusing the tasks CSV pattern. 2) Add a Custom range option to the range picker with two DateFields (from, to), sent as plain local YYYY-MM-DD dates like the existing rangeFor helper. 3) Keep the five tabs, six preset ranges, cash toggle, charts, and aging card unchanged. Acceptance criteria: exporting the Revenue tab shares a CSV with the same rows and totals shown on screen; picking a custom range reloads every tab for that range; the preset ranges still work exactly as before. What NOT to change: do not change the chart components, the invoice/payment/quotation lists, the dashboard, or any other module; do not add a PDF export in this task.

## 15. Notifications: permission priming

Goal: before the app asks iOS or Android for notification permission, show a one-time in-app explainer with a clear benefit, an Allow button, and a Not now button. Tapping Allow triggers the real system prompt. Tapping Not now records the choice, never shows the explainer again on its own, and leaves a re-enable row in Account Settings that opens the explainer again. If the system permission is already granted or already denied, never show the explainer. If permission is denied at the system level, the Account Settings row must say notifications are off in system settings instead of offering a toggle that cannot work. Files to touch: src/services/push.js (split the permission request out of registerPush so priming decides when it runs, keep channel setup and token registration unchanged), one new component for the explainer sheet (follow the existing Card, Button, and Text components and the brand tokens in src/constants/theme), src/components/AccountSettings.jsx (add the re-enable row), and src/utils/prefs.js only if a new persisted key is needed for the priming choice. Acceptance criteria: first signed-in launch shows the explainer before any system prompt appears; Allow leads to the system prompt and then registers the push token on grant; Not now dismisses without a system prompt and does not reappear on next launch; a user who denied at the system level sees the off-in-settings state in Account Settings; a user who granted never sees the explainer; existing behaviour for simulators, web, and missing EAS project id is unchanged; run npx expo lint and fix any new lint errors. What NOT to change: notification channels, ids, names, or importance values; action button categories; the socket fallback local notification; badge sync logic; deep link routing; the sound toggle; any API endpoint or Redux slice; the client portal screens.

## 16. Client Portal: home states and totals

Goal: a client opening Home sees their numbers and their work, and a new client with no tasks sees a helpful empty state instead of a blank screen. Files to touch: src/app/(client)/(tabs)/portal/index.jsx, reuse src/components/Skeleton.jsx, src/components/EmptyState.jsx, and the existing queries from src/services/dashboardApi.js, src/services/invoiceApi.js, and src/services/meetingApi.js only if the server returns client-scoped data for them. Steps: 1) Read isLoading and isError from the existing useGetTasksQuery call and render a Skeleton while loading, an error retry on failure, and an empty state with a link to projects when there are no tasks. 2) Add a totals row (invoiced, paid, outstanding) and an upcoming meetings section, using the existing server endpoints only if they already return client-scoped data; if an endpoint does not, leave that section out and say so in the report instead of inventing data. 3) Keep the greeting, the 5 most recently updated tasks, and the "See all projects" button. Acceptance criteria: a new client with no tasks sees the empty state with a working link to projects; a loading home shows skeletons; a failed load shows retry; a client with data sees totals and upcoming meetings where the server provides them; the projects and tasks screens are unchanged. What NOT to change: do not build portal invoices or meetings in this task (they are blocked server-side); do not change the staff screens, the notification routing, or any API endpoint.

## 17. Settings / Profile: build the real Settings screen

Goal: tapping Settings in the More screen opens a working settings page instead of Coming Soon, with profile edit, notification preferences, push on/off, and the existing account block. Files to touch: create src/app/(staff)/settings/index.jsx, edit src/components/AccountSettings.jsx only to reuse its profile card, biometric toggle, sound toggle, change password and sign out rows inside the new screen, and use the existing hooks in src/services/settingsApi.js (useGetNotifPrefsQuery, useUpdateNotifPrefsMutation, useUpdateProfileMutation). Do not edit src/services/api.js, src/store/session.js, src/app/_layout.jsx, or any auth screen. Use the existing Screen, Card, ListRow, Input, Button, Toggle and Toast components, follow DESIGN.md tokens and the Manrope plus Goldenbook type scale, and keep the screen scrollable with pull to refresh. Acceptance criteria: (1) Settings appears once in More and opens the new screen, not Coming Soon. (2) Profile edit saves name and phone through useUpdateProfileMutation and shows a success toast, with server errors shown inline. (3) Notification preferences load from useGetNotifPrefsQuery, toggle per type, save through useUpdateNotifPrefsMutation, and show a loading skeleton while fetching and a retry button on error. (4) Push on/off toggle registers or unregisters the push token through the existing push helpers and persists the choice. (5) Biometric toggle, sound toggle, change password and sign out keep working exactly as they do in AccountSettings today. (6) The screen is reachable for all staff roles and hidden for no role, matching NAV_ITEMS. (7) Run npx expo lint and fix any new lint errors in the touched files. What NOT to change: do not build org settings, roles and permissions, security settings, integrations, Zoho, or email template screens in this task, do not change the refresh token or biometric logic, do not change the tab bar or the More search behavior, and do not add new dependencies.

## 18. Finance: build My Payslips (read-only)

Goal: every staff user can see their own payslips and download or share the slip PDF. Files to touch: create src/app/(staff)/my-payslips/index.jsx, import the hooks from src/services/payrollApi.js (getMySlips, downloadSlipPdf), reuse src/components/ServerDocument.jsx for the PDF download and the share action from prompt 11 if it exists, and update src/constants/index.js:212 so the nav entry points at the real screen. Steps: 1) List my slips with month, gross, deductions, and net, newest first, with loading skeleton, error retry, and an empty state. 2) Tapping a slip shows its detail (earnings, deductions, net) with Download PDF and Share actions. 3) Import payrollApi from this screen so its endpoints register; keep the payroll runs screens unbuilt. 4) Remove the dead Payroll nav entry at src/constants/index.js:211 until the runs screen exists, or leave it hidden. Acceptance criteria: a staff user sees their own slips only; the list shows correct month and net; the slip PDF downloads and shares with the right file name; a user with no slips sees the empty state; the More screen no longer leads to a missing route for My Payslips. What NOT to change: do not build payroll runs, generate, finalize, or reopen in this task; do not change the salary visibility rules; do not change any other module; do not touch the server.

## 19. Dynamic Island / Live Activities: fix the lifecycle

Goal: after the app is killed, the phone restarts, or the user clocks out from web or another device, the island must end or re-sync on next launch and on foreground, with no orphaned task timer. Files to touch: src/services/liveActivity.ios.js, src/hooks/useClockTimer.js, src/utils/tasks.js, src/components/TaskDetailParts.jsx, and src/app/(staff)/_layout.jsx only if a new launch-sync hook is needed. Do not touch src/widgets/WorkTimer.jsx layout, app.json, eas.json, push.js, or any Android code. Steps: (1) On staff-shell mount, load the persisted stopwatch from getStopwatch and call showWorkTimer('task', ...) to re-sync it if it is still valid, or showWorkTimer('task', null) to end it if the task is done or the stopwatch is older than 24h. (2) In useClockTimer, trigger a sync immediately on AppState change to active and on socket or query invalidation, not only on the 60s poll, and end the clock activity as soon as the server reports no active session. (3) Guard the task deep link in liveActivity.ios.js so a missing taskId never builds rudhramcrm://tasks/undefined. (4) Keep the silent catch for Live Activities disabled in Settings, but return a boolean from showWorkTimer so callers can tell start from failure. Acceptance criteria: kill the app with a task stopwatch running, relaunch, and the island shows the correct elapsed time; discard or stop the stopwatch and the island ends at once; clock out from web, foreground the app, and the clock island ends within 5 seconds without waiting for the poll; with Live Activities off in Settings the app does not crash and no island is shown; existing clock-in, break pause, and stopwatch flows still work exactly as before. What NOT to change: no new Live Activity types, no home-screen widget, no push-to-update work, no toast library changes, no app.json or eas.json edits, no UI restyle, and no changes to the timer layout in WorkTimer.jsx. Verify by reading the changed files back and by listing the exact manual device steps to test; do not claim device behaviour you did not run.

## 20. Android: ongoing timer notification and predictive back

Goal: Android users get a persistent timer surface for clock-in and stopwatch, and back navigation feels Android-native. Files to touch: src/services/push.js, src/hooks/useClockTimer.js, src/utils/tasks.js, app.json, src/app/(staff)/_layout.jsx, src/app/(client)/_layout.jsx. Steps: (1) Add an ongoing (non-dismissible) local notification for the active clock-in session and the running task stopwatch, using the existing Android channels, showing the same title and elapsed time as the iOS Live Activity, tapping through to the attendance tab or the task, and ending it when the session or stopwatch ends. Do not start a foreground service for this; use a plain ongoing notification. (2) Set predictiveBackGestureEnabled to true in app.json and remove the Android ios_from_right animation override in both layouts, then check back behaviour from every modal and form sheet. Acceptance criteria: on Android, clocking in shows an ongoing notification with live elapsed time that survives leaving the app and ends on clock-out; starting a task stopwatch shows the same for the task; tapping either notification opens the right screen; pressing back from a form sheet follows the Android predictive back gesture; iOS behaviour is unchanged. What NOT to change: do not change the iOS Live Activity code, the push channels or their importance values, the notification categories, the badge logic, or any other module; do not add a foreground service or new permissions in this task.

---

## Notes on this review

- Scope: main branch only, read-only, 23 Nov 2026. Dev is 1 commit behind main, so nothing in dev changes these findings.
- Store facts, for the record only: Apple Developer is $99 a year, Google Play Console is $25 one-time. The app now has far more than the 2 to 3 modules reported on 20 Nov, but the release checklist (M19) is entirely unchecked, so release work has not started by the plan's own definition.
- The single most valuable sequence from this review: P0 items 2 and 3 (dead routes, Settings), P0 item 5 (page the Tasks hub), P0 items 7 and 8 (offline punch, WFH GPS), P0 items 9 and 10 (lead follow-up date, board toggle), P0 item 11 (PDF share), P0 items 12 and 13 (permission priming, deep links), P0 items 15 and 16 (Live Activity lifecycle). After those, the app stops lying to users (dead routes, silent caps, stale island) and the remaining work is mostly finishing half-built modules.
- Things deliberately NOT recommended here: adding Dynaura or Sileo (they cannot touch the Dynamic Island and the in-app toast already exists), a rebuild of any module, TypeScript migration (the JS codebase is consistent and the web code is JS too), and building portal invoices or meetings before the server fixes the client invoice filter.
