"""Overlay only assigned PDF changes onto the complete source saved at task start.
The initial frozen source predates parallel C4a edits; never reconstruct it by
removing or replacing individual foreign changes from a later source capture.
"""
import hashlib,json,shutil,sys
from pathlib import Path
original=Path.cwd(); before=Path('/tmp/stex-pdf-a-r1-start'); target=Path(sys.argv[1]); proof=Path(sys.argv[2])
if target.exists() or not str(target).startswith('/tmp/stex-pdf-a-r1-'): raise SystemExit('Expected a new isolated target')
shutil.copytree(before,target,ignore=shutil.ignore_patterns('node_modules','.next','.next-qa','__pycache__'))
(target/'node_modules').symlink_to(original/'node_modules',target_is_directory=True)
overlay=[Path('src/lib/server/catalog-pdf/service.ts'),Path('src/lib/server/catalog-pdf/http.ts'),Path('tests/catalog-pdf-lock.test.ts')]
overlay+=list(Path('scripts/pdf-viewer').glob('pdf-a-r1-*'))
for relative in overlay:
    dest=target/relative;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(original/relative,dest)
# Isolated validation only: all production source plus assigned PDF tests/tools.
# Do not change the application's package/config/typing files in the workspace.
p=target/'next.config.ts';s=p.read_text();s=s.replace('const nextConfig: NextConfig = {','const nextConfig: NextConfig = {\n  typescript: { tsconfigPath: "scripts/pdf-viewer/pdf-a-r1-tsconfig.json" },');p.write_text(s)
manifest={str(p.relative_to(target)):hashlib.sha256(p.read_bytes()).hexdigest() for p in target.rglob('*') if p.is_file() and 'node_modules' not in p.parts and '.next' not in p.parts}
proof.write_text(json.dumps({'basis':'source-before.json: full uncommitted source captured before parallel C4a changes','snapshot':str(target),'assignedOverlay':[str(p) for p in overlay],'validationConfig':'all src plus assigned PDF tests/tools; .mts imports enabled; no error suppression','sha256':manifest},indent=2)+'\n')
print(f'{len(manifest)} frozen source files, {len(overlay)} assigned overlays; no foreign file removed from frozen basis.')
