"""Verify AUD-004 evidence coverage and local source fingerprints (offline)."""
import collections
import hashlib
import json
import re
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
AGENTIC = ROOT / ".agentic"


def read(name):
    return json.loads((AGENTIC / "evidence" / name).read_text(encoding="utf-8"))


def main():
    catalog = read("AUD-004-public-catalog.json")
    contracts = read("AUD-004-openapi-operations.json")
    mapping = read("AUD-004-capability-map.json")
    sources = read("AUD-004-local-sources.json")
    rows = mapping["rows"]
    assert len(rows) == len({r["capability"] for r in rows}) == 46
    original = subprocess.check_output(
        ["git", "show", f'{sources["entry_commit"]}:.agentic/registries/BIGCAPITAL_PARITY.md'],
        cwd=ROOT, text=True, encoding="utf-8",
    )
    old_names = {
        line.split("|")[1].strip()
        for line in original.splitlines() if "| unspecified |" in line
    }
    assert len(old_names) == 45
    assert old_names <= {r["capability"] for r in rows}
    groups = {g for r in rows for g in r["catalog_groups"]}
    assert groups == set(catalog["groups"]), groups ^ set(catalog["groups"])
    assert sum(map(len, catalog["groups"].values())) == 352
    ops = contracts["operations"]
    assert len(ops) == len({(o["method"], o["path"]) for o in ops}) == 350
    assert len({o["path"] for o in ops}) == 265
    tags = {t for o in ops for t in o["tags"]}
    assert len(tags) == 58
    # The root operation has no tag; Plaid has two case spellings.
    normalized = {t.lower().replace(" ", "-") for t in tags}
    assert normalized == groups - {"_root"}, normalized ^ groups
    all_paths = set()
    for row in rows:
        assert row["level"] in {"existing", "partial", "missing", "not_valuable", "unspecified"}
        assert row["differences_and_follow_up"] and row["owner_tasks"]
        assert row["last_validated"] == "2026-10-02"
        assert set(row["layers"]) == {"schema", "domain", "api", "ui", "mcp"}
        for task in row["owner_tasks"]:
            assert (AGENTIC / "tasks" / f"{task}.md").is_file(), task
        for paths in row["layers"].values():
            assert paths
            for path in paths:
                p = ROOT / path
                assert p.exists(), path
                assert p.resolve().is_relative_to(ROOT)
                if p.is_file():
                    all_paths.add(path)
                else:
                    all_paths.update(x.relative_to(ROOT).as_posix() for x in p.rglob("*") if x.is_file())
        for test in row["tests"]:
            assert (ROOT / test).is_file(), test
            all_paths.add(test)
    fingerprints = {f["path"]: f["sha256"] for f in sources["files"]}
    assert all_paths <= set(fingerprints), all_paths - set(fingerprints)
    for path, digest in fingerprints.items():
        assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == digest, path
        assert not Path(path).name.startswith(".env")
    registry = (AGENTIC / "registries/BIGCAPITAL_PARITY.md").read_text(encoding="utf-8")
    for row in rows:
        assert f'| {row["capability"]} | {row["level"]} |' in registry
    # Parse local Markdown targets with balanced parentheses (Next route paths).
    for match in re.finditer(r"\]\(", registry):
        pos, start, depth = match.end(), match.end(), 1
        while depth and pos < len(registry):
            depth += (registry[pos] == "(") - (registry[pos] == ")")
            pos += 1
        assert depth == 0
        target = registry[start:pos - 1]
        if not target.startswith("https://"):
            assert (AGENTIC / "registries" / target).exists(), target
    print(f"PASS: 45 original + 1 added capabilities; {len(groups)} catalog groups; "
          f"350 operations / 265 paths / 58 tags; {len(fingerprints)} source hashes; "
          "all task, test and local Markdown links resolve.")
    print(dict(collections.Counter(row["level"] for row in rows)))


if __name__ == "__main__":
    main()
