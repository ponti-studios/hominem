LOCAL_LLM_EVAL_DIR := ROOT_DIR / "experiments" / "promptfoo"

local-llm-eval config:
    #!/usr/bin/env bash
    cd "{{ LOCAL_LLM_EVAL_DIR }}"
    if [ -z "${OPENROUTER_API_KEY:-}" ]; then
      echo "OPENROUTER_API_KEY must be set (needed for the OpenRouter baselines and the llm-rubric judge)"
      exit 1
    fi
    npx promptfoo@latest eval -c "{{ config }}.config.yaml"

local-llm-eval-all:
    #!/usr/bin/env bash
    cd "{{ LOCAL_LLM_EVAL_DIR }}"
    if [ -z "${OPENROUTER_API_KEY:-}" ]; then
      echo "OPENROUTER_API_KEY must be set (needed for the OpenRouter baselines and the llm-rubric judge)"
      exit 1
    fi
    for config in chat-assistant task-extraction voice-task-extraction voice-cleanup; do
      echo "=== $config ==="
      npx promptfoo@latest eval -c "$config.config.yaml"
    done

local-llm-view:
    cd "{{ LOCAL_LLM_EVAL_DIR }}" && npx promptfoo@latest view
