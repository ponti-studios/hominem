# Shared recipes, imported by each repo's justfile: import '.studio/studio.just'
# Vendored from studio-dev; change it there, not in the repo that holds the copy.

# Which studio-dev version this repo has copied.
studio-version:
    @cat .studio/VERSION

# Copy the newest studio-dev files into this repo (needs the studio-dev checkout).
studio-update:
    "${STUDIO_DEV:-$HOME/Developer/apps/studio-dev}/sync.sh" "{{ justfile_directory() }}"

# Fail when a vendored file differs from its pinned version.
studio-check:
    "${STUDIO_DEV:-$HOME/Developer/apps/studio-dev}/sync.sh" --check "{{ justfile_directory() }}"
