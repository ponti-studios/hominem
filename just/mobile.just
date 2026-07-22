OMIRO_DIR := justfile_directory() / 'apps' / 'omiro'
start:
    cd "{{ OMIRO_DIR }}" && pnpm exec expo start --ios

dev:
    cd "{{ ROOT_DIR }}/apps/omiro" && APP_ENV=development pnpm exec expo run:ios

e2e:
    cd "{{ OMIRO_DIR }}" && APP_ENV=e2e pnpm exec expo run:ios

lint:
    cd "{{ OMIRO_DIR }}" && pnpm exec expo lint

test:
    cd "{{ OMIRO_DIR }}" && pnpm exec vitest run --config vitest.config.ts

test-watch:
    cd "{{ OMIRO_DIR }}" && pnpm exec vitest --config vitest.config.ts

prebuild environment:
    #!/usr/bin/env bash
    case "{{ environment }}" in
      development) cd "{{ OMIRO_DIR }}" && APP_ENV=development pnpm exec expo prebuild --platform ios --clean ;;
      production) cd "{{ OMIRO_DIR }}" && APP_ENV=production pnpm exec expo prebuild --platform ios --clean ;;
      *) echo "error: unknown environment '{{ environment }}'" >&2; exit 1 ;;
    esac

build environment:
    #!/usr/bin/env bash
    case "{{ environment }}" in
      staging|production) cd "{{ OMIRO_DIR }}" && pnpm exec eas build --platform ios --profile "{{ environment }}" ;;
      *) echo "error: unknown environment '{{ environment }}'" >&2; exit 1 ;;
    esac

update environment:
    #!/usr/bin/env bash
    case "{{ environment }}" in
      staging|production) cd "{{ OMIRO_DIR }}" && APP_ENV="{{ environment }}" pnpm exec eas update --channel "{{ environment }}" ;;
      *) echo "error: unknown environment '{{ environment }}'" >&2; exit 1 ;;
    esac

release environment:
    #!/usr/bin/env bash
    [[ "{{ environment }}" == production ]] || { echo "error: only production mobile releases are supported" >&2; exit 1; }
    cd "{{ OMIRO_DIR }}"
    APP_ENV=production pnpm exec expo prebuild --platform ios --clean --no-install
    APP_ENV=production pnpm exec eas build --platform ios --profile production --auto-submit --non-interactive
