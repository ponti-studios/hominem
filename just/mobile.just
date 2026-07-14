OMIRO_DIR := justfile_directory() / 'apps' / 'omiro'
OMIRO_RUNTIME_VERSION := 'ios-r1'

dev:
    cd "{{ OMIRO_DIR }}" && APP_ENV=development OMIRO_DEV_CLIENT=true pnpm exec expo run:ios

start:
    cd "{{ OMIRO_DIR }}" && pnpm exec expo start --ios

e2e:
    cd "{{ OMIRO_DIR }}" && APP_ENV=development EXPO_PUBLIC_E2E_TESTING=true OMIRO_DEV_CLIENT=false pnpm exec expo run:ios

lint:
    cd "{{ OMIRO_DIR }}" && pnpm exec expo lint

test:
    cd "{{ OMIRO_DIR }}" && pnpm exec vitest run --config vitest.config.ts

test-watch:
    cd "{{ OMIRO_DIR }}" && pnpm exec vitest --config vitest.config.ts

prebuild environment:
    #!/usr/bin/env bash
    case "{{ environment }}" in
      development) cd "{{ OMIRO_DIR }}" && APP_ENV=development OMIRO_DEV_CLIENT=true pnpm exec expo prebuild --platform ios --clean ;;
      production) cd "{{ OMIRO_DIR }}" && APP_ENV=production OMIRO_RELEASE_CHANNEL=production EXPO_RUNTIME_VERSION="{{ OMIRO_RUNTIME_VERSION }}" pnpm exec expo prebuild --platform ios --clean ;;
      *) echo "error: unknown mobile prebuild environment '{{ environment }}'" >&2; exit 1 ;;
    esac

build environment:
    #!/usr/bin/env bash
    case "{{ environment }}" in
      staging|production) cd "{{ OMIRO_DIR }}" && EXPO_RUNTIME_VERSION="{{ OMIRO_RUNTIME_VERSION }}" pnpm exec eas build --platform ios --profile "{{ environment }}" ;;
      *) echo "error: unknown mobile build environment '{{ environment }}'" >&2; exit 1 ;;
    esac

update environment:
    #!/usr/bin/env bash
    case "{{ environment }}" in
      staging|production) cd "{{ OMIRO_DIR }}" && APP_ENV=production OMIRO_RELEASE_CHANNEL="{{ environment }}" EXPO_RUNTIME_VERSION="{{ OMIRO_RUNTIME_VERSION }}" pnpm exec eas update --channel "{{ environment }}" ;;
      *) echo "error: unknown mobile update environment '{{ environment }}'" >&2; exit 1 ;;
    esac

release environment:
    #!/usr/bin/env bash
    [[ "{{ environment }}" == production ]] || { echo "error: only production mobile releases are supported" >&2; exit 1; }
    cd "{{ OMIRO_DIR }}"
    APP_ENV=production OMIRO_RELEASE_CHANNEL=production EXPO_RUNTIME_VERSION="{{ OMIRO_RUNTIME_VERSION }}" pnpm exec expo prebuild --platform ios --clean --no-install
    APP_ENV=production OMIRO_RELEASE_CHANNEL=production EXPO_RUNTIME_VERSION="{{ OMIRO_RUNTIME_VERSION }}" pnpm exec eas build --platform ios --profile production --auto-submit --non-interactive
