"""Stable snapshot of paths, modes, contents and link targets; no timestamps."""

import hashlib
import json
import os
import stat
import sys
from pathlib import Path


def digest(root):
    root = Path(root)
    result = hashlib.sha256()

    def visit(path):
        metadata = path.lstat()
        kind = stat.S_IFMT(metadata.st_mode)
        payload = None
        if stat.S_ISLNK(metadata.st_mode):
            payload = os.readlink(path)
        elif stat.S_ISREG(metadata.st_mode):
            with path.open("rb") as source:
                payload = hashlib.file_digest(source, "sha256").hexdigest()
        record = [path.relative_to(root).as_posix(),
                  stat.S_IMODE(metadata.st_mode), kind, payload]
        result.update(json.dumps(record, ensure_ascii=True).encode("ascii") + b"\n")
        if stat.S_ISDIR(metadata.st_mode):
            for child in sorted(path.iterdir(), key=lambda p: p.name):
                visit(child)

    visit(root)
    return result.hexdigest()


if __name__ == "__main__":
    print(digest(sys.argv[1]))
