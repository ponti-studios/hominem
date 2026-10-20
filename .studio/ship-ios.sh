#!/usr/bin/env bash
# The studio's one way to ship an Apple app to TestFlight. Sourced by a repo's own ship script, which
# sets SHIP_NAME and defines the hooks below, then calls `ship_ios "$@"`:
#
#   ship_build     (required) Build the release artifact. Set SHIP_VERSION, SHIP_BUILD and SHIP_ARTIFACT.
#   ship_audit     (optional) Fail if the artifact holds something it must not (a provider key, say).
#   ship_symbols   (optional) Upload crash symbols and source maps (see the ship_newrelic_* helpers).
#   ship_upload    (required) Send the artifact to App Store Connect.
#   ship_check     (optional) What must pass before building. Default: `just check`.
#
# The stages are always the same, in this order: preflight, check, build, audit, symbols, upload,
# report. It never stops to ask: asking for a release is the confirmation. A failed symbol upload is a
# warning (the build still ships); everything else stops the run.
#
# Flags: --skip-checks  skip ship_check
#        --no-upload    stop after symbols (a dry run that leaves the artifact on disk)
#        --allow-branch build something other than origin/main (a hotfix or a trial; say why in the PR)
# Needs: lib.sh (note, ok, warn, fail) sourced first.

SHIP_SKIP_CHECKS=0
SHIP_UPLOAD=1
SHIP_ALLOW_BRANCH="${SHIP_ALLOW_BRANCH:-0}"
SHIP_VERSION="${SHIP_VERSION:-}"
SHIP_BUILD="${SHIP_BUILD:-}"
SHIP_ARTIFACT="${SHIP_ARTIFACT:-}"

# ---- helpers any hook can use -------------------------------------------------------------------

# The value of KEY in an env file (no export, no quotes, no spaces). Empty when absent.
ship_envfile_value() {
  [[ -f "$1" ]] || return 0
  sed -n "s/^$2=//p" "$1" | tail -1 | tr -d "\"'[:space:]"
}

# The value of KEY in ~/.localrc, read as text (the file is never sourced). Empty when absent.
ship_localrc_value() {
  [[ -f "$HOME/.localrc" ]] || return 0
  sed -n "s/^[[:space:]]*\(export[[:space:]]\{1,\}\)\{0,1\}$1=//p" "$HOME/.localrc" | tail -1 | tr -d "\"'[:space:]"
}

# The New Relic User API key for source-map uploads: $NEWRELIC_USER_API_KEY, else the env file
# ($1, optional), else NEW_RELIC_USER_API_KEY in ~/.localrc. It must start with NRAK-. An ingest license
# key (ends NRAL) makes the endpoint redirect to the login page, and the upload tool then prints a
# misleading "413 too large". Prints the key, or nothing (with a warning) when there is none.
ship_newrelic_user_key() {
  local key="${NEWRELIC_USER_API_KEY:-}"
  [[ -n "$key" ]] || key="$(ship_envfile_value "${1:-/dev/null}" NEWRELIC_USER_API_KEY)"
  [[ -n "$key" ]] || key="$(ship_localrc_value NEW_RELIC_USER_API_KEY)"
  if [[ -n "$key" && "$key" != NRAK-* ]]; then
    warn 'The New Relic key is not a User API key (it should start with NRAK-); not using it.'
    return 0
  fi
  printf '%s' "$key"
}

# Uploads an iOS app's dSYMs to New Relic. Args: app token, dSYM folder, marketing version, log folder,
# folder holding run-symbol-tool.swift (the newrelic-react-native-agent package ships it). A failure warns.
ship_newrelic_upload_dsyms() {
  local token="$1" dsyms="$2" version="$3" logs="$4" tools="$5"
  [[ -n "$token" && -d "$tools" ]] || { warn 'New Relic dSYMs not uploaded: no app token, or the agent package is not installed.'; return 0; }
  note 'Uploading debug symbols to New Relic'
  (cd "$logs" && DWARF_DSYM_FOLDER_PATH="$dsyms" EFFECTIVE_PLATFORM_NAME=-iphoneos MARKETING_VERSION="$version" \
    /usr/bin/xcrun --sdk macosx swift "$tools/run-symbol-tool.swift" "$token") >"$logs/newrelic-dsym.log" 2>&1 \
    || { tail -15 "$logs/newrelic-dsym.log" >&2; warn "The New Relic dSYM upload failed; crashes will not be readable. Log: $logs/newrelic-dsym.log"; }
}

