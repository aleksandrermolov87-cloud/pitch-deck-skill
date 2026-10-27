#!/bin/zsh
# Печатает путь к Python 3.11+ для venv скилла (Pillow 13 не ставится на старые версии, а системный python3 на macOS — 3.9).
# Порядок: python3.13 … python3.11 и python3 в PATH, затем Python, поставленный через uv. Код 1, если подходящего нет.
ok() { "$1" -I -c 'import sys; sys.exit(sys.version_info < (3, 11))' 2>/dev/null; }
for c in python3.13 python3.12 python3.11 python3.14 python3; do
  p=$(command -v $c 2>/dev/null) && ok "$p" && { echo "$p"; exit 0; }
done
if command -v uv >/dev/null; then
  p=$(uv python find '>=3.11' 2>/dev/null) && ok "$p" && { echo "$p"; exit 0; }
fi
exit 1
