#!/usr/bin/env python3
"""config.<env>.toml の環境差分をベースの config.toml に直接マージする。

なぜ必要か:
  Supabase CLI の `config push` は `[remotes.*]` ブロックを含む config.toml を拒否する
  （"a [remotes.*] block targets project ..., which config push does not yet support"）。
  そこで差分ファイルの `[remotes.<env>.<section>]` を `[<section>]` に読み替え、
  ベースの該当セクションのキーを置き換えた「フラットな config.toml」を生成する。

方針:
  - TOML を完全にパースせず、セクション見出しと `key = value` の行単位で扱う
    （標準ライブラリだけで動かす。CI の python3 は tomllib があるが、ローカルの 3.9 には無い）。
  - ベースのコメント・並び順は保持し、差分側のキー行だけを差し替える／末尾へ追記する。
  - 複数行配列（`key = [` 〜 `]`）は 1 エントリとして扱う。
  - `[remotes.<env>]` 直下の `project_id` は push 先の確認にだけ使い、出力には含めない。

使い方:
  merge-remote-config.py <base config.toml> <config.<env>.toml> <env> [expected_project_ref]
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

HEADER_PATTERN = re.compile(r'^\s*\[([^\]]+)\]\s*(?:#.*)?$')
KEY_PATTERN = re.compile(r'^\s*((?:"[^"]*")|(?:\'[^\']*\')|[A-Za-z0-9_\-.+]+)\s*=\s*(.*)$')
MARKER = '# ---- merge-remote-config.py によって {source} の差分が結合済み（コミットしない） ----'


class Entry:
    """セクション内の 1 要素。key エントリ（複数行可）か、それ以外の行（コメント・空行）"""

    def __init__(self, key: str | None, lines: list[str]):
        self.key = key
        self.lines = lines


class Section:
    def __init__(self, name: str | None, header_line: str | None):
        self.name = name
        self.header_line = header_line
        self.entries: list[Entry] = []


def bracket_depth_delta(line: str) -> int:
    """文字列リテラルの外にある [ ] の増減を数える（複数行配列の終端検出用）"""
    depth = 0
    quote: str | None = None
    for char in line.split('#', 1)[0] if quote is None else line:
        if quote:
            if char == quote:
                quote = None
            continue
        if char in ('"', "'"):
            quote = char
        elif char == '[':
            depth += 1
        elif char == ']':
            depth -= 1
    return depth


def parse(lines: list[str]) -> list[Section]:
    sections: list[Section] = [Section(None, None)]
    index = 0
    while index < len(lines):
        line = lines[index]
        header = HEADER_PATTERN.match(line)
        if header:
            sections.append(Section(header.group(1).strip(), line))
            index += 1
            continue

        key_match = KEY_PATTERN.match(line)
        if not key_match:
            sections[-1].entries.append(Entry(None, [line]))
            index += 1
            continue

        key = key_match.group(1).strip('"\'')
        entry_lines = [line]
        depth = bracket_depth_delta(key_match.group(2))
        while depth > 0 and index + 1 < len(lines):
            index += 1
            entry_lines.append(lines[index])
            depth += bracket_depth_delta(lines[index])
        sections[-1].entries.append(Entry(key, entry_lines))
        index += 1
    return sections


def find_section(sections: list[Section], name: str) -> Section | None:
    return next((section for section in sections if section.name == name), None)


def apply_overrides(base: list[Section], override: list[Section], env_name: str, expected_ref: str | None) -> None:
    prefix = f'remotes.{env_name}'
    for section in override:
        if section.name is None:
            continue
        if section.name == prefix:
            project_id = next((e for e in section.entries if e.key == 'project_id'), None)
            if expected_ref and project_id:
                value = project_id.lines[0].split('=', 1)[1].strip().strip('"\'')
                if value != expected_ref:
                    fail(f'{section.name} の project_id ({value}) が link 先 ({expected_ref}) と一致しません')
            continue
        if not section.name.startswith(prefix + '.'):
            fail(f'想定外のセクション [{section.name}]（[{prefix}.<section>] で始めてください）')

        target_name = section.name[len(prefix) + 1 :]
        target = find_section(base, target_name)
        if target is None:
            target = Section(target_name, f'[{target_name}]')
            base.append(Section(None, None))
            base[-1].entries.append(Entry(None, ['']))
            base.append(target)

        for entry in section.entries:
            if entry.key is None:
                continue
            existing = next((e for e in target.entries if e.key == entry.key), None)
            if existing:
                existing.lines = entry.lines
            else:
                target.entries.append(entry)


def render(sections: list[Section]) -> list[str]:
    output: list[str] = []
    for section in sections:
        if section.header_line is not None:
            output.append(section.header_line)
        for entry in section.entries:
            output.extend(entry.lines)
    return output


def fail(message: str) -> None:
    print(f'error: {message}', file=sys.stderr)
    sys.exit(1)


def main(argv: list[str]) -> None:
    if len(argv) not in (4, 5):
        print('usage: merge-remote-config.py <base.toml> <override.toml> <env> [expected_project_ref]', file=sys.stderr)
        sys.exit(2)

    base_path, override_path, env_name = Path(argv[1]), Path(argv[2]), argv[3]
    expected_ref = argv[4] if len(argv) == 5 else None

    base_lines = base_path.read_text(encoding='utf-8').splitlines()
    if any(line.startswith('# ---- merge-remote-config.py') for line in base_lines):
        fail(f'{base_path} は既に結合済みです。git checkout で元に戻してから再実行してください')

    override_lines = override_path.read_text(encoding='utf-8').splitlines()
    base_sections = parse(base_lines)
    apply_overrides(base_sections, parse(override_lines), env_name, expected_ref)

    merged = [MARKER.format(source=override_path.name), *render(base_sections)]
    base_path.write_text('\n'.join(merged) + '\n', encoding='utf-8')
    print(f'merged: {override_path.name} -> {base_path}')


if __name__ == '__main__':
    main(sys.argv)
