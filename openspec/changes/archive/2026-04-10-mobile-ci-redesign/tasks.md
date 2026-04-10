## 1. Create EAS configuration

- [x] 1.1 Create `apps/mobile/eas.json` with `development`, `preview`, and `production` build profiles
- [ ] 1.2 Verify `EXPO_TOKEN` secret exists in GitHub repo settings (ask user to confirm)

## 2. Update CI workflow

- [x] 2.1 Remove `eas-build` job from `pull_request` trigger in `mobile-checks.yml`
- [x] 2.2 Change `eas-build` job to only trigger on `push` to `main`
- [x] 2.3 Change EAS build profile from `preview` to `production`
- [x] 2.4 Add `eas submit --platform ios --latest` step after successful build
- [x] 2.5 Remove `eas-build` from `push` triggers that target `develop` branch (keep only `mobile-checks` on develop)
- [x] 2.6 Verify `eas-build` job runs after `mobile-checks` job on main (add `needs: mobile-checks` if needed)

## 3. Verify locally

- [ ] 3.1 Run `eas build --platform ios --profile production --dry-run` to validate eas.json configuration
- [ ] 3.2 Confirm `eas submit` would target correct Apple Team ID
