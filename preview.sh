#!/usr/bin/env sh
# Preview the site locally.
#
#   ./preview.sh                  Jekyll: the whole site as GitHub Pages builds it, with live reload
#   ./preview.sh --python         plain static files: the demos work; Jekyll pages show as raw source
#   ./preview.sh 4001             another port (default 4000)
#   ./preview.sh 4000 /foo        serve under a sub-path, to check that no link assumes the domain root
#
# Jekyll mode installs Jekyll (see Gemfile) into ~/.cache/ckpeiika-jekyll on the first run, which
# needs internet once. Without Ruby, or if that install fails, the script falls back to Python.
# Nothing is installed into the repository; the published site uses neither Ruby nor Python.
set -eu

mode=jekyll
if [ "${1:-}" = "--python" ]; then
  mode=python
  shift
fi
port="${1:-4000}"
subpath="${2:-}"
case "$port" in
  ''|*[!0-9]*) printf 'Port must be a number: %s\n' "$port" >&2; exit 2 ;;
esac
case "$subpath" in
  '') ;;
  /*[!/]*) subpath="${subpath%/}" ;;
  *) printf 'Sub-path must look like /foo: %s\n' "$subpath" >&2; exit 2 ;;
esac

cd "$(dirname "$0")"
root="$PWD"

open_later() {
  # Opens the browser once the server answers; harmless when no desktop is available.
  (
    for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
      sleep 0.5
      if command -v curl >/dev/null 2>&1 && curl -s -o /dev/null "$1"; then break; fi
    done
    if command -v xdg-open >/dev/null 2>&1; then xdg-open "$1" >/dev/null 2>&1 || true
    elif command -v open >/dev/null 2>&1; then open "$1" >/dev/null 2>&1 || true
    fi
  ) &
}

if [ "$mode" = jekyll ]; then
  if ! command -v bundle >/dev/null 2>&1; then
    printf 'Ruby with Bundler not found; using the Python preview instead.\n' >&2
    mode=python
  else
    export BUNDLE_PATH="${XDG_CACHE_HOME:-$HOME/.cache}/ckpeiika-jekyll"
    export BUNDLE_GEMFILE="$root/Gemfile"
    if ! bundle check >/dev/null 2>&1; then
      printf 'Installing Jekyll into %s (first run only)…\n' "$BUNDLE_PATH"
      if ! bundle install; then
        printf 'Jekyll could not be installed; using the Python preview instead.\n' >&2
        mode=python
      fi
    fi
  fi
fi

if [ "$mode" = jekyll ]; then
  url="http://127.0.0.1:${port}${subpath}/"
  printf 'Jekyll preview: %s   (Ctrl+C stops it)\n' "$url"
  open_later "$url"
  # Separate live-reload port per preview, so several can run side by side.
  exec bundle exec jekyll serve --host 127.0.0.1 --port "$port" --baseurl "$subpath" \
    --livereload --livereload-port "$((port + 31729))"
fi

if ! command -v python3 >/dev/null 2>&1; then
  printf 'Neither Jekyll nor python3 is available.\n' >&2
  exit 1
fi
serve_dir="$root"
if [ -n "$subpath" ]; then
  # Mount the repository at the sub-path through a temporary symlink.
  serve_dir="$(mktemp -d)"
  trap 'rm -rf "$serve_dir"' EXIT INT TERM
  mkdir -p "$serve_dir$(dirname "$subpath")"
  ln -s "$root" "$serve_dir$subpath"
fi
url="http://127.0.0.1:${port}${subpath}/demos/"
printf 'Static preview (demos only; Jekyll pages are not built): %s   (Ctrl+C stops it)\n' "$url"
open_later "$url"
LANG=C.UTF-8 LC_ALL=C.UTF-8 PYTHONUTF8=1 python3 -m http.server "$port" --bind 127.0.0.1 --directory "$serve_dir"
