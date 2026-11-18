# Rudhram CRM — mobile

Expo (SDK 58) + Expo Router + NativeWind app for the Rudhram CRM. Plan and module order: [PLAN.md](PLAN.md).

```bash
cp .env.example .env   # point EXPO_PUBLIC_API_URL at the CRM server (use your LAN IP for a real phone)
npm install
npx expo start         # needs a development build: native modules (push, location) are not in Expo Go
```

- Routes: `src/app/` · UI kit: `src/components/` · API services (copied from web): `src/services/`
- Dev build: `npx expo run:ios` (needs Xcode) / `npx expo run:android`, or `npx eas-cli@latest build --profile development`
