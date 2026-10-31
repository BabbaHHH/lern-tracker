"""Recover only our four known edits; baseline hashes must prove exact originals."""
from pathlib import Path
import hashlib,json,difflib
base=Path('docs/entwuerfe/DATA-01/pruefungen')
hashes=json.loads((base/'data-c5a-source-before.json').read_text())
replacements={
'src/components/account-learning-boundary.tsx': [('<Link href="/schreiben">Schreiben</Link><Link href="/konto/dokumente">Dokumente</Link>','<Link href="/schreiben">Schreiben</Link>')],
'src/components/account-profile-page.tsx': [('Deine privaten Originale verwaltest du unter „Meine Dokumente“. KI-Planung folgt separat.','Dokumentupload und KI-Planung werden später angebunden.'),('<Link href="/konto/dokumente" className="block mt-3 underline">Meine Dokumente</Link><AccountPersonalStatus {...personal}/>','<AccountPersonalStatus {...personal}/>')],
'src/lib/server/learning/runtime.ts': [("\nexport async function documentsRuntime():Promise<import('./documents-service').DocumentsService>{\n if(process.env.STEX_LEARNING_MODE!=='account')throw new AccountError('unavailable','Die Kontodokumente sind noch nicht eingerichtet.',503);\n const {DocumentsService}=await import('./documents-service');return new DocumentsService(await accountRuntime());\n}\n",'')],
'src/lib/server/persistence/repository.ts': [('''      // A snapshot exposes only the explicitly selected original, never query order.
      // Every immutable version remains in documentVersions and in full backup.
      if (record.normalized.documentVersionId === row.document_version_id) {
        const bytes = await this.files.read(row.storage_key, row.sha256, Number(row.byte_size));
        record.value = { ...record.value, dataUrl: row.data_url_header + bytes.toString("base64") };
      }''','''      const bytes = await this.files.read(row.storage_key, row.sha256, Number(row.byte_size));
      record.value = { ...record.value, dataUrl: row.data_url_header + bytes.toString("base64") };''')]
}
parts=[]
for f,edits in replacements.items():
 current=Path(f).read_text();before=current
 for new,old in edits:
  assert before.count(new)==1,f
  before=before.replace(new,old,1)
 assert hashlib.sha256(before.encode()).hexdigest()==hashes[f],f+' baseline mismatch'
 parts.extend(difflib.unified_diff(before.splitlines(True),current.splitlines(True),fromfile='before/'+f,tofile='after/'+f))
(base/'data-c5a-shared.diff').write_text(''.join(parts));print('Four exact baseline hashes verified; shared diff saved.')
