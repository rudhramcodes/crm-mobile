# Tasks & Projects — the next-level flow

Goal: anyone can add, assign, follow and close work in a few taps, with no training.
The app does the chasing (reminders, reviews, unblocking), so people don't have to.

Linked from PLAN.md (M5 Tasks, M6 Projects). Phases T1–T6 are at the bottom.

---

## 0. What exists today (checked in the server code)

| Area | Today | Gap |
|---|---|---|
| Assignee | One `assignedTo` per task | No multiple people, no teams |
| Task chat | `comments`: text only, @mentions | No images, no files, no replies |
| Attachments | `attachments[]` field on the Task model | **No upload route** — nothing fills it |
| Project chat | Text + up to 5 images (10 MB), @mentions | Lives only in the project, not in the task |
| Project tasks | **Two separate systems**: `Project.tasks[]` (embedded) and the `Task` collection (Tasks hub) | The same work shows up in two places, out of sync |
| Review | Only the creator can mark Done; others "Submit for review" | No reviewer timer, no reminder, no "request changes" note |
| Reminders | One daily 06:00 job: "due within 24h" | No "2h left", no overdue nudge, no review chasing |
| Notifications | In-app + phone push + email; 5-min duplicate filter **kept in memory** (resets on restart) | Assignment and due-soon send an **email every time** → spam risk |
| Progress | Checklist % only | No auto status, no project progress from tasks |

---

## 1. The ideas (in one screen)

1. **Add in one line.** `Edit teaser @Rahul @Sana tomorrow 5pm !high #wedding` → task made, two people assigned, due set. A full form is still there for details.
2. **One owner, many helpers, or a whole team.** Every task has one *owner* (responsible) and any number of *helpers*. Pick a saved **Team** ("Edit team") to add everyone at once.
3. **Progress fills itself.** Status moves on its own from what people do: start the timer or tick a checklist item → *In progress*; all checklist items ticked → "Send for review?" prompt.
4. **Every task has its own chat.** Text, photos (camera/gallery), files, @mentions, reply to a message. Images open full screen with pinch zoom.
5. **Review within 1 hour.** Submitting for review starts a 1-hour clock for the reviewer. The app reminds them, then escalates. The reviewer has two big buttons: **Approve** or **Ask for changes** (with a note).
6. **Push first, email almost never.** Push/in-app for things that need action. **At most one email a day** per person, and only if something is really pending.
7. **Projects are made of the same tasks.** One task system; a project just groups tasks by milestone, shows progress, chat, files and team.

---

## 2. The flows, screen by screen

### 2.1 Add a task (≤ 3 taps)

