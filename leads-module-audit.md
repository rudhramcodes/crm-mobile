# Leads Module Audit (crm-mobile)

Date: 28 Nov 2026. Read only: no code was changed. Nothing was built or run on a device. Every API contract was checked against the backend in `CRM/server/src/modules/leads`. Anything that needs a running app to confirm is marked *(not run)*.

## Scope

| File | Lines | Role |
|---|---|---|
| `src/app/(staff)/leads/index.jsx` | 250 | List, search, filters, stage stats, bulk select |
| `src/app/(staff)/leads/[id].jsx` | 176 | Detail, contact buttons, stage chips, notes, convert, delete |
| `src/app/(staff)/leads/new.jsx` | 314 | Create and edit form (`?id=`) |
| `src/app/(staff)/leads/lost.jsx` | 24 | Lost-reason sheet |
| `src/app/(staff)/leads/community.jsx` | 60 | WhatsApp community-group check (SOP) |
| `src/components/LeadParts.jsx` | 236 | Row, filters, venture chips, bulk bar, board, `useLeadStatus` |
| `src/services/leadApi.js` | 114 | RTK Query endpoints |
| `src/utils/leads.js`, `leads.check.js` | 48 | Status rules and link helpers, plus a node self-check (passes) |

Shared code these screens depend on: `utils/access.js`, `utils/attendance.js` (`runAction`, `isAdmin`), `AttendanceParts.jsx` (`SheetHeader`, `backTo`, `ConfirmDelete`), `hooks/useLiveUpdates.js`, `utils/notificationRoute.js`.

## Severity scale

- **High**: wrong data, an action the user didn't mean with effects outside the app, or an access gap. Fix before release.
- **Medium**: a broken or misleading flow, stale data, or a missing safeguard. Fix soon.
- **Low**: polish, an inconsistency, dead code, or a rare edge case.

## Summary

