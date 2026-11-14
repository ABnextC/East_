"""깃허브 페이지용 index.html과 claude.ai 아티팩트용 dist/artifact.html을 만든다.
사용: python3 src/build.py  (저장소 맨 위에서)"""
import json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = lambda *p: os.path.join(ROOT, 'src', *p)
data = json.load(open(os.path.join(ROOT, 'data', 'eic-data.json'), encoding='utf-8'))
open(S('data.js'), 'w', encoding='utf-8').write('export const DATA = ' + json.dumps(data, ensure_ascii=False) + ';\n')
d = open(S('data.js'), encoding='utf-8').read().replace('export const', 'const')
e = open(S('engine.js'), encoding='utf-8').read(); e = re.sub(r"^import .*\n", '', e); e = re.sub(r'\bexport ', '', e)
core = open(S('ui_table.js'), encoding='utf-8').read()
t = open(S('template.html'), encoding='utf-8').read()
bundle = lambda net: (d + e + core + net).replace('</script', '<\\/script')
gt = t.replace('<script>\n/*BUNDLE*/', '<script src="peerjs.min.js"></script>\n<script>\n/*BUNDLE*/')
gt = gt.replace('온라인 방에서는 내 배와 내가 미리 본 카드만 보입니다. 다만 친구끼리 쓰는 용도라 마음먹고 페이지 코드를 뜯어보면 숨긴 정보도 볼 수 있어요.',
                '방장 브라우저가 판정하고, 손님에게는 숨긴 정보를 보내지 않아요. 방장 창을 닫으면 게임이 멈췄다가, 방장이 다시 열면 이어져요.')
assert 'peerjs.min.js' in gt
open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8').write(gt.replace('/*BUNDLE*/', bundle(open(S('net_p2p.js'), encoding='utf-8').read())))
os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
open(os.path.join(ROOT, 'dist', 'artifact.html'), 'w', encoding='utf-8').write(t.replace('/*BUNDLE*/', bundle(open(S('net_db.js'), encoding='utf-8').read())))
print('built index.html, dist/artifact.html')
