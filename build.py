"""Build a portable, single-file HTML app and a source archive. Python 3 only."""
from pathlib import Path
import zipfile
import base64
import mimetypes

ROOT = Path(__file__).resolve().parent
page = (ROOT / 'index.html').read_text(encoding='utf-8')
page = page.replace('<link rel="stylesheet" href="styles.css">', '<style>\n' + (ROOT / 'styles.css').read_text(encoding='utf-8') + '\n</style>')
page = page.replace('<script src="ai.js"></script>', '<script>\n' + (ROOT / 'ai.js').read_text(encoding='utf-8') + '\n</script>')
page = page.replace('<script src="app.js"></script>', '<script>\n' + (ROOT / 'app.js').read_text(encoding='utf-8') + '\n</script>')
for asset in sorted((ROOT / 'assets').glob('*')):
    if asset.is_file():
        mime = mimetypes.guess_type(asset.name)[0] or 'application/octet-stream'
        data = 'data:' + mime + ';base64,' + base64.b64encode(asset.read_bytes()).decode('ascii')
        page = page.replace('assets/' + asset.name, data)
out = ROOT / 'Meal-Assistant.html'
out.write_text(page, encoding='utf-8')
with zipfile.ZipFile(ROOT / 'meal-assistant-v2.1.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for name in ['index.html', 'styles.css', 'app.js', 'ai.js', 'server.py', 'test_ai.mjs', 'test_server.py', 'README.md', 'START-HERE.ar.md', 'build.py', 'test.mjs', 'Meal-Assistant.html', '.gitignore']:
        archive.write(ROOT / name, 'meal-assistant/' + name)
    for asset in sorted((ROOT / 'assets').glob('*')):
        if asset.is_file():
            archive.write(asset, 'meal-assistant/assets/' + asset.name)
print('Built Meal-Assistant.html and meal-assistant-v2.1.zip')
