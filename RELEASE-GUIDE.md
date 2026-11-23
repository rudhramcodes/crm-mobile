# Rudhram CRM — App Store & Play Store Release Guide

A complete, start-to-finish guide for publishing **Rudhram CRM** to the Apple App Store and Google Play Store using Expo EAS (Expo's cloud build service). You do **not** need Xcode or Android Studio.

What this project already has (checked in the repo):

| Item | Value |
|---|---|
| App name | Rudhram CRM |
| iOS bundle ID | `com.rudhram.crm` |
| Android package | `com.rudhram.crm` |
| Version | `1.0.0` (in `app.json`) |
| EAS project ID | already linked (`extra.eas.projectId` in `app.json`) |
| Build numbers | handled automatically by EAS (`appVersionSource: remote` + `autoIncrement`) |

> ⚠️ The bundle ID / package name `com.rudhram.crm` is **permanent** once you publish. Change it now if you want something else.

---

## Overview (the whole journey)

1. Create accounts (Apple, Google, Expo) — **start today, approval can take days**
2. Prepare the app (production API URL, push notifications, small config)
3. Prepare store material (icon, screenshots, privacy policy, demo login)
4. Build the app in the cloud with EAS
5. Submit to Apple → TestFlight → App Review → Live
6. Submit to Google → Testing → Production → Live
7. Releasing future updates

Rough timeline: accounts 1–14 days · first builds 1 day · Apple review 1–3 days · Google review 1–7 days (+14 days of testing if you use a personal Google account — see Step 1.2).

---

## Step 0 — Tools on your Mac

1. Install **Node.js LTS**: https://nodejs.org (download the LTS installer, double-click, Next → Next).
2. Open **Terminal** (press `Cmd + Space`, type *Terminal*, Enter).
3. Go to the project folder:
   ```bash
   cd ~/Desktop/Faizal/crm-mobile
   ```
4. Check EAS CLI works (it downloads automatically):
   ```bash
   npx eas-cli@latest --version
   ```

---

## Step 1 — Create the accounts

### 1.1 Apple Developer Program — $99 / year

**Decide first: Individual or Organization?**
- **Organization (recommended for a company):** the store shows "Rudhram Enterprises" as the seller. Needs a **D-U-N-S number** (free).
  - Check / request D-U-N-S: https://developer.apple.com/enroll/duns-lookup/ (takes 1–5 business days if you don't have one)
  - Needs a company website and an email on that domain (you have `@rudhramenterprises.com` ✅)
- **Individual:** your personal name is shown as seller. Faster.

Steps:
1. Create / use an Apple ID (turn on two-factor authentication): https://appleid.apple.com
2. Enroll: https://developer.apple.com/programs/enroll/ (easiest from the **Apple Developer app** on iPhone)
3. Pay the $99 fee. Wait for the "Welcome to the Apple Developer Program" email (24–48 h, sometimes longer for organizations).
4. Log in to **App Store Connect**: https://appstoreconnect.apple.com → accept any agreements shown at the top.
5. Go to **Business** (formerly *Agreements, Tax, and Banking*) → accept the **Free Apps agreement** (paid apps need bank/tax info; this CRM is free).

### 1.2 Google Play Console — $25 one-time

1. Sign up: https://play.google.com/console/signup
2. Choose account type:
   - **Organization (recommended):** needs the same **D-U-N-S number**. No mandatory testing period.
   - **Personal:** Google requires new personal accounts to run a **closed test with at least 12 testers for 14 continuous days** before you can publish to Production. Plan for this if you pick Personal.
3. Pay $25, complete **identity verification** (government ID; for organizations also company documents). This can take a few days.
4. Verify the contact phone number and email when asked.

### 1.3 Expo account — free

1. Sign up / log in: https://expo.dev/signup
2. In Terminal:
   ```bash
   npx eas-cli@latest login
   ```
   ```bash
   npx eas-cli@latest project:info
   ```
   If `project:info` errors with a permission problem, the project (`92e5005b-…`) belongs to a different Expo account — ask whoever created it to add you to their Expo organization (expo.dev → Organization → Members), or log in with that account.

---

## Step 2 — Prepare the app for production

### 2.1 Production API URL (very important)

Your `.env` file points to `localhost`. **EAS cloud builds never see your local `.env` file**, so a store build would have no API URL and the app would not be able to log in.

1. Your backend must be deployed on a public **HTTPS** address (e.g. `https://api.rudhramenterprises.com`). Apple and Android block plain `http://` by default.
2. Store the values in EAS (replace the URLs with your real ones):
   ```bash
   npx eas-cli@latest env:set --name EXPO_PUBLIC_API_URL --value https://api.yourdomain.com/api --environment production --visibility plaintext
   ```
   ```bash
   npx eas-cli@latest env:set --name EXPO_PUBLIC_SOCKET_URL --value https://api.yourdomain.com --environment production --visibility plaintext
   ```
   (`env:set` creates or updates the variable. Older guides use `env:create`, which EAS now marks as deprecated.)
   These are the only two variables the app reads (`EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SOCKET_URL`, see `.env.example`).
3. Tell the production build to use these values — in `eas.json`, change the `production` profile to:
   ```json
   "production": {
     "autoIncrement": true,
     "environment": "production"
   }
   ```
   You can see/edit these later on https://expo.dev → your project → **Environment variables**.

### 2.2 Push notifications (the app uses `expo-notifications`)

**iOS:** nothing to do now — EAS creates the Apple Push key for you during the first iOS build (answer **Yes** when it asks to set up Push Notifications).

**Android (Firebase / FCM) — required or push will not work on Android:**
1. Go to https://console.firebase.google.com → **Add project** → name it "Rudhram CRM" → finish.
2. In the project, click the **Android** icon → package name `com.rudhram.crm` → **Register app**.
3. Download **`google-services.json`** and put it in the project root (`crm-mobile/google-services.json`).
4. Add to `app.json` inside `"android": { … }`:
   ```json
   "googleServicesFile": "./google-services.json"
   ```
5. Firebase → ⚙️ **Project settings** → **Service accounts** → **Generate new private key** → save the JSON file somewhere safe (**do not commit it to git**).
6. Upload that key to EAS:
   ```bash
   npx eas-cli@latest credentials
   ```
   Choose: `Android` → `production` → `Google Service Account` → `Manage your Google Service Account Key for Push Notifications (FCM V1)` → `Set up …` → `Upload a new service account key` → select the JSON file.

   Guide: https://docs.expo.dev/push-notifications/fcm-credentials/

### 2.3 Small `app.json` additions (recommended)

Inside `"ios": { … }` add this so you don't have to answer Apple's encryption questionnaire on every upload (the app only uses standard HTTPS):
```json
"config": { "usesNonExemptEncryption": false }
```

### 2.4 Final checks before building

```bash
npx expo-doctor
```
```bash
npx expo lint
```
Fix anything they report. Also test the app once against the **production** API on a real phone (internal build — see Step 4.1).

---

## Step 3 — Prepare the store material

Create these while you wait for account approval.

| Item | Apple | Google |
|---|---|---|
| App icon | 1024×1024 PNG, no transparency (already `assets/images/icon.png`) | 512×512 PNG |
| Feature graphic | — | 1024×500 PNG/JPG |
| Screenshots | iPhone 6.9" (1320×2868) required; iPad 13" (2064×2752) required because `app.json` sets `ios.supportsTablet: true` (the app also runs on iPad). Don't want iPad? Set it to `false` before the first build and skip these. | Phone: min 2 screenshots (e.g. 1080×1920) |
| App name | max 30 chars | max 30 chars |
| Subtitle / short description | 30 chars | 80 chars |
| Description | up to 4000 chars | up to 4000 chars |
| Keywords | 100 chars, comma-separated | — |
| Privacy Policy URL | **Required** | **Required** |
| Support URL | Required | Contact email required |
| Demo login for reviewers | **Required** | **Required** |

Specs: https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications

Tips:
- **Screenshots:** run the app on the iOS Simulator (iPhone 17 Pro Max for 6.9", iPad Pro 13") and press `Cmd + S` to save screenshots.
- **Privacy Policy:** a public web page (e.g. `rudhramenterprises.com/privacy`) explaining what you collect. This app collects: name/email/phone, **location** (clock-in), **photos/camera**, files, push tokens, and Face ID/fingerprint (biometrics stay on the device). It also asks for **Contacts** access, only to save client contacts onto the phone (nothing from the phone's contacts is uploaded). It does **not** use the microphone (`app.json` turns microphone access off). Say what it's used for, who it's shared with, and how a user can request data deletion.
- **Demo account:** create a test user on the production server (e.g. `reviewer@rudhramenterprises.com`) with sample data. Reviewers **reject apps they can't log into**. Make sure clock-in works for the reviewer even if they are not near your office (e.g. disable the location check for this demo account), or explain in the review notes.
- **Account deletion:** Apple requires an in-app "Delete account" option *if users can sign up themselves*. If only your admins create accounts, write that in the review notes.

> **Is this CRM only for your employees?** Apple sometimes rejects apps meant for one company's staff ("not for the general public"). If that happens, request **Unlisted App Distribution** (app is on the store but only reachable via a direct link): https://developer.apple.com/support/unlisted-app-distribution/ — or use Apple Business Manager *custom apps*. On Google you can publish normally, or privately via Managed Google Play.

---

## Step 4 — Build the app with EAS

### 4.1 (Optional but recommended) Test build on real phones first

```bash
npx eas-cli@latest build --profile preview --platform android
```
The `preview` profile in `eas.json` builds an installable `.apk`. When it finishes you get a link/QR code → open on an Android phone → install. For iPhone internal builds you must register devices first (`npx eas-cli@latest device:create`), so most people test iOS through **TestFlight** instead (Step 5).

### 4.2 Production builds

```bash
npx eas-cli@latest build --platform all --profile production
```

What happens / what to answer:
- **iOS:** it asks you to log in with your **Apple ID** → choose your team → answer **Yes** to let EAS generate the distribution certificate, provisioning profiles (for the app *and* the widget extension that the `expo-widgets` plugin adds for the clock-in / stopwatch Live Activity), and Push Notification key.
- **Android:** answer **Yes** to "Generate a new Android Keystore". EAS stores it safely — **never delete it** (you can download a backup from expo.dev → Credentials).
- Builds run in the cloud, about 15–40 min each (free plan may queue). Follow progress at https://expo.dev → your project → **Builds**.
- Result: an `.ipa` (iOS) and an `.aab` (Android).

---

## Step 5 — Publish on the Apple App Store

### 5.1 Create the app record
1. https://appstoreconnect.apple.com → **Apps** → **＋** → **New App**
2. Platform: iOS · Name: *Rudhram CRM* · Language: English · Bundle ID: `com.rudhram.crm` · SKU: `rudhram-crm` · Access: Full Access → **Create**.

### 5.2 Upload the build
```bash
npx eas-cli@latest submit --platform ios --latest
```
Log in with your Apple ID when asked. After 10–30 minutes the build shows under **TestFlight** in App Store Connect (you get an email when processing finishes).

### 5.3 Test with TestFlight (recommended)
1. App Store Connect → your app → **TestFlight** → **Internal Testing** → **＋** create a group → add your team (they must be users in App Store Connect → *Users and Access*).
2. Testers install the **TestFlight** app from the App Store and accept the invite.

### 5.4 Fill in the App Store page
In App Store Connect → your app:
1. **App Information:** category (*Business* / *Productivity*), content rights, age rating questionnaire (answer No to everything for a CRM → 4+).
2. **App Privacy:** add the Privacy Policy URL → **Get Started** on data collection → declare: Contact Info, Location (precise), Photos, User Content, Identifiers (push token) → for each: "used for App Functionality", linked to the user, not used for tracking. Do **not** declare Audio: the app has no microphone access.
3. **Pricing and Availability:** Free, choose countries.
4. **iOS App 1.0 (version page):** upload screenshots (iPhone + iPad), promotional text, description, keywords, support URL.
5. **Build:** click **＋** and select the build you uploaded.
6. **App Review Information:** demo username + password, your phone/email, and notes such as: *"Internal CRM for Rudhram Enterprises staff. Accounts are created by admins. Location is used only to verify office clock-in."*
7. **Version Release:** choose *Manually release* (safer for the first time) or *Automatically*.
8. Click **Add for Review** → **Submit to App Review**.

### 5.5 Review
- Usually 24–48 hours. Status changes: *Waiting for Review* → *In Review* → *Pending Developer Release* / *Ready for Distribution*.
- If rejected, read the message in **App Review → Messages**, fix, then reply or upload a new build (`build` + `submit` again).
- Once approved and released, the app is live within a few hours. 🎉

Guidelines: https://developer.apple.com/app-store/review/guidelines/

---

## Step 6 — Publish on Google Play

### 6.1 Create the app
1. https://play.google.com/console → **Create app**
2. Name *Rudhram CRM* · Language · **App** · **Free** · accept declarations → **Create app**.

### 6.2 Let EAS upload to Google (Service Account key)
Follow this exact visual guide: https://expo.fyi/creating-google-service-account

Summary: Google Cloud Console → create a service account → create a **JSON key** → in Play Console → **Users and permissions** → **Invite new user** with the service-account email → give it **Admin / release** permissions for the app.

Then upload the JSON key to EAS:
```bash
npx eas-cli@latest credentials
```
Choose: `Android` → `production` → `Google Service Account` → `Manage your Google Service Account Key for Play Store Submissions` → `Set up …` → pick the JSON file.

> If EAS submit fails on the very first upload, upload the `.aab` manually once: download it from the build page on expo.dev → Play Console → **Testing → Internal testing** → **Create new release** → upload. Guide: https://docs.expo.dev/submit/android-manual/

### 6.3 Upload the build
```bash
npx eas-cli@latest submit --platform android --latest
```
This creates a release on the **Internal testing** track. In Play Console → **Testing → Internal testing** → **Testers** tab → create an email list → share the opt-in link with your team.

### 6.4 Complete the "Set up your app" tasks (Dashboard)
Play Console → **Dashboard** → work through every item under *Set up your app* / **App content**:
- **Privacy policy** URL
- **App access:** "All or some functionality is restricted" → add demo username/password + instructions
- **Ads:** No
- **Content rating:** questionnaire (category: *Utility, Productivity, Communication, or Other*) → mostly "No"
- **Target audience:** 18+ (avoid selecting children's ages)
- **News app:** No
- **Data safety:** declare Personal info (name, email, phone), Location (precise), Photos, Files, App activity, Device IDs (push) → collected, encrypted in transit, users can request deletion. Do **not** declare Audio. Help: https://support.google.com/googleplay/android-developer/answer/10787469
- **Government app / Financial features / Health:** No
- **Foreground service permissions:** none. `app.json` blocks `FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_MEDIA_PLAYBACK` and turns off background audio, so this declaration should not appear; if it does, the build is out of date (rebuild).
- **Location permissions:** foreground only — confirm in the declaration if prompted.
- **Store listing** (Grow → Store presence → Main store listing): short + full description, 512×512 icon, 1024×500 feature graphic, phone screenshots, category (*Business*), contact email.

### 6.5 Go to Production
- **Organization account:** Play Console → **Production** → **Create new release** → **Add from library** (pick the build already on internal testing) → release notes → **Next** → **Start rollout to Production**.
- **Personal account:** first run **Closed testing** with ≥12 testers for 14 days (Testing → Closed testing → create track → add testers → promote your build). After 14 days, **Apply for production access** on the Dashboard, then do the step above.
- Google reviews it (a few hours to 7 days). When approved, the app is live. 🎉

---

## Step 7 — Releasing future updates

1. Make your code changes and test them.
2. Increase the version in `app.json` → `"version": "1.0.1"` (build numbers increase automatically).
3. Build and send to both stores in one go:
   ```bash
   npx eas-cli@latest build --platform all --profile production --auto-submit
   ```
4. **Apple:** App Store Connect → **＋ Version** → enter 1.0.1 → select the new build → "What's New" text → Submit for Review.
5. **Google:** Play Console → Production → Create new release → add the new build → Rollout.

(Later you can add `expo-updates` for instant over-the-air JS fixes without store review: https://docs.expo.dev/eas-update/introduction/)

---

## Quick troubleshooting

| Problem | Fix |
|---|---|
| App can't log in / blank data after install | Production API URL not set in EAS (Step 2.1) or backend not on HTTPS |
| No push notifications on Android | `google-services.json` missing or FCM key not uploaded (Step 2.2) |
| Apple: "Missing Compliance" warning | Add `usesNonExemptEncryption: false` (Step 2.3) or answer "None of the algorithms mentioned" in TestFlight |
| Apple rejection 2.1 "could not sign in" | Demo account wrong / server down / location check blocking reviewer |
| Apple rejection 4.2 / 3.2 "internal app" | Request Unlisted distribution (Step 3) |
| Google: "Apply for production access" button | Personal account → finish the 12-tester / 14-day closed test |
| EAS build failed | Open the build on expo.dev → read the red log section; run `npx expo-doctor` |

## Useful links
- Expo build docs: https://docs.expo.dev/build/setup/
- Expo submit (iOS): https://docs.expo.dev/submit/ios/
- Expo submit (Android): https://docs.expo.dev/submit/android/
- Expo environment variables: https://docs.expo.dev/eas/environment-variables/
- App Store Connect help: https://developer.apple.com/help/app-store-connect/
- Play Console help: https://support.google.com/googleplay/android-developer/
