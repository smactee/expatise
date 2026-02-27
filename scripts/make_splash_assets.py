from PIL import Image
import numpy as np
from collections import deque
import os, math

ICON_IN = "assets/icon-only.png"
WORD_IN = "assets/wordmark.webp"
OUT_DIR = "public/splash"

os.makedirs(OUT_DIR, exist_ok=True)

def connected_components(mask):
    h, w = mask.shape
    visited = np.zeros_like(mask, dtype=bool)
    dirs = [(-1,0),(1,0),(0,-1),(0,1),(-1,-1),(-1,1),(1,-1),(1,1)]
    comps = []
    for y in range(h):
        for x in range(w):
            if mask[y,x] and not visited[y,x]:
                q = deque([(y,x)])
                visited[y,x] = True
                coords = []
                minx=maxx=x; miny=maxy=y
                while q:
                    cy,cx=q.popleft()
                    coords.append((cy,cx))
                    minx=min(minx,cx); maxx=max(maxx,cx)
                    miny=min(miny,cy); maxy=max(maxy,cy)
                    for dy,dx in dirs:
                        ny,nx=cy+dy,cx+dx
                        if 0<=ny<h and 0<=nx<w and mask[ny,nx] and not visited[ny,nx]:
                            visited[ny,nx]=True
                            q.append((ny,nx))
                comps.append((len(coords),(minx,miny,maxx,maxy),coords))
    return comps

def save_layer(arr, bbox, coords, out_path):
    x0,y0,x1,y1 = bbox
    w = x1-x0+1
    h = y1-y0+1
    out = np.zeros((h,w,4), dtype=np.uint8)
    for cy,cx in coords:
        if x0<=cx<=x1 and y0<=cy<=y1:
            out[cy-y0, cx-x0] = arr[cy,cx]
    Image.fromarray(out, "RGBA").save(out_path)

# --- 1) Slice icon into 3 big white components (base + 2 bars), crop to union bbox ---
icon = Image.open(ICON_IN).convert("RGBA")
arr = np.array(icon)
bg = arr[0,0,:3].astype(int)
rgb = arr[:,:,:3].astype(int)
dist = np.sqrt(((rgb-bg)**2).sum(axis=2))
mask = dist > 25

comps = connected_components(mask)
comps = sorted(comps, key=lambda t: t[0], reverse=True)

# Keep top 3 components (your logo = 3 pieces)
top3 = comps[:3]
# Union bbox
ux0 = min(b[0] for _,b,_ in top3)
uy0 = min(b[1] for _,b,_ in top3)
ux1 = max(b[2] for _,b,_ in top3)
uy1 = max(b[3] for _,b,_ in top3)
union_bbox = (ux0,uy0,ux1,uy1)

# Identify which is base (largest) vs bars (smaller)
base = top3[0]
bars = top3[1:]

# Among bars: top bar has smaller minY
bars = sorted(bars, key=lambda t: t[1][1])
bar_top = bars[0]
bar_bottom = bars[1]

save_layer(arr, union_bbox, base[2], os.path.join(OUT_DIR, "x_base.png"))
save_layer(arr, union_bbox, bar_top[2], os.path.join(OUT_DIR, "x_bar_top.png"))
save_layer(arr, union_bbox, bar_bottom[2], os.path.join(OUT_DIR, "x_bar_bottom.png"))

# --- 2) Make wordmark_text.png (remove X pixels, make blue background transparent) ---
word = Image.open(WORD_IN).convert("RGBA")
warr = np.array(word)
wbg = warr[0,0,:3].astype(int)
wrgb = warr[:,:,:3].astype(int)
wdist = np.sqrt(((wrgb-wbg)**2).sum(axis=2))

# Background → transparent
warr[wdist <= 15, 3] = 0

# Find components of white shapes
wmask = wdist > 25
wcomps = connected_components(wmask)
wcomps = sorted(wcomps, key=lambda t: t[0], reverse=True)

# Heuristic: "X" in your wordmark is the big component near left-middle.
# Pick the largest component whose bbox center-x is around 15%~35% of width.
H,W = wmask.shape
x_label = None
best = None
for cnt,bbox,coords in wcomps[:20]:
    minx,miny,maxx,maxy = bbox
    cx = (minx+maxx)/2 / (W-1)
    if 0.12 <= cx <= 0.38:
        best = (cnt,bbox,coords)
        break

if best:
    _,_,coords = best
    for cy,cx in coords:
        warr[cy,cx,3] = 0

Image.fromarray(warr, "RGBA").save(os.path.join(OUT_DIR, "wordmark_text.png"))

print("✅ wrote:")
print(" - public/splash/x_base.png")
print(" - public/splash/x_bar_top.png")
print(" - public/splash/x_bar_bottom.png")
print(" - public/splash/wordmark_text.png")