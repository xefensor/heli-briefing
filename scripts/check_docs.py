#!/usr/bin/env python3
"""Check relative file links in tracked Markdown, without network requests.

Pass Markdown file paths to check explicit files instead (useful for fixtures).
This intentionally handles ordinary inline links and reference definitions,
not the complete Markdown grammar. Page anchors themselves are not checked.
"""

import argparse
from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import unquote, urlsplit


INLINE_LINK = re.compile(
    r"(?<!\\)!?\[[^\]\n]*\]\(\s*"
    r"(?P<target><[^>\n]+>|(?:\\.|[^()\s]|\([^()\n]*\))+)"
    r"(?:\s+(?:\"[^\"\n]*\"|'[^'\n]*'|\([^\)\n]*\)))?\s*\)"
)
REFERENCE_LINK = re.compile(
    r"^ {0,3}\[[^\]\n]+\]:\s*(?P<target><[^>\n]+>|\S+)", re.MULTILINE
)
INLINE_CODE = re.compile(r"(?<!`)(`+)(?!`)(.*?)\1(?!`)", re.DOTALL)


def blank(text: str) -> str:
    """Hide code while preserving offsets and line numbers."""
    return "".join("\n" if char == "\n" else " " for char in text)


def without_code(text: str) -> str:
    lines = []
    fence = None
    for line in text.splitlines(keepends=True):
        marker = re.match(r"^ {0,3}(`{3,}|~{3,})", line)
        if fence:
            lines.append(blank(line))
            if re.match(rf"^ {{0,3}}{re.escape(fence[0])}{{{len(fence)},}}\s*$", line):
                fence = None
        elif marker:
            fence = marker.group(1)
            lines.append(blank(line))
        elif line.startswith(("    ", "\t")):
            lines.append(blank(line))
        else:
            lines.append(line)
    text = re.sub(r"<!--[\s\S]*?-->", lambda match: blank(match.group()), "".join(lines))
    return INLINE_CODE.sub(lambda match: blank(match.group()), text)


def relative_path(target: str) -> str | None:
    target = target.removeprefix("<").removesuffix(">")
    # Markdown allows punctuation in destinations to be backslash-escaped.
    target = re.sub(r"\\([!\"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])", r"\1", target)
    try:
        url = urlsplit(target)
    except ValueError:
        return None
    if url.scheme or url.netloc or not url.path or url.path.startswith("/"):
        return None
    return unquote(url.path)


def broken_links(document: Path) -> list[tuple[int, str]]:
    text = without_code(document.read_text(encoding="utf-8"))
    matches = sorted(
        [*INLINE_LINK.finditer(text), *REFERENCE_LINK.finditer(text)],
        key=lambda match: match.start(),
    )
    broken = []
    for match in matches:
        target = match.group("target")
        relative = relative_path(target)
        if relative is not None and not (document.parent / relative).exists():
            broken.append((text.count("\n", 0, match.start()) + 1, target))
    return broken


def tracked_markdown() -> list[Path]:
    checkout = Path(__file__).resolve().parents[1]
    result = subprocess.run(
        ["git", "-C", str(checkout), "ls-files", "-z"],
        check=True, capture_output=True, text=True,
    )
    return [
        checkout / name for name in result.stdout.split("\0")
        if name and Path(name).suffix.lower() in {".md", ".markdown"}
    ]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("files", nargs="*", type=Path, help="Explicit Markdown files to check")
    args = parser.parse_args()
    try:
        documents = args.files or tracked_markdown()
    except (OSError, subprocess.CalledProcessError):
        parser.error("Cannot list tracked Markdown; run from a Git checkout or pass file paths.")

    errors = 0
    for document in documents:
        try:
            broken = broken_links(document)
        except (OSError, UnicodeError) as error:
            print(f"{document}:1: cannot read Markdown: {error}", file=sys.stderr)
            errors += 1
            continue
        for line, target in broken:
            print(f"{document}:{line}: missing local target: {target}", file=sys.stderr)
            errors += 1

    if errors:
        print(f"Found {errors} documentation link error(s).", file=sys.stderr)
        return 1
    print(f"Checked {len(documents)} Markdown file(s); all relative file targets exist.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
