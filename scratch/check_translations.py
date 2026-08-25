import json
import re
from pathlib import Path

frontend_dir = Path(r'c:\Users\hp\Desktop\StageSIGMATOP\dev\websig-potentiel-foncier-final\frontend\src')

# load locales
with open(frontend_dir / 'i18n' / 'locales' / 'fr.json', encoding='utf-8') as f:
    fr_data = json.load(f)

with open(frontend_dir / 'i18n' / 'locales' / 'en.json', encoding='utf-8') as f:
    en_data = json.load(f)

with open(frontend_dir / 'i18n' / 'locales' / 'ar.json', encoding='utf-8') as f:
    ar_data = json.load(f)

def get_nested(data, key):
    parts = key.split('.')
    cur = data
    for p in parts:
        if isinstance(cur, dict) and p in cur:
            cur = cur[p]
        else:
            return None
    return cur

# scan all tsx/ts files for t('...')
pattern = re.compile(r"""t\(\s*['"]([a-zA-Z0-9_.]+)['"]\s*[\),:]""")

missing_in_fr = []
missing_in_en = []
missing_in_ar = []

for file_path in frontend_dir.rglob('*.ts*'):
    if 'locales' in str(file_path):
        continue
    content = file_path.read_text(encoding='utf-8')
    matches = pattern.findall(content)
    for k in set(matches):
        if get_nested(fr_data, k) is None:
            missing_in_fr.append((k, file_path.name))
        if get_nested(en_data, k) is None:
            missing_in_en.append((k, file_path.name))
        if get_nested(ar_data, k) is None:
            missing_in_ar.append((k, file_path.name))

print("Missing in FR:", len(missing_in_fr), missing_in_fr)
print("Missing in EN:", len(missing_in_en), missing_in_en)
print("Missing in AR:", len(missing_in_ar), missing_in_ar)
