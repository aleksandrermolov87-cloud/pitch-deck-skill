import os
import tempfile
import unittest
from pathlib import Path

from tree_digest import digest


class TreeDigestTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.file = self.root / "имя с пробелом\n.txt"
        self.file.write_text("original")

    def test_ignores_timestamps_and_other_trees(self):
        before = digest(self.root)
        os.utime(self.file, (100, 100))
        with tempfile.TemporaryDirectory() as other:
            (Path(other) / "other").write_bytes(b"x" * 100000)
            self.assertEqual(before, digest(self.root))

    def test_detects_content_path_and_mode(self):
        before = digest(self.root)
        self.file.write_text("changed")
        changed = digest(self.root)
        self.assertNotEqual(before, changed)
        self.file.chmod(0o700)
        mode = digest(self.root)
        self.assertNotEqual(changed, mode)
        self.file.rename(self.root / "renamed")
        self.assertNotEqual(mode, digest(self.root))

    def test_detects_link_target_without_following_it(self):
        link = self.root / "link"
        link.symlink_to("missing-a")
        before = digest(self.root)
        link.unlink()
        link.symlink_to("missing-b")
        self.assertNotEqual(before, digest(self.root))

    def test_detects_empty_directory_and_its_mode(self):
        before = digest(self.root)
        directory = self.root / "empty"
        directory.mkdir()
        directory.chmod(0o755)
        created = digest(self.root)
        self.assertNotEqual(before, created)
        directory.chmod(0o700)
        self.assertNotEqual(created, digest(self.root))


if __name__ == "__main__":
    unittest.main()
