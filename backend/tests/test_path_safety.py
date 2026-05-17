from pathlib import Path

import pytest

from core.path_safety import safe_child_path


def test_rejects_parent_traversal():
    with pytest.raises(ValueError):
        safe_child_path(Path("uploads"), "../secret.csv")


def test_keeps_valid_filename_inside_root(tmp_path):
    target = safe_child_path(tmp_path, "sales.csv")
    assert target == (tmp_path / "sales.csv").resolve()
