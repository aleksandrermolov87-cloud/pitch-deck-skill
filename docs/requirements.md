# Программы и зависимости

Нужен локальный Codex, Claude Code или ZCode Agent с доступом к терминалу и папке скилла. Установка рассчитана на macOS и Linux; нативная Windows не поддерживается.

| Программа | Для чего нужна |
|---|---|
| Git 2.34+ и OpenSSH | Загрузка релиза и проверка SSH-подписи |
| Node.js 18+ и npm | Сборка PowerPoint |
| Python 3.11+ с `venv` и `pip` | Проверки и обработка файлов |
| zsh, Bash, Perl, curl, tar и rsync | Установка, обновление и экспорт |
| Chrome или Chromium | Рендер слайдов и экспорт PDF |
| Poppler | Разбор PDF, шрифтов и страниц |

Скрипт выбирает подходящий Python через `scripts/python.sh`. Системный Python на macOS может быть старее требуемой версии.

## macOS

Если установлен [Homebrew](https://brew.sh), программы можно поставить так:

```bash
brew install git node python@3.12 poppler
brew install --cask google-chrome
```

zsh, Bash, Perl, curl, tar и rsync обычно уже есть в macOS. Проверка после установки скилла:

```bash
zsh /путь/к/pitch-deck-skill/scripts/doctor.sh
```

## Linux

Установите программы из таблицы средствами своего дистрибутива. Проверьте, что отдельно установлены `zsh`, `npm` и модуль Python `venv` (в некоторых дистрибутивах это отдельные пакеты). Для проверки репозитория используется Ubuntu с Node.js 22, Python 3.12 и Google Chrome. `setup.sh --system` предназначен для Homebrew; на Linux без Homebrew установите системные программы до запуска setup.

Setup создаёт собственное Python-окружение и устанавливает пакеты по lock-файлам. Для этого нужен доступ к npm, PyPI и публичным ресурсам демо. PowerPoint или LibreOffice нужны только для дополнительной проверки PPTX в целевом приложении.

[Установка в Codex](install-codex.md) · [Установка в Claude Code](install-claude-code.md) · [Установка в ZCode](install-zcode.md)
