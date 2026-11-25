# Client Portal Removal

## In short

We removed the **client portal**, the area where clients could log in to see their projects, invoices and meetings.

- Clients **can no longer log in** to the CRM website or the mobile app.
- New clients **don't get a login or a password**.
- New clients **still get a welcome email**. It now says their team will be in touch and gives the brand team's email address.
- Nothing changes for staff, apart from a few portal buttons that are gone.

This is the **first step**. A later cleanup will remove the leftover client code that nobody uses any more (see [Later cleanup](#later-cleanup)).

## Why it was safe to remove

We checked the live database first:

| What we checked | Result |
|---|---|
| Client accounts | 38 |
| Client accounts ever actually used | 2, both test accounts |
| Unused invite links | 0 |

No real client was using the portal, so nobody loses anything.

## What clients can no longer do

| Before | Now |
|---|---|
| Log in on the website or the app | Not allowed. Even older versions of the app can't log them in. |
| Stay logged in from an earlier visit | Signed out on their next action |
| Open portal pages | The pages are gone |
| Use an invite link to set a password | Invite links no longer work |
| Get a login when they're added as a client | No login is created |

Staff also can't give anyone the "Client" role any more.

## What changed, part by part

### Server (the CRM backend)

- **Client logins are refused.** The server treats a client account like a switched-off account, so it can't log in or stay logged in.
- **No accounts for new clients.** When someone adds a client or converts a lead, the server no longer creates a login or sends a password.
- **Invites removed.** The "send portal invite" and "accept invite" features are gone.
- **Emails:**
  - Removed: the portal invite email and the login details email.
  - Kept and reworded: the **welcome email**. It no longer mentions the portal or passwords. Every button in it opens an email to the client's brand team.
  - If the welcome email fails to send, the client is still saved and the error is logged.
- **Email previews:** the welcome email is now under a new **Clients** category in Settings → Email Previews.

### CRM website

- All portal pages are deleted (client dashboard, projects, invoices, meetings, profile, guide, onboarding, portal login, invite page).
- Logging in and out always goes to the normal staff login page.
- The "Go to Client Portal" link is gone from the login page.
- On a client's page, the **Send Portal Invite** button and the **Portal Active / Inactive** label are gone.
- When booking a meeting with a client, the client is no longer added as an attendee automatically.
- The **Client** role can't be picked when creating a user.
- **Not touched:** the public enquiry form and the freelancer form. They share the word "portal" but are separate features.

### Mobile app

- All client screens are deleted.
- If a client account tries to log in, or is still logged in, the app shows **"Staff only"** and signs them out.
- On a client's page, the portal label and invite button are gone.
- When booking a meeting with a client, the client is no longer added as an attendee automatically.
- The **Client** role can't be picked when creating a user.
- The chat note "The client can read this chat" is gone.

## Testing

- The automated server tests for login and clients pass. New tests check that client accounts are refused.
- The website builds without errors.
- The mobile app passes its code checks.
- The welcome email was checked: it no longer mentions the portal, logging in or passwords.
- **Still to do by hand:** try logging in as a client on a running server and confirm it is refused.

## How to release

1. Release the **server and website together**. They depend on each other.
2. Release the **mobile app** as an over-the-air update. No app store release is needed.
3. *(Optional)* Switch off the old client accounts in the database so the data matches:
   ```js
   db.users.updateMany({ role: "client" }, { $set: { isActive: false } })
   ```
   Switch them off rather than deleting them. Their names still show in old chats, meetings and notifications.

## Later cleanup

Some leftover client code is still there. It's harmless, because clients can't log in, but it should be removed in a later update:

- the "Client" user role itself
- a few server endpoints only the portal used
- client-only checks in the project, task and meeting code
- old client fields on client records

---

<details>
<summary>For developers: where the main changes are</summary>

**Server (`CRM/server/src`)**
- Login block: `middleware/auth.js`, `modules/auth/auth.service.js`
- No new client accounts: `modules/clients/client.service.js`, `modules/leads/lead.service.js`
- Invites removed: `modules/clients/client.routes.js`, `client.controller.js`, `client.repository.js`, `modules/auth/*`
- Client role can't be assigned: `modules/users/users.validation.js`
- Emails: `services/emailService.js`, `modules/settings/emailPreviewData.js`, `scripts/generateEmailPreviews.js`
- Tests: `middleware/__tests__/readOnlyModules.routes.test.js`, `modules/auth/__tests__/auth.refresh.test.js`

**Website (`CRM/client/src`)**
- Deleted: portal pages, components and data in `modules/portal/` (except `InquiryForm` and `InquirySelection`), plus the `ClientPortalLayout`, `ClientAuthLayout` and `ClientSidebar` layouts
- Updated: `routes/`, `hooks/useAuth.js`, `services/api.js`, `services/clientApi.js`, `services/userApi.js`, `app/store/authSlice.js`, `layouts/Header.jsx`, `layouts/Sidebar.jsx`, `pages/auth/`, `modules/clients/`, `modules/meetings/components/MeetingForm.jsx`, `modules/users/pages/UserManagement.jsx`, email template pages

**Mobile (`crm-mobile/src`)**
- Deleted: `app/(client)/`, `app/accept-invite.jsx`
- Updated: `app/_layout.jsx`, `store/session.js`, `components/` (`SignedInHome`, `NotificationInbox`, `TaskParts`, `TaskChat`, `ProjectParts`, `MeetingParts`, `InvoiceParts`), `hooks/useLiveUpdates.js`, `utils/notificationRoute.js`, `services/` (`api`, `authApi`, `clientApi`), `app/(staff)/clients/`, `app/(staff)/meetings/new.jsx`, `app/(staff)/users/new.jsx`

</details>
