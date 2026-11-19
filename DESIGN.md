# Rudhram CRM — Design System (mobile)

Read this before building or changing any screen. Brand source: *Rudhram Brand Draft* (Trishul mark,
4 colours, Golden Book). Layout source: the soft, card-based task/statistics app reference (big titles,
pill chips, rounded cards, stat tiles, floating pill tab bar).

The feel: **warm paper, dark ink, ochre for the one thing that matters.** It's a calm work tool.
It should not look like a template, and it should not be flashy.

---

## 1. Colour

### Brand palette (from the kit, never change)

| Token | Hex | Name | Use |
|---|---|---|---|
| `ochre` | `#b47737` | Rudhram Ochre | accent: active chip, progress, selected tab icon, key numbers, logo |
| `beige` | `#f6f1e0` | Warm Beige | app background (light) |
| `brown` | `#3b2515` | Sacred Brown | ink, primary buttons, dark tiles, tab bar |
| `sand` | `#dcc19d` | Desert Sand | soft fills: inactive chips, tags, progress track, dividers on dark |

### Derived tokens (for contrast only; all checked against WCAG AA)

| Token | Light | Dark | Why |
|---|---|---|---|
| `bg` | `#f6f1e0` beige | `#1c120b` | screen background |
| `surface` | `#fffcf3` | `#2a1a0f` | cards and sheets: a little lighter than bg |
| `surface-2` | `#efe6d0` | `#3b2515` brown | nested fills, input background |
| `ink` | `#3b2515` brown | `#f6f1e0` beige | headings, body (12.7 : 1) |
| `muted` | `#7a6552` | `#a8957f` | secondary text (4.9 / 6.4 : 1) |
| `line` | `#e3d6bb` | `#3d2a1c` | hairlines, card borders |
| `accent` | `#b47737` ochre | `#c98d4e` | fills, icons, large numbers only |
| `accent-ink` | `#8a5524` | `#d29a5e` | ochre **text** at body size (5.5 / 7.5 : 1) |
| `danger` | `#b3412e` | `#e07a63` | overdue, errors, destructive |
| `success` | `#456b33` | `#8fb878` | done, present, paid |
| `warning` | `#b47737` ochre | `#c98d4e` | pending (warnings use the brand colour) |

**Rules**
- Ochre on beige is 3.3 : 1. Use it for icons, fills, and text ≥ 18 px bold. For smaller ochre text, use `accent-ink`.
- White on ochre is 3.7 : 1, so ochre-filled buttons are not allowed. The **primary button is brown with beige text** (12.7 : 1).
- Status tints are the colour at 12 % on `surface`, e.g. a danger tile is `bg-danger/10`, with the text in full `danger`.
- No other hues. No violet, blue, or grey-blue. Charts use ochre, brown, sand, and the `muted` tone, plus danger/success where meaning needs it.
- Dark mode follows the system (`media`). Every component needs both. Check both before shipping.

## 2. Grain

