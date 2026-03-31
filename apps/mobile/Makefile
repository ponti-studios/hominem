SHELL := /bin/bash

ROOT_MAKE := $(MAKE) -C ../..

.PHONY: help dev lint format test typecheck
.PHONY: e2e-build e2e-smoke e2e-smoke-ci
.PHONY: check-config check-config-preview check-config-production check-profiles
.PHONY: verify-eas-preview verify-eas-production rc rc-smoke release
.PHONY: ota-publish-preview release-build-production release-submit-production

help:
	@echo ""
	@echo "Mobile wrappers:"
	@echo "  make dev | lint | format | test | typecheck"
	@echo "  make e2e-build | e2e-smoke | e2e-smoke-ci"
	@echo "  make check-config | check-config-preview | check-config-production | check-profiles"
	@echo "  make verify-eas-preview | verify-eas-production | rc | rc-smoke | release"
	@echo "  make ota-publish-preview | release-build-production | release-submit-production"
	@echo ""
	@echo "Canonical commands live at the repo root:"
	@echo "  make -C ../.. mobile.dev | mobile.test | mobile.e2e.build | mobile.rc | mobile.rc.smoke | mobile.release"

dev:
	$(ROOT_MAKE) mobile.dev

lint:
	$(ROOT_MAKE) mobile.lint

format:
	$(ROOT_MAKE) mobile.format

test:
	$(ROOT_MAKE) mobile.test

typecheck:
	$(ROOT_MAKE) mobile.typecheck

e2e-build:
	$(ROOT_MAKE) mobile.e2e.build

e2e-smoke:
	$(ROOT_MAKE) mobile.e2e.smoke

e2e-smoke-ci:
	$(ROOT_MAKE) mobile.e2e.smoke.ci

check-config:
	$(ROOT_MAKE) mobile.check-config

check-config-preview:
	$(ROOT_MAKE) mobile.check-config.preview

check-config-production:
	$(ROOT_MAKE) mobile.check-config.production

check-profiles:
	$(ROOT_MAKE) mobile.check-profiles

verify-eas-preview:
	$(ROOT_MAKE) mobile.ota.verify.preview

verify-eas-production:
	$(ROOT_MAKE) mobile.ota.verify.production

rc:
	$(ROOT_MAKE) mobile.rc

rc-smoke:
	$(ROOT_MAKE) mobile.rc.smoke

release:
	$(ROOT_MAKE) mobile.release

ota-publish-preview:
	$(ROOT_MAKE) mobile.ota.publish.preview

release-build-production:
	$(ROOT_MAKE) mobile.release.build.production

release-submit-production:
	$(ROOT_MAKE) mobile.release.submit.production
