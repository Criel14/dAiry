#!/usr/bin/env python3
"""dAiry 日记流程工具：读取候选、写入日记、维护候选库。"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


DEFAULT_WORKSPACE = r"D:\Document\My-Diary"
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def read_json(path: Path, fallback: dict[str, Any]) -> dict[str, Any]:
    if not path.exists():
        return fallback
    with path.open("r", encoding="utf-8-sig") as file:
        value = json.load(file)
    return value if isinstance(value, dict) else fallback


def write_json(path: Path, data: dict[str, Any]) -> None:
    atomic_write_text(path, json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def atomic_write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_name(f".{path.name}.tmp")
    temp_path.write_text(content, encoding="utf-8")
    temp_path.replace(path)


def is_relative_to(child: Path, parent: Path) -> bool:
    try:
        child.resolve().relative_to(parent.resolve())
        return True
    except ValueError:
        return False


def normalize_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        value = [value]
    if not isinstance(value, list):
        return []

    result: list[str] = []
    seen: set[str] = set()
    for item in value:
        if not isinstance(item, str):
            continue
        normalized = item.strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        result.append(normalized)
    return result


def normalize_mood(value: Any) -> int:
    if isinstance(value, bool):
        return 0
    if isinstance(value, int) and -5 <= value <= 5:
        return value
    if isinstance(value, str) and re.fullmatch(r"-?\d+", value.strip()):
        number = int(value)
        if -5 <= number <= 5:
            return number
    raise ValueError("mood 必须是 -5 到 5 的整数")


def metadata_dir(workspace: Path) -> Path:
    return workspace / ".dairy"


def draft_dir(workspace: Path) -> Path:
    return metadata_dir(workspace) / "remote-drafts"


def build_draft_path(workspace: Path, date_text: str) -> Path:
    assert_date(date_text)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return draft_dir(workspace) / f"{date_text}-{timestamp}.json"


def library_paths(workspace: Path) -> dict[str, Path]:
    root = metadata_dir(workspace)
    return {
        "weather": root / "weather.json",
        "locations": root / "locations.json",
        "tags": root / "tags.json",
    }


def load_libraries(workspace: Path) -> dict[str, list[str]]:
    paths = library_paths(workspace)
    return {
        "weather": normalize_list(read_json(paths["weather"], {"version": 1, "items": []}).get("items")),
        "locations": normalize_list(
            read_json(paths["locations"], {"version": 1, "items": []}).get("items")
        ),
        "tags": normalize_list(read_json(paths["tags"], {"version": 1, "tags": []}).get("tags")),
    }


def merge_library(path: Path, key: str, additions: list[str]) -> list[str]:
    data = read_json(path, {"version": 1, key: []})
    current = normalize_list(data.get(key))
    seen = set(current)
    added: list[str] = []
    for item in additions:
        normalized = item.strip()
        if not normalized or normalized in seen:
            continue
        current.append(normalized)
        seen.add(normalized)
        added.append(normalized)
    data["version"] = 1
    data[key] = current
    write_json(path, data)
    return added


def merge_all_libraries(
    workspace: Path,
    weather: str = "",
    location: str = "",
    tags: list[str] | None = None,
) -> dict[str, list[str]]:
    paths = library_paths(workspace)
    return {
        "addedWeather": merge_library(paths["weather"], "items", [weather]),
        "addedLocations": merge_library(paths["locations"], "items", [location]),
        "addedTags": merge_library(paths["tags"], "tags", tags or []),
    }


def assert_date(date_text: str) -> None:
    if not DATE_RE.match(date_text):
        raise ValueError("date 必须是 YYYY-MM-DD")


def entry_path(workspace: Path, date_text: str) -> Path:
    assert_date(date_text)
    year, month, _ = date_text.split("-")
    return workspace / "journal" / year / month / f"{date_text}.md"


def yaml_string(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def extract_frontmatter(content: str) -> dict[str, Any]:
    match = re.match(r"^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?", content)
    if not match:
        return {}

    result: dict[str, Any] = {}
    active_tags = False
    tags: list[str] = []
    for line in match.group(1).splitlines():
        tag_match = re.match(r"^\s*-\s*(.*)$", line)
        if tag_match and active_tags:
            tags.append(parse_yaml_string(tag_match.group(1)))
            continue

        key_match = re.match(r"^([A-Za-z][A-Za-z0-9]*):(?:\s*(.*))?$", line)
        if not key_match:
            active_tags = False
            continue

        key, raw = key_match.group(1), (key_match.group(2) or "").strip()
        active_tags = False
        if key == "tags":
            if raw == "[]":
                result["tags"] = []
            elif raw == "":
                active_tags = True
            continue
        if key == "mood":
            result[key] = int(raw) if re.fullmatch(r"-?\d+", raw) else 0
        else:
            result[key] = parse_yaml_string(raw)

    if tags:
        result["tags"] = tags
    return result


def parse_yaml_string(raw: str) -> str:
    raw = raw.strip()
    if raw.startswith('"') and raw.endswith('"'):
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return raw[1:-1]
    if raw.startswith("'") and raw.endswith("'"):
        return raw[1:-1].replace("''", "'")
    return raw


def strip_frontmatter(content: str) -> str:
    return re.sub(r"^---\r?\n[\s\S]*?\r?\n---(?:\r?\n)?", "", content, count=1)


def serialize(frontmatter: dict[str, Any], body: str) -> str:
    tags = normalize_list(frontmatter.get("tags"))
    lines = [
        "---",
        f"createdAt: {yaml_string(frontmatter['createdAt'])}",
        f"updatedAt: {yaml_string(frontmatter['updatedAt'])}",
        f"weather: {yaml_string(frontmatter['weather'])}",
        f"location: {yaml_string(frontmatter['location'])}",
        f"mood: {frontmatter['mood']}",
        f"summary: {yaml_string(frontmatter['summary'])}",
    ]
    if tags:
        lines.append("tags:")
        lines.extend(f"  - {yaml_string(tag)}" for tag in tags)
    else:
        lines.append("tags: []")
    lines.append("---")
    return "\n".join(lines) + "\n" + body.replace("\r\n", "\n").strip() + "\n"


def read_body(args: argparse.Namespace, payload: dict[str, Any]) -> str:
    if args.body_file:
        return Path(args.body_file).read_text(encoding="utf-8")
    if args.body is not None:
        return args.body
    body = payload.get("body")
    if isinstance(body, str):
        return body
    raise ValueError("需要通过 --body、--body-file 或 --payload-file.body 提供正文")


def read_payload(args: argparse.Namespace) -> dict[str, Any]:
    if not getattr(args, "payload_file", None):
        return {}
    value = json.loads(Path(args.payload_file).read_text(encoding="utf-8-sig"))
    if not isinstance(value, dict):
        raise ValueError("payload JSON 必须是对象")
    return value


def public_entry(entry: dict[str, Any], show_content: bool = False) -> dict[str, Any]:
    result = {key: value for key, value in entry.items() if key != "content"}
    if show_content:
        result["content"] = entry["content"]
    else:
        result["contentOmitted"] = True
    return result


def build_entry(args: argparse.Namespace) -> dict[str, Any]:
    payload = read_payload(args)
    workspace = Path(args.workspace or payload.get("workspace") or DEFAULT_WORKSPACE)
    date_text = args.date or payload.get("date")
    if not isinstance(date_text, str):
        raise ValueError("需要提供 date")
    assert_date(date_text)

    tags = normalize_list(args.tags or payload.get("tags"))
    body = read_body(args, payload)
    summary = (args.summary or payload.get("summary") or "").strip()
    if not summary:
        raise ValueError("summary 不能为空")

    mode = args.mode or payload.get("mode") or "create"
    if mode not in {"create", "append", "overwrite"}:
        raise ValueError("mode 只能是 create、append、overwrite")

    path = entry_path(workspace, date_text)
    existing = path.read_text(encoding="utf-8") if path.exists() else None
    if existing is not None and mode == "create":
        raise FileExistsError(f"目标日记已存在：{path}")

    created_at = now_iso()
    final_body = body
    if existing is not None and mode in {"append", "overwrite"}:
        created_at = extract_frontmatter(existing).get("createdAt") or created_at
    if existing is not None and mode == "append":
        previous_body = strip_frontmatter(existing).strip()
        final_body = previous_body + ("\n\n" if previous_body and body.strip() else "") + body.strip()

    frontmatter = {
        "createdAt": created_at,
        "updatedAt": now_iso(),
        "weather": (args.weather or payload.get("weather") or "").strip(),
        "location": (args.location or payload.get("location") or "").strip(),
        "mood": normalize_mood(args.mood if args.mood is not None else payload.get("mood", 0)),
        "summary": summary,
        "tags": tags,
    }
    content = serialize(frontmatter, final_body)
    return {
        "workspace": str(workspace),
        "date": date_text,
        "path": str(path),
        "mode": mode,
        "frontmatter": frontmatter,
        "content": content,
    }


def command_options(args: argparse.Namespace) -> None:
    workspace = Path(args.workspace)
    result: dict[str, Any] = {"workspace": str(workspace), **load_libraries(workspace)}
    if args.date:
        path = entry_path(workspace, args.date)
        result["entry"] = {"date": args.date, "path": str(path), "exists": path.exists()}
        if path.exists():
            result["entry"]["frontmatter"] = extract_frontmatter(path.read_text(encoding="utf-8"))
    print_json(result)


def command_draft_path(args: argparse.Namespace) -> None:
    workspace = Path(args.workspace)
    path = build_draft_path(workspace, args.date)
    path.parent.mkdir(parents=True, exist_ok=True)
    print_json(
        {
            "workspace": str(workspace),
            "draftDir": str(path.parent),
            "path": str(path),
            "date": args.date,
        }
    )


def command_self_check(args: argparse.Namespace) -> None:
    workspace = Path(args.workspace)
    checks: list[dict[str, Any]] = []

    def add(name: str, ok: bool, detail: str = "") -> None:
        checks.append({"name": name, "ok": ok, "detail": detail})

    add("python", sys.version_info >= (3, 10), sys.version.split()[0])
    add("workspace_exists", workspace.exists() and workspace.is_dir(), str(workspace))
    add("journal_dir_exists", (workspace / "journal").exists(), str(workspace / "journal"))

    paths = library_paths(workspace)
    for name, path in paths.items():
        try:
            data = read_json(path, {})
            if name in {"weather", "locations"}:
                ok = isinstance(data.get("items"), list)
            else:
                ok = isinstance(data.get("tags"), list)
            add(f"{name}_json_readable", ok, str(path))
        except Exception as error:
            add(f"{name}_json_readable", False, f"{path}: {error}")

    try:
        draft_root = draft_dir(workspace)
        draft_root.mkdir(parents=True, exist_ok=True)
        test_path = draft_root / ".self-check.tmp"
        atomic_write_text(test_path, "ok\n")
        test_path.unlink(missing_ok=True)
        add("remote_drafts_writable", True, str(draft_root))
    except Exception as error:
        add("remote_drafts_writable", False, str(error))

    ok = all(check["ok"] for check in checks)
    print_json({"ok": ok, "workspace": str(workspace), "checks": checks})
    if not ok:
        raise SystemExit(1)


def command_add_library(args: argparse.Namespace) -> None:
    workspace = Path(args.workspace)
    result = merge_all_libraries(
        workspace,
        weather=args.weather or "",
        location=args.location or "",
        tags=normalize_list(args.tags),
    )
    print_json({"workspace": str(workspace), **result, "libraries": load_libraries(workspace)})


def command_preview(args: argparse.Namespace) -> None:
    print_json(build_entry(args))


def command_write(args: argparse.Namespace) -> None:
    entry = build_entry(args)
    path = Path(entry["path"])
    atomic_write_text(path, entry["content"])

    workspace = Path(entry["workspace"])
    frontmatter = entry["frontmatter"]
    library_result = merge_all_libraries(
        workspace,
        weather=frontmatter["weather"],
        location=frontmatter["location"],
        tags=frontmatter["tags"],
    )
    payload_deleted = False
    if args.payload_file and not args.keep_payload:
        payload_path = Path(args.payload_file)
        if payload_path.exists() and is_relative_to(payload_path, draft_dir(workspace)):
            payload_path.unlink()
            payload_deleted = True
    print_json({**public_entry(entry, args.show_content), **library_result, "payloadDeleted": payload_deleted})


def command_clean_drafts(args: argparse.Namespace) -> None:
    workspace = Path(args.workspace)
    root = draft_dir(workspace)
    cutoff = datetime.now() - timedelta(days=args.days)
    removed: list[str] = []
    kept: list[str] = []

    if not root.exists():
        print_json({"workspace": str(workspace), "draftDir": str(root), "removed": [], "kept": []})
        return

    for path in sorted(root.glob("*.json")):
        mtime = datetime.fromtimestamp(path.stat().st_mtime)
        if mtime < cutoff:
            if not args.dry_run:
                path.unlink()
            removed.append(str(path))
        else:
            kept.append(str(path))

    print_json(
        {
            "workspace": str(workspace),
            "draftDir": str(root),
            "days": args.days,
            "dryRun": args.dry_run,
            "removed": removed,
            "kept": kept,
        }
    )


def print_json(value: dict[str, Any]) -> None:
    print(json.dumps(value, ensure_ascii=False, indent=2))


def add_entry_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--workspace")
    parser.add_argument("--payload-file")
    parser.add_argument("--date")
    parser.add_argument("--weather")
    parser.add_argument("--location")
    parser.add_argument("--mood", type=int)
    parser.add_argument("--summary")
    parser.add_argument("--tags", action="append", default=[])
    parser.add_argument("--body")
    parser.add_argument("--body-file")
    parser.add_argument("--mode", choices=["create", "append", "overwrite"])
    parser.add_argument("--keep-payload", action="store_true")
    parser.add_argument("--show-content", action="store_true")


def main() -> int:
    parser = argparse.ArgumentParser(description="dAiry 日记流程工具")
    subparsers = parser.add_subparsers(dest="command", required=True)

    options = subparsers.add_parser("options", help="读取天气、地点、标签候选，可顺便检查某天日记是否存在")
    options.add_argument("--workspace", default=DEFAULT_WORKSPACE)
    options.add_argument("--date")
    options.set_defaults(func=command_options)

    draft_path = subparsers.add_parser("draft-path", help="生成规范的 payload 草稿 JSON 路径")
    draft_path.add_argument("--workspace", default=DEFAULT_WORKSPACE)
    draft_path.add_argument("--date", required=True)
    draft_path.set_defaults(func=command_draft_path)

    self_check = subparsers.add_parser("self-check", help="检查工作区、候选库和草稿目录是否可用")
    self_check.add_argument("--workspace", default=DEFAULT_WORKSPACE)
    self_check.set_defaults(func=command_self_check)

    clean_drafts = subparsers.add_parser("clean-drafts", help="清理 remote-drafts 中的旧 payload 草稿")
    clean_drafts.add_argument("--workspace", default=DEFAULT_WORKSPACE)
    clean_drafts.add_argument("--days", type=int, default=7)
    clean_drafts.add_argument("--dry-run", action="store_true")
    clean_drafts.set_defaults(func=command_clean_drafts)

    add_library = subparsers.add_parser("add-library", help="单独新增天气、地点或标签候选")
    add_library.add_argument("--workspace", default=DEFAULT_WORKSPACE)
    add_library.add_argument("--weather")
    add_library.add_argument("--location")
    add_library.add_argument("--tags", action="append", default=[])
    add_library.set_defaults(func=command_add_library)

    preview = subparsers.add_parser("preview", help="调试用：生成最终 Markdown，但不写入文件、不更新候选库")
    add_entry_args(preview)
    preview.set_defaults(func=command_preview)

    write = subparsers.add_parser("write", help="写入日记 Markdown，合并新增候选，成功后默认删除 payload")
    add_entry_args(write)
    write.set_defaults(func=command_write)

    args = parser.parse_args()
    args.func(args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