The kit is printed on textured paper, and the app carries the same feel lightly.
- Put **one** tiled noise PNG (`assets/images/grain.png`, 128×128, monochrome) on the screen background only, via `<Grain />` (in `Screen.jsx`) at 7 % opacity in light and 5 % in dark (the tile is already half-transparent), `pointerEvents="none"`.
- **Never** put grain on cards, inputs, lists, or anything that scrolls under text. Cards stay clean, so content reads crisply on top of the "paper".
- Brand moments can use the **Trishul** as a big, low-contrast watermark: splash, sign-in header, empty states, the dark highlight tile. Use sand on beige, or brown-lighter on brown, at 6–10 % — the same treatment the kit uses on the ID card and letterhead.
- Accent rule (from the kit's invoice and box): a thin ochre hairline with a small diamond in the middle, used to separate a hero from content. Use it at most once per screen.

## 3. Typography

| Role | Font | Size / line | Use |
|---|---|---|---|
| Display | **Goldenbook Bold** | 34/40 | screen titles ("Tasks", "Statistics") |
| Title | Goldenbook Regular | 24/30 | card hero numbers, section titles, sheet titles |
| Numeral XL | Goldenbook Bold | 40/44 | stat tile numbers, timers |
| Headline | Manrope SemiBold | 17/24 | card titles, list primary |
| Body | Manrope Regular | 15/22 | descriptions, inputs |
| Label | Manrope Medium | 13/18 | chips, meta, button text (15 for buttons) |
| Caption | Manrope Medium | 11/14, +0.4 tracking, UPPERCASE | overline ("DEADLINE", "PRIORITY") |

- **Goldenbook** is the brand face. It's licensed (Mark Simonson), so its `.otf` files are in `assets/fonts/` (Regular, Bold) and load via `useFonts` in `src/app/_layout.jsx`. Tailwind: `font-display` = Bold, `font-display-regular` = Regular.
- Goldenbook has **no ₹ glyph**. Set the rupee sign in Manrope next to Goldenbook digits (see `StatTile`), never inside a Goldenbook run.
- Goldenbook is for display only: titles and numbers. Never use it for body text, inputs, or anything under 20 px.
- **Manrope** is the UI sans. The kit doesn't name a body face, and Manrope's warm, open forms sit well next to Goldenbook.
- Keep 2 weights per screen at most, besides display. Don't use all caps except for captions. Use `tabular-nums` for times and money.
- Respect Dynamic Type. Don't set `allowFontScaling={false}`. Layouts must survive 130 % text.

## 4. Shape, spacing, elevation

**Radius**
| Token | Value | Use |
|---|---|---|
| `rounded-full` | pill | buttons, chips, segmented control, tab bar, avatars, tags, progress |
| `rounded-3xl` | 24 | cards, stat tiles, sheets (top corners), images |
| `rounded-2xl` | 16 | inputs, list groups, inner panels in a card |
| `rounded-xl` | 12 | small icon tiles, OTP boxes |

Nested radius = outer radius − padding (a 24 card with 8 padding has a 16 inner).

**Spacing** (4-pt grid)
- Screen gutter: 20.
- Card padding: 16–20.
- Gap between cards: 12.
- Between sections: 28.
- Title to content: 16.

**Touch targets**
- Minimum 44 × 44. Chips are 36 tall plus `hitSlop` 8.
- Primary buttons are 52 tall and full width at the bottom of forms.

**Elevation**
- Use almost none. Cards separate by `surface` on `bg` with a 1 px `line` border in light; in dark, by surface tone alone.
- One soft shadow is allowed, on the **floating tab bar and FAB only**: `shadow-black/15, y 8, blur 24`.

## 5. Layout patterns

### Screen anatomy

```
[ status bar ]
Large title (Display)                 [icon btn ○]   ← 20 gutter, title left, 1–2 round icon buttons right
Meta row: Sort ▾ · Assignee ▾ · 📅 range           ← Label, muted, tappable
( All ) ( To do ) ( In progress ) ( Done )         ← pill segmented chips, horizontal scroll
cards …
                                    ( floating tab bar )
```

- **One primary action per screen.** It's either the FAB/tab-bar "+" or the bottom button, never both.
- Lists use `FlatList`/`FlashList` with pull-to-refresh (ochre tint), skeletons on the first load, and an empty state (Trishul watermark, one line, one action).
- Keep content clear of the tab bar: add `paddingBottom = tabBarHeight + 16`.

### Chips / segmented control
- Inactive: `surface-2` fill, `ink` text.
- Active: **brown fill, beige text** (dark mode: beige fill, brown text). A count badge goes inside the chip as a small pill.
- The selection moves with a shared-layout slide (200 ms) plus `Haptics.selectionAsync()`.

### Task / record card (`rounded-3xl`, surface, 16–20 padding)
- Title (Headline) + a ⋯ menu.
- Description (Body, muted, 2 lines max).
- Meta row: `Deadline` caption above a date, and `Priority` caption above a **tag pill** (tinted fill plus a 6 px dot: High = danger, Medium = ochre, Low = success).
- Footer: an avatar stack (24 px, -8 overlap, +N pill) on the left, and a progress bar (6 px, sand track, ochre fill) with a `%` on the right.
- The whole card is the press target. Swipe actions are optional (complete = success, delete = danger, with a confirm step).

### Stat tiles (dashboards, 2-column grid, gap 12)
- Normal tile: surface. Caption label at top-left, a small tag pill at top-right ("This week"), a **Numeral XL** number, and a muted sub-line.
- Alert tile (overdue, unpaid): `danger/10` fill, danger number.
- Highlight tile (one per screen at most): **brown fill**, beige text, ochre accent, faint Trishul watermark. Use it for "time logged today", "net pay", etc. Units are small: `7`h `25`m.
- Gauge card: a tick-mark semicircle (ochre ticks filled up to the %, sand for the rest), with the % centred in Numeral XL.
- Bar chart: past bars sand with diagonal hatching, the current period solid ochre, selected bar brown with a value bubble. Keep axes minimal and use no gridlines. Tap a bar to see its value.

### Floating tab bar
- A pill (`rounded-full`) **brown** bar, 64 tall, inset 20 from the sides and 12 above the safe area, with the soft shadow.
- 4–5 icons in beige at 60 %. The **active tab is a beige circle with a brown icon**, and it slides between tabs (spring).
- No labels on the bar. Give each tab an `accessibilityLabel`. A long-press shows a label tooltip.

### Forms
- Labels sit above inputs (Label, ink). Inputs are 52 tall, `rounded-2xl`, on `surface-2`. On focus they get a 1.5 px ochre border.
- Show errors inline under the field in danger, with an icon. Validate on blur, not on every key.
- The primary button is pinned above the keyboard (`automaticallyAdjustKeyboardInsets`) and disabled until the form is valid.
- Use the right `keyboardType`, `autoComplete` and `textContentType` on every field, and set `returnKeyType` to "next" to chain fields.

### Sheets & dialogs
- Use bottom sheets for filters, pickers, and quick-create: `rounded-t-3xl`, a grab handle, and drag to dismiss.
- Use a centred alert only for destructive confirmations. The destructive button is danger text, placed on the right.

### Onboarding / auth
- Use a **brown** full-screen hero with the Trishul and wordmark in ochre, a light grain, and a short Goldenbook title in beige.
- The CTA is a **beige pill on brown**. Show pagination dots: active = ochre pill (20 px), others = sand dots.

## 6. Motion

Library: **react-native-reanimated 4**. Animations run on the UI thread and must feel quick and soft.

| Moment | Spec |
|---|---|
| Press (every pressable) | `active:scale-[0.97]` + opacity 0.9 (NativeWind `active:`), instant |
| Screen push | native stack default (don't fight the platform) |
| List / card enter | `FadeInDown.springify().damping(18)`, stagger 40 ms, first 8 items only |
| Chip / tab indicator | `withSpring({ damping: 18, stiffness: 220 })` slide |
| Number change (stats, timer) | count-up over 600 ms, `Easing.out(Easing.cubic)` |
| Progress / gauge | fill from 0 over 700 ms on first view |
| Sheet | spring open, 220 ms timing close |
| Success | check-mark scale-in 1 → 1.15 → 1 + success haptic |
| Skeleton | opacity pulse 0.5 ↔ 1, 900 ms |

- Respect **Reduce Motion**: use `useReducedMotion()`. Turn enters, count-ups and pulses into plain fades or instant changes.
- Most durations fall between 150 and 350 ms. Never block input while something animates.
- **NativeWind pitfall** (seen on device): never put `className` on an `Animated.*` or `createAnimatedComponent` view. Put the animated `style` on a wrapper `Animated.View`, and style the plain RN child with `className`.

## 7. Haptics (`expo-haptics`)

| Event | Call |
|---|---|
| Any button / card / row press | `selectionAsync()` (built into `<Pressable>`) |
| Chip, tab, segmented, picker change | `selectionAsync()` |
| Toggle, check a task, pull-to-refresh trigger | `impactAsync(Light)` |
| Long-press, drag start, swipe action reveal | `impactAsync(Medium)` |
| Save / submit success, clock-in done | `notificationAsync(Success)` |
| Validation or server error | `notificationAsync(Error)` |
| Destructive confirm shown | `notificationAsync(Warning)` |

- Haptics go **with** something you can see, never on their own. Don't play haptics for scrolling or for every keystroke.
- On web, `expo-haptics` is a no-op, which is fine.

## 8. UX rules

- **Say what happened.** Every mutation shows a toast or inline state. Wording is plain: "Task completed", "Couldn't save. Check your connection."
- Optimistic UI for toggles and checks. Roll back with an error haptic and a toast on failure.
- Every list has loading (skeleton), empty (watermark plus an action), error (retry), and offline states.
- Dates are relative when near ("Today, 4:30 PM", "Tomorrow"). Money uses `₹` with Indian grouping (`1,23,456`).
- Destructive actions need a confirm or an undo toast (5 s). Prefer undo.
- Follow platform conventions: back swipe on iOS, the hardware back button on Android, and a safe area everywhere.
- Accessibility: every icon-only button has an `accessibilityLabel`, and focus order matches visual order. Never use colour as the only signal (a priority dot comes with a word).

## 9. Implementation map

- Tokens live in `tailwind.config.js` (`colors`, `fontFamily`, `borderRadius`). Components use **tokens only**, never raw hex.
- Shared components live in `src/components/` (Button, Pressable, Card, Input, Chip, StatTile, TabBar, Sheet, Skeleton, EmptyState). Build a new screen from these first, and add a component only when two screens need it.
- `<Pressable>` already does scale plus a selection haptic. Pass `haptic={false}` only for rows inside a scroll where a haptic would be noise.
- Before a screen is "done", check that:
  - light and dark both look right
  - it works at 130 % text
  - it works with Reduce Motion on
  - the empty, loading and error states are shown
  - every target is at least 44 px
  - `npx expo lint` passes
