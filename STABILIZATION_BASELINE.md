# Crea Glass stabilization baseline

Baseline prepared on 2026-09-14 from commit `6ece654` on branch
`codex/stabilization-baseline`.

## Supported local runtime

- Node.js `20.x`; local baseline `20.19.4` (see `.nvmrc`)
- npm `10.9.3` (see `packageManager` in `package.json`)
- Expo SDK `54`

The machine currently defaults to Node.js 25. Do not use that runtime for this
project. Select the version from `.nvmrc` before installing dependencies or
starting Expo.

The Vercel project currently displays Node.js 24.x in its dashboard, but the
`20.x` engine declared in `package.json` deliberately overrides that selection
for new deployments so the web build uses the same supported Node major as the
Expo baseline.

## Repeatable checks

```bash
npm ci
npm run validate
npm run doctor
npx expo export --platform web --output-dir /tmp/crea-glass-web
npx expo export --platform android --output-dir /tmp/crea-glass-android
npx expo export --platform ios --output-dir /tmp/crea-glass-ios
```

Current results:

- TypeScript: passes with no errors.
- ESLint: passes with no errors; 141 pre-existing warnings remain.
- Expo web startup: Metro starts, the login screen renders, and localhost
  responds successfully.
- Metro production exports: web, Android, and iOS pass.
- Expo Doctor: 17 of 18 checks pass. The remaining warning is intentional:
  `@expo/config-plugins` is a direct dependency required by the current
  `@react-native-community/datetimepicker` config plugin. Removing it makes the
  Expo configuration fail.

## Production safety boundaries

This baseline does not deploy, migrate, or otherwise modify the live Supabase
project. It also does not publish an OTA update or submit a native build.

The `create-master-user` Edge Function was hardened in source to require an
authenticated, active Master caller. The production function remains unchanged
until that function is deliberately deployed and tested. Credentials removed
from the current README still exist in Git history; rotate any matching live
credential before relying on this repository as a secure source.

## Live web and Vercel verification

Checked on 2026-09-14:

- `creaglass.online` and `www.creaglass.online` did not resolve in DNS.
- The configured production domain is `www.creasolutions.online`; it rendered
  the authenticated Production screen and the Documents, Events, and Inventory
  tabs loaded successfully without rendering or data-fetch failures.
- The deployed app has no VAPID public key configured for background Web Push.
  Its AuthGuard also emitted a false 10-second timeout even though the background
  profile refresh had already completed successfully; the uncleared timeout was
  fixed in this baseline.
- The live browser repeatedly failed to subscribe to Supabase Realtime. The
  Supabase dashboard reported 1,191 Realtime errors out of 1,262 Realtime
  requests in the preceding 24 hours. The project permits public channels and
  has no `realtime.messages` policies, but the app configured all main channels
  as private. This baseline aligns those subscriptions with the project's public
  channel configuration and cleans up the web notification channel and Service
  Worker listener on unmount. A temporary read-only subscription test reached
  `SUBSCRIBED`; the fix still needs confirmation on the Vercel Preview and on
  physical-device preview builds.
- Vercel project `new-crea-glass` currently tracks `main` for production. The
  live production deployment, however, was built from branch `Vercel-Export`,
  commit `6ece654`.
- Local branches `main` and `Vercel-Export` have unrelated Git histories. Do not
  merge or force-push this stabilization directly to `main`. First push
  `codex/stabilization-baseline` as a Preview, validate that deployment, then
  deliberately align the Vercel production branch with the production lineage
  before promotion.

## Remaining release gates

Before shipping app changes to production:

1. Deploy and verify the hardened `create-master-user` function in a controlled
   window.
2. Produce EAS preview builds for Android and iOS.
3. Smoke-test login, permissions, user creation, point/time entry, production,
   work orders, inventory, notifications, documents, and offline/reconnect flows
   on representative physical devices.
4. Compare the 58 local migrations with the live Supabase migration history;
   do not apply migrations automatically.
5. Add automated tests for the critical operational flows before broad feature
   work.

The Supabase implementation of `changeUserPassword` is currently an explicit
placeholder that always fails. Treat password administration as a known missing
flow until it is implemented through an authenticated Edge Function and tested.

## Known dependency debt

`npm audit` currently reports 42 findings (including two critical findings)
across the complete dependency tree. Most are transitive Expo/Metro/build-tool
dependencies, and clearing all of them would require a breaking Expo SDK upgrade.
No forced audit fix was applied. Dependency upgrades must be isolated, bundled,
and device-tested as a separate change.
