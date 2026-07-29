#!/usr/bin/env python3
"""Write a dAiry diary entry and merge workspace metadata libraries."""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def read_json(path: Path, fallback: dict[str, Any]) -> dict[str, Any]:
    if not path.exists():
        return fallback
    with path.open("r", encoding="utf-8") as file:
        value = json.load(file)
    return value if isinstance(value, dict) else fallback


def write_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def normalize_list(value: Any) -> list[str]:
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


def merge_items(path: Path, key: str, additions: list[str]) -> list[str]:
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


def yaml_string(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def parse_existing_created_at(content: str) -> str | None:
    match = re.match(r"^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?", content)
    if not match:
        return None
    for line in match.group(1).splitlines():
        key_match = re.match(r"^createdAt:\s*(.*)$", line)
        if key_match:
            raw = key_match.group(1).strip()
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                return raw.strip('"')
    return None


def strip_frontmatter(content: str) -> str:
    return re.sub(r"^---\r?\n[\s\S]*?\r?\n---(?:\r?\n)?", "", content, count=1)


def serialize(frontmatter: dict[str, Any], body: str) -> str:
    lines = [
        "---",
        f"createdAt: {yaml_string(frontmatter['createdAt'])}",
        f"updatedAt: {yaml_string(frontmatter['updatedAt'])}",
        f"weather: {yaml_string(frontmatter['weather'])}",
        f"location: {yaml_string(frontmatter['location'])}",
        f"mood: {frontmatter['mood']}",
        f"summary: {yaml_string(frontmatter['summary'])}",
    ]
    tags = normalize_list(frontmatter["tags"])
    if tags:
        lines.append("tags:")
        lines.extend(f"  - {yaml_string(tag)}" for tag in tags)
    else:
        lines.append("tags: []")
    lines.append("---")
    return "\n".join(lines) + "\n" + body.replace("\r\n", "\n").strip() + "\n"


def entry_path(workspace: Path, date_text: str) -> Path:
    if not DATE_RE.match(date_text):
        raise ValueError("date must be YYYY-MM-DD")
    year, month, _ = date_text.split("-")
    return workspace / "journal" / year / month / f"{date_text}.md"


def read_body(args: argparse.Namespace) -> str:
    if args.body_file:
        return Path(args.body_file).read_text(encoding="utf-8")
    if args.body is not None:
        return args.body
    raise ValueError("provide --body-file or --body")


def main() -> int:
    parser = argparse.ArgumentParser(description="Write a dAiry Markdown diary entry.")
    parser.add_argument("--workspace", default=r"D:\Document\My-Diary")
    parser.add_argument("--date", required=True)
    parser.add_argument("--weather", default="")
    parser.add_argument("--location", default="")
    parser.add_argument("--mood", type=int, default=0)
    parser.add_argument("--summary", required=True)
    parser.add_argument("--tags", action="append", default=[])
    parser.add_argument("--body")
    parser.add_argument("--body-file")
    parser.add_argument("--mode", choices=["create", "append", "overwrite"], default="create")
    args = parser.parse_args()

    if args.mood < -5 or args.mood > 5:
        raise ValueError("mood must be an integer from -5 to 5")
    if not args.summary.strip():
        raise ValueError("summary must not be empty")

    workspace = Path(args.workspace)
    file_path = entry_path(workspace, args.date)
    body = read_body(args)
    existing_content = file_path.read_text(encoding="utf-8") if file_path.exists() else None

    if args.mode == "create" and existing_content is not None:
        raise FileExistsError(f"entry already exists: {file_path}")

    created_at = now_iso()
    if existing_content is not None and args.mode in {"append", "overwrite"}:
        created_at = parse_existing_created_at(existing_content) or created_at

    final_body = body
    if existing_content is not None and args.mode == "append":
        previous_body = strip_frontmatter(existing_content).strip()
        final_body = previous_body + ("\n\n" if previous_body and body.strip() else "") + body.strip()

    frontmatter = {
        "createdAt": created_at,
        "updatedAt": now_iso(),
        "weather": args.weather.strip(),
        "location": args.location.strip(),
        "mood": args.mood,
        "summary": args.summary.strip(),
        "tags": normalize_list(args.tags),
    }

    file_path.parent.mkdir(parents=True, exist_ok=True)
    final_content = serialize(frontmatter, final_body)
    file_path.write_text(final_content, encoding="utf-8")

    metadata_dir = workspace / ".dairy"
    added_weather = merge_items(metadata_dir / "weather.json", "items", [frontmatter["weather"]])
    added_locations = merge_items(metadata_dir / "locations.json", "items", [frontmatter["location"]])
    added_tags = merge_items(metadata_dir / "tags.json", "tags", frontmatter["tags"])

    print(
        json.dumps(
            {
                "path": str(file_path),
                "mode": args.mode,
                "addedWeather": added_weather,
                "addedLocations": added_locations,
                "addedTags": added_tags,
                "content": final_content,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
