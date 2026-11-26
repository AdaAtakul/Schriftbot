# Mitgelieferte Schriften A–F aus UJIpenchars2 erzeugen (CC BY 4.0, doi:10.24432/C5FG8S).
# Daten: https://archive.ics.uci.edu/dataset/177 → ujipenchars2.txt
# Aufruf je Schrift: python3 tools/uji-schriften.py ujipenchars2.txt schriften/schrift-a.json "tst_UPV_W18|Schrift A · ordentlich|ordentlich"
# Auswahl: B=trn_UJI_W07, C=tst_UPV_W33, D=trn_UJI_W11 (normal), E=trn_UPV_W44 (normal), F=tst_UPV_W42 (locker)

# UJIpenchars2 einlesen und je Schreiber auswerten (Grundlinie, x-Höhe, Streuung)
import re, json, sys, math, random, datetime, statistics as st
NAMES = {'Uuml': 'Ü', 'uuml': 'ü', 'euro': '€'}
def load(path):
    data = {}  # writer -> char -> [strokes...] list of samples
    ch = None
    lines = open(path, encoding='latin-1').read().splitlines()
    i = 0
    while i < len(lines):
        L = lines[i]
        m = re.match(r'// (?:Non-)?ASCII char: (.*)', L)
        if m:
            ch = m.group(1).strip(); ch = NAMES.get(ch, ch)
        elif L.startswith('WORD'):
            _, c, wid = L.split()[:3]
            site, rest = wid.split('_', 1)[0], wid.split('_', 1)[1]
            writer, rep = wid.rsplit('-', 1)
            n = int(lines[i + 1].split()[1]); strokes = []
            for k in range(n):
                nums = list(map(int, lines[i + 2 + k].split('#')[1].split()))
                pts = [(nums[j], nums[j + 1]) for j in range(0, len(nums), 2)]
                dd = [pts[0]] + [p for a, p in zip(pts, pts[1:]) if p != a]  # doppelte Punkte weg
                strokes.append(dd)
            data.setdefault(writer, {}).setdefault(ch, []).append(strokes)
            i += 1 + n
        i += 1
    return data


P = 0.15  # Druck wie in der mitgelieferten Beispielschrift (Median)
BASE = 'acemnorsuvwxz'

def writer_metrics(chars):
    bots, tops, caps = [], [], []
    for c in BASE:
        for s in chars.get(c, []):
            ys = [p[1] for k in s for p in k]; bots.append(max(ys)); tops.append(min(ys))
    base = st.median(bots); xh = base - st.median(tops)
    return base, xh

def norm(sample, base, xh, rnd):
    minx = min(p[0] for k in sample for p in k)
    out = []
    for k in sample:
        pts = []
        for i, (x, y) in enumerate(k):
            # leichtes An- und Abschwellen des Drucks, damit Striche nicht wie gestempelt wirken
            t = i / max(1, len(k) - 1)
            pr = P * (0.75 + 0.25 * math.sin(math.pi * t)) * (0.95 + 0.1 * rnd.random())
            pts.append([round((x - minx) / xh, 3), round((y - base) / xh, 3), round(pr, 3), i * 8])
        if len(pts) == 1:  # Punkt (i, j, Satzzeichen): als winziger Strich, sonst zeichnet perfect-freehand nichts
            x, y, pr, _ = pts[0]; pts.append([round(x + 0.02, 3), round(y + 0.02, 3), pr, 8])
        out.append(pts)
    return out

def top(s): return min(p[1] for k in s for p in k)
def bottom(s): return max(p[1] for k in s for p in k)
def cx(s): xs = [p[0] for k in s for p in k]; return (min(xs) + max(xs)) / 2

def umlaut(base_sample, uml_sample, upper):
    # Punkte des ü/Ü (Striche ganz über dem Buchstabenkörper) auf a/o/A/O setzen
    body_top = top([max(uml_sample, key=lambda k: len(k))])
    dots = [k for k in uml_sample if max(p[1] for p in k) < body_top - 0.05]
    if not dots: return None
    rest = [k for k in uml_sample if k not in dots]
    gap = body_top - max(p[1] for k in dots for p in k)  # Abstand Punkte → Buchstabe
    dx = cx(base_sample) - cx(dots)
    dy = (top(base_sample) - gap) - max(p[1] for k in dots for p in k)
    moved = [[[round(p[0] + dx, 3), round(p[1] + dy, 3), p[2], p[3]] for p in k] for k in dots]
    return [[list(p) for p in k] for k in base_sample] + moved

def synth(ch, rnd, h=1.0):
    # Seltene Zeichen, die in der Sammlung fehlen: einfache Striche mit etwas Zittern
    j = lambda: (rnd.random() - 0.5) * 0.06
    line = lambda x0, y0, x1, y1: [[round(x0 + (x1 - x0) * t / 6 + j(), 3), round(y0 + (y1 - y0) * t / 6 + j(), 3), P, t * 8] for t in range(7)]
    if ch == '/': return [line(0.2, 0.15, 1.0, -1.7)]
    if ch == '+': return [line(0.15, -0.55, 1.15, -0.6), line(0.65, -1.05, 0.62, -0.08)]
    if ch == '=': return [line(0.15, -0.75, 1.1, -0.78), line(0.18, -0.35, 1.12, -0.37)]
    if ch == ' ': return [[[0, 0, 0.5, 0], [round(1.6 + rnd.random() * 0.6, 3), 0, 0.5, 10]]]

def build(path, writer, name, style):
    d = load(path); chars = d[writer]; rnd = random.Random(writer)
    base, xh = writer_metrics(chars)
    glyphs = {}
    for ch, samples in chars.items():
        if len(ch) != 1: continue
        glyphs[ch] = [norm(s, base, xh, rnd) for s in samples]
    for lo, up in (('a', 'A'), ('o', 'O')):
        for b, u, uml in ((lo, False, 'ü'), (up, True, 'Ü')):
            res = [umlaut(bs, us, u) for bs, us in zip(glyphs.get(b, []), glyphs.get(uml, []))]
            res = [r for r in res if r]
            if res: glyphs[{'a': 'ä', 'o': 'ö', 'A': 'Ä', 'O': 'Ö'}[b]] = res
    for ch in '/+= ':
        if ch not in glyphs: glyphs[ch] = [synth(ch, rnd), synth(ch, rnd)]
    keep = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789äöüÄÖÜ.,!?:;-()\"'/+=% @€")
    glyphs = {k: v for k, v in glyphs.items() if k in keep}
    profile = {'format': 'handschrift-profil', 'version': 1, 'customPairs': [], 'glyphs': glyphs}
    return {'name': name, 'from': None, 'settings': {'style': style, 'styles': {}, 'ink': 'schwarz'}, 'handwriting': profile}, xh / 100

if __name__ == '__main__':
    path, out = sys.argv[1], sys.argv[2]
    entries = []
    for arg in sys.argv[3:]:
        w, name, style = arg.split('|')
        e, xh_mm = build(path, w, name, style)
        entries.append(e)
        print(w, name, 'x-Höhe %.1f mm' % xh_mm, len(e['handwriting']['glyphs']), 'Zeichen')
    json.dump({'format': 'handschrift-sammlung', 'version': 1, 'created': datetime.date.today().isoformat(), 'profiles': entries},
              open(out, 'w'), ensure_ascii=False, separators=(',', ':'))
