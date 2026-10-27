# vendor — копии скиллов-зависимостей

| Скилл | Источник | Лицензия | Зачем |
|-------|----------|----------|-------|
| `humanizer` | русская адаптация [blader/humanizer](https://github.com/blader/humanizer) 3.1.0 | MIT (`humanizer/LICENSE`) | этап 1: формулировки без ИИ-звучания |
| `taste-skill` | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill), скилл `design-taste-frontend` | MIT (`taste-skill/LICENSE`) | этап 5: чистка ИИ-слопа |

`setup.sh` копирует их в `~/.claude/skills/`, только если таких скиллов там ещё нет. Свежие версии ставятся из источников.
impeccable (Apache-2.0, [pbakaus/impeccable](https://github.com/pbakaus/impeccable)) не копируется: у него свой установщик и бинарник, ставьте `npx -y impeccable install`.
