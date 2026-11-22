# =============================================================
# Genera version.json: la versión del juego y la lista de sus archivos.
# El juego la lee al abrir (ver index.html): si la versión cambió,
# vuelve a descargar todos los archivos para no mezclar viejos y nuevos.
#
# Uso (desde la carpeta prototipo-web):   python version.py 0.0.11
# =============================================================
import json, os, sys

version = sys.argv[1] if len(sys.argv) > 1 else 'dev'
archivos = ['index.html']
for carpeta, _, nombres in os.walk('src'):
    for nombre in nombres:
        if nombre.endswith(('.js', '.json')):
            archivos.append(os.path.join(carpeta, nombre).replace('\\', '/'))
archivos.sort()
with open('version.json', 'w', encoding='utf-8', newline='\n') as f:
    json.dump({'version': version, 'archivos': archivos}, f, ensure_ascii=False, indent=2)
print(f'version.json: {version} ({len(archivos)} archivos)')
