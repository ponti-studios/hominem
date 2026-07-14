PROMPTFOO_DIR := justfile_directory() / 'experiments' / 'promptfoo'

mcp:
    cd "{{ justfile_directory() }}/services/api" && DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5434/app-test' pnpm exec tsx scripts/mcp-ollama-eval.ts

run config:
    cd "{{ PROMPTFOO_DIR }}" && npx promptfoo@latest eval -c "{{ config }}.config.yaml"

all:
    cd "{{ PROMPTFOO_DIR }}" && for config in chat-assistant task-extraction voice-task-extraction voice-cleanup; do npx promptfoo@latest eval -c "$config.config.yaml"; done

view:
    cd "{{ PROMPTFOO_DIR }}" && npx promptfoo@latest view
