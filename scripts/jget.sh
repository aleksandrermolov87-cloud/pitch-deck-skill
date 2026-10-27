#!/bin/zsh
# Значение поля из JSON без подстановки путей в код: zsh jget.sh <файл.json> <поле.через.точку> [по умолчанию]
node -e 'try { let v = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); for (const k of process.argv[2].split(".")) v = v[k]; console.log(v ?? process.argv[3] ?? "") } catch (e) { console.log(process.argv[3] ?? "") }' "$1" "$2" "$3"
