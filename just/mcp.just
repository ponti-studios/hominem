install target:
    #!/usr/bin/env bash
    [[ "{{ target }}" == claude ]] || { echo "error: use just mcp install claude" >&2; exit 1; }
    cd "{{ justfile_directory() }}"
    claude plugin marketplace add ./plugins
    claude plugin install hominem-mcp@hominem-plugins --scope local