| ID | Sev | Area | Finding |
|---|---|---|---|
| H1 | High | Conversion | One tap converts to client and emails the customer, with no confirmation |
| H2 | High | Edit form | Every edit reassigns the lead to Palak, and edits are blocked if that lookup fails |
| H3 | High | Access | Non-sales employees get full write access through notification links |
| M1 | Med | Edit form | Clearing Company or Venture shows "Lead updated" but changes nothing |
| M2 | Med | Edit form | The form's stage chips skip the community check and the conversion rules |
| M3 | Med | Detail | "View client" shows on every lead, next to "Convert to client" |
| M4 | Med | State | Stage stats go stale after a create, and ignore the active filters |
| M5 | Med | Bulk | Bulk actions can hit leads that aren't on screen, and bulk delete is weakly confirmed |
| M6 | Med | List | The list silently stops at 100 leads and isn't virtualized |
| M7 | Med | Stages | Moving a lead off "Won" is allowed, but the server can't undo a conversion |
| M8 | Med | Form | "No venture" can't actually be saved; the server stores Panigrahna |
| M9 | Med | Contact | Calling a new lead never moves it forward, so the SOP repeats on every call |
| M10 | Med | Form | Unsaved input is thrown away on Cancel or swipe, with no warning |
| M11 | Med | Errors | Validation errors for fields with no input are hidden |
| L1–L15 | Low | Various | See [Low findings](#low) |
| B1–B6 | — | Backend | Server issues that affect this module; see [Backend](#backend-issues-that-affect-leads) |

---

## High

### H1. One tap converts a lead to a client and emails the customer, with no confirmation

**Where:** `[id].jsx:95` ("Convert to client" button), `[id].jsx:85` ("Won" stage chip), `LeadParts.jsx:49-50` (the `update` branch of `useLeadStatus`), `new.jsx:219-234` (the edit form's stage chips).

**What happens:** for any lead not in `new`, including a `lost` lead, tapping "Convert to client" or the "Won" chip sends `PATCH status: 'won'` at once. `statusStep` returns `update`, so nothing stands in the way. The server then:
- activates the client record,
- emails the onboarding message to the lead's own address (`lead.service.js:283-290`),
- notifies every active staff member (`lead.service.js:366-381`).

There's no undo; see M7. The "Won" chip sits in a wrapping row of six chips, so a stray tap is enough to send it.

**Fix:** in `useLeadStatus`, send `next === 'won'` through a `ConfirmDialog` (the component already exists), for example: "Convert Asha Rao? This activates client RE-PG-2026-014 and emails asha@… a welcome message." Do the same in the edit form when the status changes to `won`.

### H2. Every edit reassigns the lead to Palak, and edits are blocked if that lookup fails

**Where:** `new.jsx:54-74` (`usePalak`), `new.jsx:95-100` (`ready` requires `palak.user`), `new.jsx:120` (`assignedTo` is always sent).

**What happens:**
- **Silent reassignment.** The edit payload always carries `assignedTo: palak._id`. A lead assigned to anyone else is moved to Palak by any edit, even a typo fix in the name. This covers older leads, and any lead created through the server's fallback, which assigns the creator (`lead.service.js:126`). The server also sends a "reassigned" notification to the previous owner (`lead.service.js:330-358`).
- **Blocked edits.** If the users query fails, or Palak's account is renamed or inactive, the Update button stays disabled. That blocks editing *any* lead, not only creating one. The 23 Nov review covered the create case only.

The web `LeadForm.jsx:110-128` sends the same payload, so this is a shared product rule. On mobile it also blocks edits.

**Fix:** when editing, send `assignedTo` only if the user changed it, and don't require `palak.user` to save an edit. Longer term, read the default assignee from settings and use the existing `UserPicker`.

### H3. Non-sales employees get full write access through notification links

**Where:** `utils/access.js:4` (`canWriteModule`) and `:16-22` (`canSeeNavItem`), `utils/notificationRoute.js:9`, server `lead.service.js:148-152`, `lead.routes.js:24-99`.

**What happens:**
1. The More menu hides Leads from employees outside sales.
2. Every new lead notifies **every active user** (`lead.service.js:148-152`). Tapping that notification opens `/leads/:id`.
3. `canWriteModule` checks only `readOnlyModules`, so the screen shows Edit, the stage chips, Convert and Add note.
4. The server authorizes every `employee` to create, update, add notes and bulk-update (`lead.routes.js`), so all of those actions succeed.

Hiding the menu entry is cosmetic: it doesn't actually restrict anything.

**Fix:** this needs a product decision first.
- **If leads are sales-only:** enforce it on the server (a department check or a module grant). Mirror the `canSeeNavItem` rule in `canWriteModule` for `leads` and `clients`, and stop sending `lead_created` to staff outside sales.
- **If all staff may work leads:** drop the nav restriction so the two rules agree.

---

## Medium

### M1. Clearing Company or Venture shows "Lead updated" but changes nothing

**Where:** `new.jsx:116-117`.

`brand: brand || undefined` and `company: company.trim() || undefined` both send `undefined` when the field is empty. JSON drops `undefined` keys, so the server keeps the old value. The update schema does accept `null` and `''` (`lead.validation.js:182-188`). The user still sees "Lead updated".

**Fix:** when editing, send `company: company.trim()` (an empty string is allowed) and `brand: brand || null`.

### M2. The edit form's stage chips skip the community check and the conversion rules

**Where:** `new.jsx:219-234`, `new.jsx:119`.

The edit form sends `status` straight to the server. That skips the community-group check that `statusStep` requires when a lead leaves `new`, and it skips the conversion warning (H1). It also contradicts the design note in `LeadParts.jsx:38`: "One entry point for every status change". The lost reason is still required inline, which is correct.

**Fix:** remove the stage picker from the edit form, since the detail screen already has stage chips. Or apply the change through `useLeadStatus` after saving.

### M3. "View client" shows on every lead, next to "Convert to client"

**Where:** `[id].jsx:95-96`.

The server creates an **inactive** Client for every lead when the lead is created, and fills in `convertedToClient` (`lead.service.js:79-127`, populated in `lead.repository.js:17`). So `convertedToClient._id` is almost always set. A brand-new lead shows both "Convert to client" and "View client", and "View client" opens an inactive client. The web marks Active or Inactive (`LeadDetail.jsx:283`, `:473-489`); mobile doesn't.

**Fix:** show "View client" only when `l.status === 'won' || l.convertedToClient?.status === 'active'`. Show the client's status next to the Client ID row.

### M4. Stage stats go stale after a create, and ignore the active filters

**Where:** `leadApi.js:25`, `index.jsx:55-56`, `index.jsx:100-116`.

- `createLead` invalidates only `'Lead'`. It doesn't invalidate `'LeadStats'`, or `'Client'`, even though the server has just created an inactive Client.
- The list screen stays mounted under the create modal, so its stats subscription is never refetched.
- Pull-to-refresh refetches only the list (`usePullRefresh(q.refetch)`).
- The tiles always show all-venture totals, even while the list below is filtered by venture, stage or search.
- The server already returns `byBrand` (`lead.service.js:580-585`), and nothing uses it.

**Fix:**
- Add `'LeadStats'` and `'Client'` to `createLead.invalidatesTags`.
- Refetch the stats on pull-to-refresh.
- Either caption the tiles "All ventures", or feed `byBrand` into `VentureChips`, which already accepts a `counts` prop (`LeadParts.jsx:113`).

### M5. Bulk actions can hit leads that aren't on screen, and bulk delete is weakly confirmed

**Where:** `index.jsx:61-65` and `:76-80`, `LeadParts.jsx:147-163` and `:180`, `AttendanceParts.jsx:189-207`.

The code's own rule (`index.jsx:61`) is that bulk actions "must only touch visible leads". That rule breaks in three ways:
- **Refetches.** The selection isn't pruned when the list refetches, through pull-to-refresh or a cache invalidation from another screen.
- **Clear filters.** `reset()` calls `setF` rather than `set`, so the selection survives.
- **What gets sent.** `LeadBulkBar` sends `selected`, not `picked`, so ids that are no longer listed still go to the server. The header can read "5 of 3 selected".

Bulk delete uses `ConfirmDelete`: the second tap deletes, the armed state never times out, and there's no dialog naming the count. Deleting a single lead uses a proper `ConfirmDialog`.

**Fix:**
- Send `picked.map((l) => l._id)` instead of `selected`.
- Drop ids from `selected` that are no longer in `leads` whenever the list changes.
- Clear the selection in `reset()`.
- Use `ConfirmDialog` for bulk delete, for example "Delete 12 leads?".

### M6. The list silently stops at 100 leads and isn't virtualized

**Where:** `index.jsx:51-54`, `index.jsx:205-216`.

The caption shows the server total ("240 LEADS"), but only the first 100 render, with no notice. This was flagged on 23 Nov and is still open. All rows are rendered with `.map` inside a `ScrollView`, each wrapped in `Link.AppleZoom`, even though FlashList is installed.

**Fix:** use the existing `usePaged` hook the way Clients and Meetings do, and render the list with FlashList.

### M7. Moving a lead off "Won" is allowed, but the server can't undo a conversion

**Where:** `[id].jsx:85`, server `lead.service.js:230-293`.

The stage chips allow `won` → any other stage. The server doesn't deactivate the client when a lead leaves `won`. If the lead is later won again, the customer gets the onboarding email a second time, and every staff member is notified again.

**Fix:**
- **Mobile:** confirm with a warning before leaving `won`, or limit it to admins.
- **Server:** see B4.

### M8. "No venture" can't actually be saved; the server stores Panigrahna

**Where:** `new.jsx:199-203`, `community.jsx:20`.

The form offers "No venture", but the server stores `panigrahna` when `brand` is missing (`lead.service.js:76`) and gives the client ID a PG code. The detail screen then shows "Venture: Panigrahna". The community sheet also falls back to the Panigrahna community.

**Fix:** make venture required (`noneLabel={null}`), or label the option "Panigrahna (default)".

### M9. Calling a new lead never moves it forward, so the SOP repeats on every call

**Where:** `[id].jsx:32-36`, `community.jsx:28-31`.

Calling or messaging a `new` lead goes through the community sheet and then opens the dialer, but the status stays `new`. So:
- every later call or WhatsApp asks for the group again;
- the lead still can't be marked lost, because the rule says to contact it first.

**Fix:** when the user confirms "Call now" or "Open WhatsApp", also set the status to `contacted`. Or offer a "Mark as contacted" toggle that is on by default.

### M10. Unsaved input is thrown away on Cancel or swipe, with no warning

**Where:** `new.jsx:149-157` (Cancel runs `backTo()`).

Swiping the iOS modal down or pressing Android back does the same. Notes of up to 2,000 characters are lost.

**Fix:** track whether the form has changed, and ask before discarding. A `beforeRemove` listener or `usePreventRemove` works for this.

### M11. Validation errors for fields with no input are hidden

**Where:** `new.jsx:158`.

The top Alert is hidden whenever `fieldErrors` is not empty. But only name, email, phone, company, assignedTo, lostReason and notes show their own errors. Errors on `brand`, `source`, `status` or `followUpDate` appear nowhere on the form. The user sees only the toast "Couldn't create the lead · Validation failed".

**Fix:** show the Alert with any errors that don't belong to a visible field.

---

## Low

| ID | Where | Finding | Fix |
|---|---|---|---|
| L1 | `index.jsx:59`, `:224-244` | `active` doesn't count the venture filter. A venture-only search with no matches shows "No leads yet / New lead" instead of "No leads match / Clear filters". | Count `f.brand` in the empty-state check. |
| L2 | `LeadParts.jsx:154-158`, `community.jsx:33` | A bulk stage change that includes new leads sends only the first new lead to the community sheet. That sheet then returns to the lead's detail page, and the bulk selection is lost. Also, single moves to "contacted" from any stage require the group check (`leads.js:13`), but bulk skips it for leads that aren't new. | Leave new leads out of bulk with a message, or walk through them one by one. Apply the same rule in both paths. |
| L3 | `new.jsx:95-100`, `leads.js:24-27` | Phone numbers aren't checked on the device, though `libphonenumber-js` is installed; the server rejects them only after submit (`lead.validation.js:135-140`). `waLink('09876543210')` builds `wa.me/09876543210`, which is wrong, and the server accepts that number as valid. | Add `isValidPhoneNumber(phone, 'IN')` to `ready`. Build the tel and WhatsApp links from the parsed E.164 number. |
| L4 | `[id].jsx:78` | The Email button has no `.catch`, so it fails silently when no mail app is installed. | Add the same toast the Call and WhatsApp buttons use. |
| L5 | `leadApi.js:14-17` | The unread dot stays after you open a lead. The server marks the lead read on GET (`lead.service.js:209-212`), but the list is still mounted and isn't refetched. This corrects the 23 Nov review, which said nothing marks a lead read. | After the detail loads, patch the list cache with `updateQueryData`, or invalidate the list. |
| L6 | `useLiveUpdates.js:112-114` | The list doesn't update live. `notification:new` invalidates only `Notification` (and `Task`), so an open Leads screen ignores `lead_created`. | Also invalidate `['Lead','LeadStats']` when `referenceModel === 'Lead'`. |
| L7 | `community.jsx:21` | If a lead has no `clientId`, the sheet makes one up (`RE-PG-2026-001`), which is a real ID belonging to another client. Staff would name the WhatsApp group with it. This is rare, because the server normally assigns an ID. The web has the same fallback. | Show "Client ID not assigned yet" and turn off Confirm. |
| L8 | `new.jsx:121` | Leaving `lost` doesn't clear `lostReason`; the old reason is sent as `undefined` and kept. If the lead is marked lost again, the edit form fills in the old reason. | Send `lostReason: null` when the status isn't `lost`. |
| L9 | `leadApi.js:55`, `[id].jsx:149-153` | `deleteLead` invalidates `'Lead'`, which also matches the open detail query, so the deleted lead is refetched before navigating back. This may flash an error state *(not run)*. | Navigate first, or use `removeQueryData` for that id. |
| L10 | `LeadParts.jsx:159`, `:162` | Bulk success toasts use the number selected and ignore the server's `updated` and `deleted` counts. | Show the count the server returns. |
| L11 | `index.jsx:149-157` | The search placeholder doesn't mention Client ID, though the server searches it (`lead.repository.js:38-44`). The search icon looks tappable but does nothing. | Add "client ID" to the placeholder. Make the icon submit the search, or make it look decorative. |
| L12 | `dashboard/venture/[brand].jsx:49` | The "Total leads" tile on a venture dashboard opens `/leads` without that venture. The Leads screen reads no route parameters. | Pass `?brand=`, and use it as the starting filter. |
| L13 | `index.jsx:42`, `:118-138`, `:204`; `LeadParts.jsx:188-236`; `leadApi.js:28-34`, `:85-92`; `clientApi.js:48` | Dead code: the board view and its commented-out toggle, `importLeads`, `submitPublicInquiry`, and `convertLeadToClient` are never called. | Ship the board or delete it, and remove the unused endpoints. |
| L14 | lead screens | Leads code imports `runAction` and `isAdmin` from `utils/attendance.js`, and `SheetHeader`, `backTo` and `ConfirmDelete` from `AttendanceParts.jsx`. `backTo` falls back to `/attendance` by default. | Move them into shared utils and components. |
| L15 | `leads.check.js` | The self-check covers only the pure helpers. It passes (`node src/utils/leads.check.js` → `ok`), but no script runs it. Nothing checks the form payloads; a check on those would have caught M1 and H2. | Add payload-builder checks, and a `check` script in `package.json`. |

---

## Backend issues that affect Leads

These are in `CRM/server`, not in the mobile app. They are listed because the mobile flows depend on them.

| ID | Where | Issue |
|---|---|---|
| B1 | `lead.service.js:148-152` | `lead_created` is sent to **every** active user. That includes `client`-role accounts, if any are still active after the portal removal, which would expose lead names and sources to clients. Send it to staff only. |
| B2 | `lead.routes.js` | No role or ownership limits: any employee can list, edit or bulk-update any lead. This is the server side of H3. |
| B3 | `lead.repository.js:20-24`, `:83-85` | Soft-deleted leads still reserve their email, so creating a lead can fail with "A lead with this email already exists" for a lead nobody can see. Deleting a lead also leaves its inactive Client behind. |
| B4 | `lead.service.js:230-293` | Moving a lead off `won` leaves its client active, and winning it again re-sends the onboarding email (see M7). |
| B5 | `lead.service.js:320-323` | Changing the venture after creation updates the inactive client's brand, but the client ID keeps the old venture code. |
| B6 | `lead.controller.js` (`stats`) | `/leads/stats` takes no filters, so the stats can't match a filtered list (see M4). |

## Missing functionality

- **Follow-up date.** The server accepts `followUpDate` on create and update (`lead.validation.js:156`, `:193`). Mobile only displays it. There are no reminders, and no overdue or "due today" view.
- **Leads beyond the first 100** (M6).
- **"My leads" filter and sorting.** The server already supports `assignedTo`, `sortBy` and `sortOrder` (`lead.validation.js:203-213`).
- **Kanban board.** It's built (`LeadBoard`) but its toggle is commented out.
- **Status history.** The server stores `statusChangedAt` and `statusChangedBy`; mobile never shows them.
- **Assigned rep in list rows.** The rep appears only on the detail screen.
- **Duplicate check before saving.** Only email is unique; there's no warning about a duplicate phone number.
- **Import.** The API exists. It's reasonable to keep it on the web.

## What works well

- One status-rule function (`statusStep`) drives the detail chips, the board and bulk moves. It matches the server's "can't mark a new lead lost" rule and has a self-check.
- `cleanParams` drops empty filters, which the server would otherwise reject as invalid values.
- `BULK_STATUSES` matches the server's `BULK_STATUS_LIST` exactly. Delete and bulk delete are admin-only, as on the server.
- Response shapes match the server (`data.lead`, and `data` with `pagination`). The create flow navigates to the new lead.
- Accessibility labels are good on rows (including unread and stage), chips (selected state) and the venture switcher, and touch targets are 44 pt.
- Client-side length limits match the server: notes 2,000 characters, lost reason 500, name and company 200.

## Corrections to the 23 Nov review (`crm-mobile-full-review.md`)

- **Lead marked read:** the review said nothing marks a lead read. In fact the server sets `isRead = true` on `GET /leads/:id` (`lead.service.js:209-212`). The real bug is the stale list (L5).
- **Client created on "won":** the review left this unverified. It's now verified: every lead gets an inactive Client when it's created (`lead.service.js:79-127`), and `won` activates that client and emails the customer (`:236-293`). That makes H1 and M3 real.
- **Palak lookup:** the review said the lookup blocks creating a lead. It blocks **editing** as well (H2).

## Suggested fix order

1. **H1:** confirm before conversion. It's a small change, and it prevents an email to the customer that can't be taken back.
2. **H2:** send `assignedTo` only when it changes, and let edits save without the Palak lookup.
3. **M1:** let edits clear Company and Venture.
4. **M5:** fix which ids bulk actions send, and add a delete dialog.
5. **M3, M4:** show "View client" only for active clients, and fix stats invalidation.
6. **H3 and B1/B2:** decide who may work leads, then enforce it on the server.
7. **M6, then follow-up date:** add paging, then build follow-up dates.
