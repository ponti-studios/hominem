.PHONY: help dev verify verify-dev verify-e2e verify-preview verify-production build build-e2e build-preview build-production test test-unit test-integration test-e2e lint format typecheck

# ── DEFAULT ────────────────────────────────────────────────────────────────

.DEFAULT_GOAL := help

help:
	@echo ""
	@echo "📱 Mobile App - Scripts & Development"
	@echo ""
	@echo "Development:"
	@echo "  make dev                    Run dev server with verification"
	@echo ""
	@echo "Verification:"
	@echo "  make verify-dev             Verify dev configuration"
	@echo "  make verify-e2e             Verify e2e configuration"
	@echo "  make verify-preview         Verify preview configuration (requires EAS)"
	@echo "  make verify-production      Verify production configuration (requires EAS)"
	@echo ""
	@echo "Building:"
	@echo "  make build-e2e              Build e2e test app"
	@echo "  make build-preview          Build preview release"
	@echo "  make build-production       Build production release"
	@echo ""
	@echo "Testing:"
	@echo "  make test                   Run all tests (unit + integration)"
	@echo "  make test-unit              Run unit tests only"
	@echo "  make test-integration       Run integration tests only"
	@echo "  make test-e2e               Run e2e tests (requires build-e2e first)"
	@echo ""
	@echo "Quality:"
	@echo "  make lint                   Run linter & checks"
	@echo "  make format                 Format code"
	@echo "  make typecheck              TypeScript type checking"
	@echo ""
	@echo "See SCRIPTS.md for detailed documentation"
	@echo ""

# ── DEVELOPMENT ────────────────────────────────────────────────────────────

dev:
	bun run dev

dev-select:
	bun run dev:select

dev-sim:
	bun run dev:sim

dev-device:
	bun run dev:device

# ── VERIFICATION ────────────────────────────────────────────────────────────

verify-dev:
	bun run verify:dev

verify-e2e:
	bun run verify:e2e

verify-preview:
	bun run verify:preview

verify-production:
	bun run verify:production

# ── BUILDING ────────────────────────────────────────────────────────────────

build-e2e:
	bun run build:e2e

build-preview:
	bun run build:preview

build-production:
	bun run build:production

# ── TESTING ────────────────────────────────────────────────────────────────

test:
	bun run test

test-unit:
	bun run test:unit:auth

test-integration:
	bun run test:integration:auth

test-e2e:
	bun run test:e2e

test-e2e-deep-links:
	bun run test:e2e:deep-links

test-e2e-smoke:
	bun run test:e2e:smoke

# ── QUALITY ────────────────────────────────────────────────────────────────

lint:
	bun run lint

format:
	bun run format

typecheck:
	bun run typecheck

# ── COMMON WORKFLOWS ───────────────────────────────────────────────────────

# Pre-commit verification
precommit: format lint typecheck test verify-dev
	@echo "✅ Ready to commit!"

# Full verification before PR
pr: format lint typecheck test verify-dev verify-e2e build-e2e test-e2e
	@echo "✅ All checks passed!"

# Web development
web:
	bun run web

# Android development
android:
	bun run android
