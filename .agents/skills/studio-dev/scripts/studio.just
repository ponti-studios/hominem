# Shared recipes, imported by each repo's justfile: import '.studio/studio.just'
# Canonical home: kernel/skills/studio-dev/scripts. Change it there, not in the repo that holds the copy.

# Which .studio set version this repo holds (see the studio-dev skill).
studio-version:
    @cat .studio/VERSION

# Assemble this repo's .studio/ from the kernel skills (needs the kernel checkout).
studio-update:
    "${KERNEL_REPO:-$HOME/Developer/kernel}/skills/studio-dev/scripts/install.sh" "{{ justfile_directory() }}"

# Fail when an installed file differs from its canonical version.
studio-check:
    "${KERNEL_REPO:-$HOME/Developer/kernel}/skills/studio-dev/scripts/install.sh" --check "{{ justfile_directory() }}"
