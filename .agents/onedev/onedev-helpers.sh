# Source this file in bash or zsh: . .agents/onedev/onedev-helpers.sh
# Needs curl and python3. REST calls read credentials from the environment:
#   ONEDEV_SERVER_URL   e.g. https://code.weexnes.dev
#   ONEDEV_USER         your OneDev login name
#   ONEDEV_ACCESS_TOKEN your access token

# REST call: od METHOD /path [curl args...]. The path omits the /~api prefix.
# Credentials go through a process substitution so they stay out of argv.
od() {
  local method="$1" api_path="$2"
  shift 2
  : "${ONEDEV_SERVER_URL:?set ONEDEV_SERVER_URL}" "${ONEDEV_USER:?set ONEDEV_USER}" "${ONEDEV_ACCESS_TOKEN:?set ONEDEV_ACCESS_TOKEN}"
  curl --fail-with-body -sS -X "$method" \
    --config <(printf 'user = "%s:%s"\n' "$ONEDEV_USER" "$ONEDEV_ACCESS_TOKEN") \
    "$ONEDEV_SERVER_URL/~api$api_path" "$@"
}

# Read one top-level field from JSON on stdin: tod build get 234 | od_field status
od_field() {
  python3 -I -c '
import json, sys
try:
    value = json.load(sys.stdin).get(sys.argv[1])
except ValueError:
    sys.exit(2)
print("" if value is None else value)' "$1"
}

# Numbers of all builds for a commit, in the current checkout's project: od_builds_for_commit [sha]
od_builds_for_commit() {
  local sha="${1:-$(git rev-parse HEAD)}"
  tod build list --count 100 --query "\"Commit\" is \"$sha\"" 2>/dev/null |
    python3 -I -c 'import json,sys; [print(b["number"], b["status"], b["jobName"]) for b in json.load(sys.stdin)]'
}

# Poll a build until it finishes: od_wait_build <number> [interval-sec] [timeout-sec]
# Exit status: 0 SUCCESSFUL, 1 FAILED/CANCELLED/TIMED_OUT, 2 lookup error, 3 gave up waiting.
od_wait_build() {
  # build_status, not status: status is read-only in zsh.
  local number="$1" interval="${2:-15}" timeout="${3:-3600}" waited=0 build_status
  while :; do
    build_status="$(tod build get "$number" | od_field status)" || return 2
    case "$build_status" in
      SUCCESSFUL) echo "#$number SUCCESSFUL"; return 0 ;;
      FAILED | CANCELLED | TIMED_OUT) echo "#$number $build_status"; return 1 ;;
      WAITING | PENDING | RUNNING) ;;
      *) echo "#$number unexpected status '$build_status'" >&2; return 2 ;;
    esac
    if [ "$waited" -ge "$timeout" ]; then
      echo "#$number still $build_status after ${waited}s" >&2
      return 3
    fi
    sleep "$interval"
    waited=$((waited + interval))
  done
}