# Uploads a React Native source map to New Relic. Args: user key, app token, source map file, folder
# holding the archived .app's parent (BUILT_PRODUCTS_DIR), Info.plist path inside it, log folder, tools folder.
ship_newrelic_upload_sourcemap() {
  local key="$1" token="$2" map="$3" products="$4" plist="$5" logs="$6" tools="$7"
  if [[ -z "$key" || -z "$token" || ! -f "$map" || ! -d "$tools" ]]; then
    warn 'New Relic source map not uploaded: it needs a User API key (NRAK-), the app token and the map.'
    return 0
  fi
  note 'Uploading the JavaScript source map to New Relic'
  (cd "$logs" && CONFIGURATION=Release EFFECTIVE_PLATFORM_NAME=-iphoneos SOURCEMAP_PATH="$map" \
    BUILT_PRODUCTS_DIR="$products" INFOPLIST_PATH="$plist" \
    /usr/bin/xcrun --sdk macosx swift "$tools/upload-react-native-sourcemap.swift" "$key" "$token") >"$logs/newrelic-maps.log" 2>&1 \
    || { tail -15 "$logs/newrelic-maps.log" >&2; warn "The New Relic source map upload failed; JavaScript crashes will not be readable. Log: $logs/newrelic-maps.log"; }
}

# ---- the stages ---------------------------------------------------------------------------------

ship_preflight() {
  local root="${SHIP_ROOT:?SHIP_ROOT is not set}"
  note "Preflight: $SHIP_NAME"
  git -C "$root" diff --quiet HEAD -- || {
    git -C "$root" status --short --untracked-files=no >&2
    fail 'There are uncommitted changes to tracked files. A release is built from a commit.'
  }
  if ((SHIP_ALLOW_BRANCH)); then
    warn "Building $(git -C "$root" rev-parse --short HEAD) without requiring origin/main (--allow-branch)."
    return 0
  fi
  git -C "$root" fetch -q origin main || fail 'Could not fetch origin/main.'
  [[ "$(git -C "$root" rev-parse HEAD)" == "$(git -C "$root" rev-parse origin/main)" ]] \
    || fail "HEAD is not origin/main. Merge first and update (git checkout --detach origin/main in a worktree), or pass --allow-branch."
  ok "clean, at origin/main ($(git -C "$root" rev-parse --short HEAD))"
}

ship_ios() {
  while (($#)); do
    case "$1" in
      --skip-checks) SHIP_SKIP_CHECKS=1 ;;
      --no-upload) SHIP_UPLOAD=0 ;;
      --allow-branch) SHIP_ALLOW_BRANCH=1 ;;
      -h | --help)
        sed -n '2,19p' "${BASH_SOURCE[0]}"
        return 0
        ;;
      *) fail "Unknown option: $1" ;;
    esac
    shift
  done
  : "${SHIP_NAME:?SHIP_NAME is not set}"
  declare -F ship_build >/dev/null || fail 'The repo must define ship_build.'
  declare -F ship_upload >/dev/null || fail 'The repo must define ship_upload.'

  ship_preflight
  if ((!SHIP_SKIP_CHECKS)); then
    note 'Checks'
    if declare -F ship_check >/dev/null; then ship_check; else (cd "$SHIP_ROOT" && just check); fi
  fi
  note "Building $SHIP_NAME"
  ship_build
  [[ -n "$SHIP_ARTIFACT" ]] || fail 'ship_build did not set SHIP_ARTIFACT.'
  if declare -F ship_audit >/dev/null; then
    note 'Audit'
    ship_audit
  fi
  if declare -F ship_symbols >/dev/null; then ship_symbols; fi
  if ((SHIP_UPLOAD)); then
    note 'Uploading to App Store Connect'
    ship_upload
  fi

  local commit
  commit="$(git -C "$SHIP_ROOT" rev-parse --short HEAD)"
  note "$SHIP_NAME ${SHIP_VERSION:-?} (${SHIP_BUILD:-?}) from $commit"
  printf '  artifact  %s\n' "$SHIP_ARTIFACT"
  if ((SHIP_UPLOAD)); then
    printf '  Uploaded. Apple is still processing it (a few minutes); it is not in TestFlight until App Store Connect shows it.\n'
  else
    printf '  Not uploaded (--no-upload).\n'
  fi
}
