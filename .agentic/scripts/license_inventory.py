"""Offline audit snapshot of pnpm's installed graph; not legal approval or an SBOM.

Run from any directory: python .agentic/scripts/license_inventory.py
Requires the existing pnpm installation and node_modules. Does not install packages.
Writes AUD-003 evidence; do not rerun over evidence referenced by a completed task.
"""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / '.agentic/evidence/AUD-003-license-inventory.json'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    if OUTPUT.exists():
        raise SystemExit('Refusing to overwrite evidence; use a new attempt filename.')
    pnpm = shutil.which('pnpm.cmd') or shutil.which('pnpm')
    if not pnpm:
        raise SystemExit('pnpm is not available')
    result = subprocess.run([pnpm, 'licenses', 'list', '--json'], cwd=ROOT,
                            capture_output=True, text=True, encoding='utf-8', check=True)
    groups = json.loads(result.stdout)
    manifest = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))
    packages = []
    for detected_license, rows in groups.items():
        for row in rows:
            instances = []
            for location in row['paths']:
                folder = Path(location)
                package = folder / 'package.json'
                metadata = json.loads(package.read_text(encoding='utf-8'))
                notices = []
                for path in sorted(folder.iterdir()):
                    if path.is_file() and path.name.lower().startswith(
                            ('license', 'licence', 'copying', 'notice')):
                        notices.append({'path': path.relative_to(ROOT).as_posix(),
                                        'sha256': digest(path)})
                instances.append({'path': folder.relative_to(ROOT).as_posix(),
                                  'version': metadata['version'],
                                  'manifest_license': metadata.get('license'),
                                  'manifest_sha256': digest(package),
                                  'notice_files': notices})
            kind = ('direct-runtime' if row['name'] in manifest['dependencies'] else
                    'direct-development' if row['name'] in manifest['devDependencies'] else
                    'transitive')
            packages.append({'name': row['name'], 'versions': row['versions'],
                             'kind': kind, 'pnpm_detected_license': detected_license,
                             'instances': instances})
    packages.sort(key=lambda item: item['name'])
    direct = set(manifest['dependencies']) | set(manifest['devDependencies'])
    missing = sorted(direct - {row['name'] for row in packages})
    if missing:
        raise SystemExit(f'Missing direct dependencies: {missing}')
    direct_packages = []
    for name in sorted(direct):
        path = ROOT / 'node_modules' / name / 'package.json'
        data = json.loads(path.read_text(encoding='utf-8'))
        direct_packages.append({'name': name, 'version': data['version'],
                                'requested': manifest.get('dependencies', {}).get(name,
                                             manifest['devDependencies'].get(name)),
                                'kind': 'runtime' if name in manifest['dependencies'] else 'development',
                                'manifest_license': data.get('license'),
                                'manifest_sha256': digest(path)})
    snapshot = {'date': '2026-10-02', 'command': 'pnpm licenses list --json',
                'scope': 'Installed pnpm graph on Windows, including development dependencies; '
                         'not a production bundle or all-platform inventory. License detection '
                         'and manifest declarations are recorded separately; neither is approval.',
                'inputs': {name: digest(ROOT / name) for name in
                           ['package.json', 'pnpm-lock.yaml', 'package-lock.json', 'LICENSE']},
                'package_count': len(packages), 'direct_dependency_count': len(direct),
                'direct_dependencies': direct_packages, 'packages': packages}
    OUTPUT.write_text(json.dumps(snapshot, indent=2, ensure_ascii=True) + '\n', encoding='utf-8')
    print(f'Wrote {OUTPUT.relative_to(ROOT)}: {len(packages)} packages, {len(direct)} direct dependencies')


if __name__ == '__main__':
    main()