- **Quick add bar** on top of Tasks and inside each project. Type one line and press Enter.
  - `@name` → person (first match from your team; the project's team first, inside a project)
  - `@EditTeam` → whole team
  - `today`, `tomorrow`, `fri`, `25 dec`, `5pm`, `in 3 days` → due date/time
  - `!high` / `!urgent` → priority
  - `#tag` → tag
  - A chip row under the input shows what it understood (`👤 Rahul +1 · 📅 Tomorrow 5 pm · High`). Tap a chip to change it before saving.
- **Smart defaults** (nothing is a required question):
  - Owner = me if nobody is named
  - Due = today 7 pm if no date is given (shown in the chip, easy to change)
  - Project = the project you're in
- **Full form** ("More options") keeps everything that exists today: description, checklist, subtasks, estimate, recurring, dependencies.
- **From chat:** long-press any chat message (task or project chat) → **Make a task**. The message text becomes the title and its images become attachments.
- **Templates:** "Wedding shoot", "Pre-wedding", "Corporate film" — one tap creates the standard task list with relative due dates (e.g. *Backup raw data* = shoot day + 1). Admins edit the templates.

### 2.2 Assign (people, helpers, teams)

- The assignee picker shows, in order: **project team → my teams → everyone**. Search by name.
- The first person picked is the **Owner** (star). Others are **Helpers**. Tap the star to change the owner.
- **Teams:** a saved group (name, lead, members) like *Edit team* or *Shoot crew*. Picking a team adds all its members; the team lead becomes the owner unless one is already set.
- **"Same task together" vs "Copy for each person"** (a toggle that shows only when 2+ people are picked):
  - Together (default): one task, everyone sees it, anyone can tick the checklist or submit.
  - Copy for each: one task per person (e.g. "Submit timesheet"), each reviewed separately.
- **Reassign** keeps the history ("Rahul → Sana, by Faizal") and notifies both people.

### 2.3 See progress

- **Task card** shows: owner avatar + helper count, due, a thin progress bar (checklist + subtasks), the status chip, and a 💬 count of unread messages.
- **Auto status:**
  - To do → In progress: when someone starts the timer, ticks a checklist item, or posts the first image in the task chat
  - In progress → "Send for review?": a prompt when the last checklist item is ticked (never moves on its own)
  - Any content edit on a Done task → back to In progress (this already works on the server)
- **My Day** (already built) gets three sections at the top: **Needs my review**, **Overdue**, **Due today**.
- **Project progress** = done tasks ÷ all tasks (weighted by estimate if set), shown next to the SOP stage bar. When every task of a milestone is done, the milestone is marked done on its own.
- **Team view** (managers): each person → open tasks, overdue, waiting for review, hours logged this week.

### 2.4 Task chat (with images and files)

- Replaces today's comment list with a chat thread on the task screen (newest at the bottom, input fixed at the bottom).
- Attach: **camera, gallery (up to 5 images, 10 MB each), PDF/files**. Uses the same Cloudinary upload that project chat already uses.
- @mention people (notifies them), reply to a message, delete my own message.
- All images of a task also show in a **Files** strip on top of the task. Same for the project (all images from all its tasks + project chat).
- Clients keep their current rights: they see and comment only on their own project's tasks.

### 2.5 Review (the 1-hour promise)

```
Owner taps "Submit for review"  (optional note + images of the work)
        │
        ▼
Reviewer gets push: "Review: Edit teaser — please check within 1 hour"   ← T+0
        │ not opened?
        ▼
Reminder push to reviewer: "Still waiting for your review (15 min left)" ← T+45 min
        │ still not reviewed after 1 hour?
        ▼
Push to reviewer: "Review is late" + in-app notice to their manager/admin ← T+1 h
        │ still not reviewed after 3 working hours?
        ▼
Included in the reviewer's daily email (the only email)                  ← next morning
```

- **Reviewer** = the task creator (today's rule). The creator can hand review to someone else (e.g. a manager) from the task.
- Review screen: the submit note, images, checklist, time logged, then two buttons:
  - **Approve** → Done. Owner and helpers get a push: "Approved ✓".
  - **Ask for changes** → note required (and images allowed) → back to In progress. Owner gets a push with the note.
- The 1-hour clock counts **working hours only** (e.g. 10 am–7 pm, Mon–Sat, from the attendance shift settings). Something submitted at 8 pm is due by 11 am next day.
- The task shows a small timer: "In review · 32 min left" / "Review late by 20 min".
- Review speed shows up in Insights: average time to review, per reviewer.

### 2.6 Notifications — useful, never spam

**Who gets what (push + in-app):**

| Event | Who | When |
|---|---|---|
| Assigned / added as helper | that person | at once |
| Submitted for review | reviewer | at once, then T+45 min, then T+1 h (see 2.5) |
| Approved / changes asked | owner + helpers | at once |
| @mention, reply to me | that person | at once |
| New chat messages | owner, helpers, watchers (not the sender) | **grouped**: one push per task per 10 min — "3 new messages on Edit teaser" |
| Due in 2 hours, not started | owner | once |
| Due tomorrow | owner | once, 9 am (morning list, one push for all tasks) |
| Overdue | owner; creator after 1 day | once per day, 10 am, one push listing all |
| Blocked task is now free | owner of the waiting task | at once: "You can start X now" |

**Anti-spam rules:**
- Never notify the person who did the action.
- **Quiet hours** 9 pm – 8 am: pushes wait until 8 am (except Urgent priority).
- Grouping: the same task + same kind within 10 min → one push.
- The duplicate filter moves from server memory to the database (a "sent" record per task + kind), so restarts and timers never send twice.
- Each person can mute a task ("Mute this task") or a kind of notification (the settings page already has per-type on/off).

**Email — only when needed:**
- **No email per event** (today assignment and due-soon send an email each time — turn that off).
- **One morning email at most** (9 am), only if the person has something pending they haven't seen in the app: reviews waiting, overdue tasks, tasks assigned to them that they haven't opened. Nothing pending → no email.
- Each person can turn the daily email off.

### 2.7 Automatic helpers ("next level", but quiet)

- **Recurring tasks:** when one is approved, the next copy is created with the next due date (the model has the fields; check the job runs).
- **Dependencies:** when a blocking task is done, the waiting task's owner gets "You can start X now".
- **Milestones:** all milestone tasks done → milestone done → project manager gets one push: "Shoot milestone complete — move project to Review?" (one tap, still needs a person to confirm).
- **Project from template:** making a project for a venture offers its task template, dates counted from the shoot/event date.
- **Stale task nudge:** In progress with no activity for 3 days → owner gets one push: "Still working on X?" with buttons *Yes* / *Send for review* / *Reschedule*.
- **Workload hint while assigning:** "Rahul has 9 open tasks, 2 overdue" under the name in the picker.

### 2.8 Projects page (same tasks, grouped)

Tabs on one project: **Overview · Tasks · Chat · Files · Team**

- **Overview:** SOP stage bar, progress ring (from tasks), next 3 due tasks, reviews waiting, deliverables status.
- **Tasks:** grouped by milestone, quick add bar inside each milestone, same cards and swipes as the Tasks tab.
- **Chat:** project chat (already on server, with images). A message can link to a task, which shows as a small card.
- **Files:** every image/file from project chat + its tasks' chats, newest first.
- **Team:** members with role, their open tasks here; "Add to every new task" toggle for leads.

---

## 3. Server changes needed

All changes keep the web app (`CRM/client`, 17 files use `assignedTo`) working.

1. **Multiple assignees, safely:** keep `assignedTo` as the **owner**, add `helpers: [User]`. List/filter "assigned to me" = owner OR helper. The web app keeps reading `assignedTo` and does not break.
2. **Teams:** new small `Team` model `{ name, lead, members[] }` + CRUD (admin/manager create; anyone reads).
3. **Task chat:** add `images[]` + `replyTo` to the task comment, and `POST /tasks/:id/attachments` (multer + the existing Cloudinary service, ≤5 files, 10 MB). Same limits as project chat.
4. **Review fields:** `reviewer`, `reviewRequestedAt`, `reviewNote`, `reviewRemindersSent` (so each reminder is sent once), and the `requestChanges` path takes a note.
5. **One task system:** move `Project.tasks[]` into the `Task` collection (with `project` set) in a one-time migration script; project task routes read/write `Task`. The web project page needs the same switch. **Back up the database first.**
6. **Jobs** (node-cron, already used): every 5 min → review reminders + "due in 2h"; 9 am → due-today/overdue push list + the daily email; daily → stale-task nudge. Each job checks the "sent" fields so it never repeats.
7. **Notifications:** switch email off for `task_assigned` and `task_due_soon` templates; add quiet hours + 10-min grouping in `notification.service`; deep links to `/tasks/:id` (today they go to `/projects/:id`).
8. **Auto status** rules in `updateTask` / checklist / timer endpoints (server side, so web and mobile behave the same).

---

## 4. Build order (each phase ships on its own)

| Phase | What | Server | Mobile | Size |
|---|---|---|---|---|
| **T1** ✅ | Notifications fix: no email spam, quiet hours, grouping, deep links to the task, DB-based "sent" check | yes | small | S |
| **T2** ✅ | Review flow: submit note + images, Approve / Ask for changes, 1-hour reminders + escalation, review timer, "Needs my review" in My Day | yes | yes | M |
| **T3** ✅ | Task chat with images/files, replies, Files strip, image viewer | yes | yes | M |
| **T4** | Owner + helpers, Teams, "copy for each person", workload hint, one-line quick add with @ / dates / ! / # | yes | yes | M |
| **T5** | Auto status, auto milestone, dependency unblock push, stale nudge, recurring check, daily email | yes | small | M |
| **T6** | One task system (migrate project tasks) + Projects page (M6) with Overview/Tasks/Chat/Files/Team + templates | yes + web | yes | L |

T1 first because it is small and stops spam today. T2 next because review speed is the main ask.

**T1 done (Nov 2026).**
- Task alerts (assigned, due soon, review) never email. Other modules (meetings, money, leaves) keep their emails.
- Repeats (same person, kind and task within 10 min) fold into one notification: "… (+2 more)", no second push. Checked in the database, so restarts never send twice.
- Quiet hours 21:00–08:00 IST for task pushes only; Urgent tasks still push. Held pushes go out at 08:00, one summary if several waited, skipped if already read in the app.
- "Due soon" runs at 09:00 IST, once per due date (re-armed by a reschedule), one notification per person listing all their tasks.
- Comment alerts now point at the task (they pointed at the comment id, so the deep link was broken); links for tasks with no project go to `/tasks`.
- Not done yet: "Mute this task" and the single daily email (moved to T5).

**T2 done (Nov 2026).** Shortcuts taken, upgrade later:
- Office hours are fixed at 10:00–19:00 IST, Mon–Sat; holidays are not skipped (`server/src/utils/workingHours.js`).
- Late reviews alert the reviewer and all admins, since users have no manager field yet.
- The submit / changes note is text only; images come with T3.
- Swiping or ticking a task still sends it for review at once, with no note.
- Review alerts go by push and in-app only, never email.

**T3 done (Nov 2026).**
- Task chat: text, photos (camera or gallery), PDFs, @mentions, replies, delete own message (admins can delete any). Up to 5 files per message, 10 MB each; images go to Cloudinary, PDFs as raw files.
- Everyone on the task (owner, helpers, creator, reviewer, watchers, the person replied to) is notified; T1 folds repeats into one push.
- Files strip on top of the task, and a full-screen viewer: swipe between photos, pinch or double-tap to zoom. PDFs open in the in-app browser.
- Review notes ("Send for review" and "Ask for changes") can carry photos/PDFs. They're posted to the task chat right after the note, and the review card shows everything sent since the task went into review.
- Not done yet: long-press a message → "Make a task" (with T4 quick add), the project-level Files tab (T6). Only photos and PDFs are accepted, not other file types.

**Simple flow (Nov 2026), part of T5.**
- The task screen has one card that always shows the next step: To do → **Start work** → "How far along?" 25 / 50 / 75% → **Done, send for review** (or **Mark done** for the reviewer) → Approve / Ask for changes → Done, with **Reopen**.
- Blocked tasks show "Waiting on X" instead of Start, and the owner gets "You can start now" when the last blocking task is done.
- A To Do task starts itself when someone sets progress, ticks a checklist item or logs time (not while it is still blocked). Done sets progress to 100.
- Started / finished / moved back now reach owner, helpers, creator and watchers (not the person who did it), in plain words ("Rahul started …"). Before, helpers and watchers heard nothing.
- My Day is only my tasks; tasks in review sit under "With the reviewer", not "Overdue". Done means done today.
- New: `progress` (0-100) on Task. Test: `server/src/modules/tasks/__tests__/task.flow.test.js`.

---

## 5. Decisions to confirm (my default in bold)

1. Reviewer: **the task creator**, who can hand it to someone else? Or always the project manager?
2. Late review escalates to: **the reviewer's manager, then admin**?
3. Working hours for the 1-hour clock: **from the attendance shift (e.g. 10–7, Mon–Sat)**?
4. Daily email time: **9 am**, and **on by default** (each person can turn it off)?
5. Can helpers submit for review, or only the owner? **Anyone on the task**.
6. Migrating project tasks (T6) touches the web app too — **do it in T6, after a DB backup**.

---

## 6. Who can do what

One set of rules, enforced by the server (`CRM/server/src/modules/tasks/taskRules.js`) and mirrored in the app (`src/utils/tasks.js`). The app hides what you can't do; the server refuses it anyway.

### 6.1 The roles on a task

Your **role on a task** matters more than your job title:

| Who | What they are |
|---|---|
| **Owner** | The person it's assigned to. |
| **Helpers** | People helping the owner. They can do everything the owner can. |
| **Creator** | Whoever made the task. Reviews it unless review was handed to someone else. |
| **Reviewer** | Checks the work and marks it Done. The creator, unless handed over. |
| **Task managers** | The creator, the reviewer, and anyone with the **Manager**, **Admin** or **Super admin** role. |
| **Other staff** | Employees who aren't on the task. |
| **Client** | The client user linked to the task's project. |

### 6.2 What each can do

| Action | Owner / helpers | Task managers | Other staff | Client |
|---|---|---|---|---|
| See the task | ✅ | ✅ | ✅ | ✅ own projects only, without internal history, time logs, review notes or emails |
| Chat, photos, PDFs | ✅ | ✅ | ✅ | ✅ (staff see "The client can read this chat") |
| Delete a chat message | own | own (admins: any) | own | own |
| Follow (get updates) | already get them | already get them | ✅ | — |
| Start, progress %, move back to To do | ✅ | ✅ | — | — |
| Checklist: add and tick | ✅ | ✅ | — | — |
| Checklist: remove an item | — | ✅ | — | — |
| Description, tags, start date, estimate | ✅ | ✅ | — | — |
| Log time (today or yesterday) | ✅ | ✅ | — | — |
| Remove a time entry | own | anyone's | — | — |
| Move the due date | ✅ with a reason; creator, reviewer and owner are told | ✅ with a reason | — | — |
| Add a subtask | ✅ | ✅ | — | — |
| Title, priority, assignee, helpers, project, repeat | — | ✅ | — | — |
| Dependencies (link / unlink) | — | ✅ | — | — |
| Hand review to someone else | — | ✅ | — | — |
| Send for review | ✅ | ✅ | — | — |
| **Approve / mark Done** | only if they're the reviewer | **reviewer only** | — | — |
| Reopen a Done task | ✅ | ✅ | — | — |
| Delete a task | — | **Admin / Super admin only** | — | — |

Same rules apply to every way of changing a task: the task screen, swipes, the Board arrows, bulk select and notification buttons. Bulk changes skip the tasks you can't change and say how many were skipped.

**Good to know**
- A task can't be sent for review or approved while a task it depends on is still open.
- Changing the **title, description or due date** of a Done task reopens it (Working). Tags, priority, estimate, start date and people don't.
- Adding a subtask or checklist item to a task in Review or Done reopens it.
- New tasks start in To do or Working, never straight in Review or Done.
- Work can only be assigned to active staff, never to clients or deactivated accounts.

### 6.3 Who gets notified

Never the person who did the action.

| When | Who hears | Buttons |
|---|---|---|
| Task assigned to you | the new owner | Start work · Open |
| Added as a helper | each new helper | Start work · Open |
| Reassigned away from you | the old owner ("now with X") | Open |
| Started, moved back, reopened | owner, helpers, creator, reviewer, followers | Open |
| Sent for review | the reviewer, with the 1-office-hour clock | Approve · Open |
| 15 min before the review is due | the reviewer | Approve · Open |
| Review is late | the reviewer and all admins | Approve · Open |
| Changes asked | owner and helpers, with the note | Open |
| Approved | owner, helpers, creator, followers | Open |
| A task you were waiting on is done | owner of each task it unblocks | Open |
| Due date moved | creator, reviewer and owner, with the reason | Open |
| Due in the next 24 h (9 am daily, once per due date) | owner and helpers (not while in Review) | Open |
| Chat message | people on the task and followers; on a client project the client hears staff and the team hears the client | Reply |
| @mention or reply to you | that person | Reply |
| Task deleted | everyone who was on it | — |

Tapping any of these opens the task itself (clients: the portal's task page). A task you're already looking at doesn't buzz.
