OMIRO_DIR := ROOT_DIR / "apps" / "omiro"
OMIRO_RUNTIME_VERSION := "ios-r1"

mobile-test:
    cd "{{ OMIRO_DIR }}" && pnpm exec vitest run --config vitest.config.ts

mobile-test-watch:
    cd "{{ OMIRO_DIR }}" && pnpm exec vitest --config vitest.config.ts

start-ios:
    cd "{{ OMIRO_DIR }}" && pnpm exec expo start --ios

mobile-prebuild-development:
    cd "{{ OMIRO_DIR }}" && APP_ENV="development" OMIRO_DEV_CLIENT="true" pnpm exec expo prebuild --platform ios --clean

mobile-prebuild-production runtime=OMIRO_RUNTIME_VERSION:
    cd "{{ OMIRO_DIR }}" && APP_ENV="production" OMIRO_RELEASE_CHANNEL="production" EXPO_RUNTIME_VERSION="{{ runtime }}" pnpm exec expo prebuild --platform ios --clean

mobile-dev:
    cd "{{ OMIRO_DIR }}" && APP_ENV="development" OMIRO_DEV_CLIENT="true" pnpm exec expo run:ios

mobile-e2e:
    cd "{{ OMIRO_DIR }}" && APP_ENV="development" EXPO_PUBLIC_E2E_TESTING="true" OMIRO_DEV_CLIENT="false" pnpm exec expo run:ios

mobile-build-staging runtime=OMIRO_RUNTIME_VERSION:
    cd "{{ OMIRO_DIR }}" && EXPO_RUNTIME_VERSION="{{ runtime }}" pnpm exec eas build --platform ios --profile staging

mobile-build-production runtime=OMIRO_RUNTIME_VERSION:
    cd "{{ OMIRO_DIR }}" && EXPO_RUNTIME_VERSION="{{ runtime }}" pnpm exec eas build --platform ios --profile production

mobile-update-staging runtime=OMIRO_RUNTIME_VERSION:
    cd "{{ OMIRO_DIR }}" && APP_ENV="production" OMIRO_RELEASE_CHANNEL="staging" EXPO_RUNTIME_VERSION="{{ runtime }}" pnpm exec eas update --channel staging

mobile-update-production runtime=OMIRO_RUNTIME_VERSION:
    cd "{{ OMIRO_DIR }}" && APP_ENV="production" OMIRO_RELEASE_CHANNEL="production" EXPO_RUNTIME_VERSION="{{ runtime }}" pnpm exec eas update --channel production

mobile-doctor:
    cd "{{ OMIRO_DIR }}" && npx --yes expo-doctor

mobile-lint:
    cd "{{ OMIRO_DIR }}" && pnpm exec expo lint
