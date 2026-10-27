#!/bin/zsh
# Тест проверки PPTX в целевом приложении и её разделов в сводном отчёте (синтетические фикстуры, без PowerPoint).
#   zsh tests/target_check/run.sh [папка]
SKILL="${0:A:h:h:h}"
exec "$SKILL/.venv/bin/python" -I "$SKILL/tests/target_check/test_target_check.py" "$@"
