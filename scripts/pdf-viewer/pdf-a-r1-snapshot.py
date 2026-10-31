"""Copy the complete application source, never credentials or generated output."""
import hashlib, json, os, shutil, sys
from pathlib import Path
source=Path.cwd(); target=Path(sys.argv[1]).resolve(); proof=Path(sys.argv[2])
if not str(target).startswith('/private/tmp/stex-pdf-a-r1-') and not str(target).startswith('/tmp/stex-pdf-a-r1-'):
    raise SystemExit('Expected an isolated PDF-A-R1 directory.')
target.mkdir(parents=True,exist_ok=True)
paths=[]
for root in ['src','scripts','tests','db/migrations','public']:
    if (source/root).exists():
        paths.extend(p for p in (source/root).rglob('*') if p.is_file() and not p.is_symlink() and '__pycache__' not in p.parts)
for p in source.iterdir():
    if p.is_file() and (p.suffix in ['.json','.ts','.mjs','.cjs'] or p.name=='.gitignore'):
        paths.append(p)
manifest={}
for p in sorted(set(paths)):
    relative=p.relative_to(source); dest=target/relative; dest.parent.mkdir(parents=True,exist_ok=True)
    data=p.read_bytes(); dest.write_bytes(data)
    manifest[str(relative)]=hashlib.sha256(data).hexdigest()
# Full source/scripts/tests remain included. Only other runs' generated outputs
# are replaced by the isolated run's own Next types, without changing originals.
config=json.loads((target/'tsconfig.json').read_text())
config['include']=['next-env.d.ts','src/**/*.ts','src/**/*.tsx','scripts/**/*.ts','scripts/**/*.mts','tests/**/*.ts','.next/types/**/*.ts','.next/dev/types/**/*.ts']
(target/'tsconfig.json').write_text(json.dumps(config,indent=2)+'\n')
if not (target/'node_modules').exists(): (target/'node_modules').symlink_to(source/'node_modules',target_is_directory=True)
proof.parent.mkdir(parents=True,exist_ok=True); proof.write_text(json.dumps({'source':str(source),'snapshot':str(target),'sha256':manifest},indent=2)+'\n')
print(f'{len(manifest)} source files copied; no private configuration or generated output.')
