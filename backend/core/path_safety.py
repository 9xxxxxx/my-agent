"""Helpers for constraining user-provided filenames to a root directory."""
from pathlib import Path


def safe_child_path(root: Path, filename: str) -> Path:
    name = Path(filename).name
    if not name or name != filename:
        raise ValueError("非法文件名")

    root_resolved = root.resolve()
    target = (root_resolved / name).resolve()
    if target.parent != root_resolved:
        raise ValueError("非法文件路径")
    return target
