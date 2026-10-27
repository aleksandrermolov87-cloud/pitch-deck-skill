#!/bin/zsh
# Проверка PPTX в целевом приложении (PowerPoint на macOS или LibreOffice): обёртка над pptx_target_check.py.
#   zsh pptx_target_check.sh run <src> [--app auto|powerpoint|libreoffice|none] [--theme all|dark|light]
#   zsh pptx_target_check.sh manual <src> --theme dark --slides 1,3,5 [--bad 3] [--by "…"]
#   zsh pptx_target_check.sh status <src> | env
SKILL="${0:A:h:h}"
[ -x "$SKILL/.venv/bin/python" ] || { echo "нет venv: zsh $SKILL/scripts/setup.sh"; exit 1; }
exec "$SKILL/.venv/bin/python" -I "$SKILL/scripts/pptx_target_check.py" "$@"
