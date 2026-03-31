SHELL := /bin/bash

.PHONY: help build typecheck codegen goose-up goose-down goose-status goose-reset

help:
	@echo ""
	@echo "Database:"
	@echo "  make build | typecheck | codegen"
	@echo "  make goose-up | goose-down | goose-status | goose-reset"

build:
	bun run build

typecheck:
	bun run typecheck

codegen:
	bun run codegen

goose-up:
	bun run goose:up

goose-down:
	bun run goose:down

goose-status:
	bun run goose:status

goose-reset:
	bun run goose:reset
