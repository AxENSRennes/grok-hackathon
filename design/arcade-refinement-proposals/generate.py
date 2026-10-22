"""Isolated, integer-grid refinements of the game's 48px cyan hoodie avatar."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

OUT = Path(__file__).resolve().parent
INK = '#0b102e'
HAIR = '#382334'
HAIR_LIGHT = '#503346'
SKIN = '#edb384'
SKIN_LIGHT = '#ffcb9d'
SKIN_SHADE = '#cd916a'
CYAN = '#16bfff'
CYAN_LIGHT = '#64d9ff'
CYAN_SHADE = '#0789c9'
WHITE = '#edf6ff'
BG = '#18203b'
MUTED = '#b0bdd7'
NEAREST = Image.Resampling.NEAREST


def sprite(version, direction='front', step=0):
    im = Image.new('RGBA', (48, 48))
    d = ImageDraw.Draw(im)
    def r(color, x, y, w, h):
        d.rectangle((x, y, x+w-1, y+h-1), fill=color)
    def p(color, points):
        # Pillow's integer polygons produce binary coverage, never antialiasing.
        d.polygon(points, fill=color)
    side = direction in ('left', 'right')
    back = direction == 'back'
    phase = (0, -1, 1)[step]
    bold = version == 'C'
    balanced = version == 'B'

    # Shared shoes, dark trousers and cyan soles. Side feet overlap in depth.
    feet = [(16, phase), (25, -phase)] if side else [(14, phase), (26, -phase)]
    for x, dy in feet:
        if side:
            x += phase * (1 if x == 16 else -1)
        r(INK, x-1, 38+dy, 11, 9)
        r('#242645', x+1, 39+dy, 7, 3)
        r(WHITE, x, 43+dy, 9, 3)
        r(CYAN, x, 46+dy, 9, 1)

    if side:
        # Profile has one visible sleeve, a forward chest and a hood at the rear.
        p(INK, [(16,28),(30,28),(30,30),(33,30),(33,41),(30,41),(30,43),(14,43),(14,40),(12,40),(12,32),(16,32)])
        r(CYAN_SHADE, 15,30,16,11)
        r(CYAN, 19,30,12,9)
        r(CYAN_LIGHT, 28,31,2,6)
        r(INK, 13,29,8,6)
        r(CYAN_SHADE, 15,30,6,3)
        r(WHITE, 29,31,1,4)
        r(INK, 18+phase,32,8,9)
        r(CYAN, 19+phase,32,5,6)
        r(CYAN_LIGHT, 19+phase,33,1,3)
        r(SKIN, 20+phase,38,4,3)
    else:
        p(INK, [(14,27),(32,27),(32,29),(35,29),(35,31),(37,31),(37,40),(33,40),(33,43),(13,43),(13,40),(9,40),(9,32),(12,32),(12,29),(14,29)])
        r(CYAN_SHADE,14,29,19,12)
        r(CYAN,15,29,16,10)
        r(CYAN_LIGHT,15,31,2 if bold else 3,7)
        for x, dy in [(11,max(0,phase)),(32,max(0,-phase))]:
            r(CYAN,x,31+dy,4,6)
            r(SKIN,x,37+dy,4,3)
        if back:
            r(INK,17,29,13,5)
            r(CYAN_SHADE,18,29,11,4)
            r(CYAN,19,29,9,2)
            r(CYAN_LIGHT,17,35,12,1)
        else:
            r(INK,21,29,6,2)
            r(WHITE,19 if balanced else 20,31,1,5)
            r(WHITE,28 if balanced else 27,31,1,5)
            r(CYAN_SHADE,20,37,9,2 if bold else 1)
        r(CYAN_SHADE,17,40,14,1)

    # A keeps the pointed production silhouette. B levels the crown. C uses
    # broad, regular stair steps for a slightly more graphic arcade silhouette.
    if version == 'A':
        outline = [(14,3),(19,3),(19,1),(24,1),(24,3),(30,3),(30,6),(34,6),(34,10),(37,10),(37,22),(34,22),(34,26),(30,26),(30,29),(16,29),(16,27),(11,27),(11,23),(8,23),(8,13),(10,13),(10,8),(14,8)]
        fringe = [(11,13),(14,13),(14,8),(18,8),(18,5),(21,5),(21,3),(23,3),(23,6),(28,6),(28,8),(32,8),(32,11),(35,11),(35,17),(32,17),(32,15),(28,15),(28,13),(25,13),(25,16),(21,16),(21,19),(17,19),(17,22),(12,22),(12,19),(10,19)]
    elif version == 'B':
        outline = [(15,4),(19,4),(19,2),(26,2),(26,4),(31,4),(31,7),(34,7),(34,11),(36,11),(36,23),(34,23),(34,26),(30,26),(30,29),(17,29),(17,27),(12,27),(12,24),(10,24),(10,11),(12,11),(12,7),(15,7)]
        fringe = [(12,12),(15,12),(15,8),(19,8),(19,6),(21,6),(21,4),(25,4),(25,6),(30,6),(30,9),(33,9),(33,12),(34,12),(34,17),(31,17),(31,15),(28,15),(28,12),(25,12),(25,15),(22,15),(22,18),(18,18),(18,21),(12,21)]
    else:
        outline = [(14,4),(18,4),(18,2),(26,2),(26,4),(32,4),(32,8),(36,8),(36,12),(38,12),(38,24),(34,24),(34,28),(30,28),(30,30),(16,30),(16,28),(12,28),(12,24),(8,24),(8,12),(10,12),(10,8),(14,8)]
        fringe = [(10,14),(14,14),(14,10),(18,10),(18,6),(20,6),(20,4),(24,4),(24,6),(30,6),(30,10),(34,10),(34,14),(36,14),(36,18),(32,18),(32,16),(28,16),(28,14),(24,14),(24,18),(20,18),(20,22),(12,22),(12,20),(10,20)]
    p(INK,outline)
    r(SKIN_SHADE,13,14,21,13)
    r(SKIN,14,14,19,12)
    if not bold:
        r(SKIN_LIGHT,15,15,15,7)
    r(SKIN,10 if version != 'B' else 12,20,4,5)
    r(SKIN,33,20,3 if version != 'C' else 4,4)
    r(SKIN_SHADE,16,26,15,2)
    p(HAIR,fringe)
    r(HAIR_LIGHT,17 if version!='C' else 16,9 if version!='C' else 10,6,2)
    if not bold:
        r(HAIR_LIGHT,25,7,4,2)
    if back:
        r(HAIR,14,12,20,14)
        r(HAIR,12,15,23 if version!='B' else 22,11)
        r(HAIR,17,25,13,3)
        r(HAIR_LIGHT,15,14,4,6)
        if not bold:
            r('#2b1c31',23,24,9,2)
    elif side:
        # A single eye and ear; the facial plane faces the walking direction.
        r(HAIR,22,12,8,6)
        r(HAIR,12,17,15,7)
        r(SKIN,27,17,7,8)
        r(SKIN,34,21,3,3)
        r(SKIN_SHADE,25,22,3,3)
        r(SKIN_LIGHT if not bold else SKIN,25,20,3,3)
        r(INK,31,19,2,4)
        r(WHITE,32,26,2,1)
    else:
        r(INK,18 if balanced else 17,20,3,4 if balanced else 5)
        r(INK,28,20,3,4 if balanced else 5)
        r(WHITE,24,26,3,1)
        if balanced:
            r(SKIN_SHADE,15,24,3,1)
            r(SKIN_SHADE,31,24,3,1)
    if direction == 'left':
        im = ImageOps.mirror(im)
    return im


def font(size):
    return ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', size)


def label(d, pos, text, size=18, color=MUTED):
    d.text(pos,text,font=font(size),fill=color)


def sheet():
    im = Image.new('RGB',(1360,1110),BG)
    d = ImageDraw.Draw(im)
    label(d,(48,34),'CYAN HOODIE / THREE REFINEMENTS',28,WHITE)
    label(d,(48,80),'Same game character. Integer pixels. 48 x 48 per pose.',17)
    names = [('A','FAITHFUL','Original proportions / cleaner edges'),('B','BALANCED','Softer crown / clearer face'),('C','BOLD','Larger pixel clusters / fewer shades')]
    for row,(v,title,desc) in enumerate(names):
        y=150+row*300
        label(d,(48,y),v,42,CYAN)
        label(d,(48,y+62),title,21,WHITE)
        # The four views make directional consistency easy to compare.
        for col,direction in enumerate(('front','right','back','left')):
            x=300+col*248
            im.paste(sprite(v,direction).resize((192,192),NEAREST),(x,y),sprite(v,direction).resize((192,192),NEAREST))
            label(d,(x+38,y+209),direction.upper(),16)
        label(d,(300,y+248),desc,16)
        if row<2:
            d.line((48,y+284,1310,y+284),fill='#33405d',width=1)
    label(d,(48,1062),'DESIGN PREVIEW ONLY / GAME FILES UNCHANGED',16)
    im.save(OUT/'comparison.png')


def export():
    frames=[]
    for v in 'ABC':
        atlas=Image.new('RGBA',(144,192))
        for row,direction in enumerate(('front','right','back','left')):
            for step in range(3):
                avatar=sprite(v,direction,step)
                assert set(avatar.getchannel('A').tobytes()) <= {0,255}
                atlas.paste(avatar,(step*48,row*48))
        atlas.save(OUT/f'{v.lower()}-atlas.png')
        # Enlarged native-grid sheet, no interpolation.
        preview=Image.new('RGBA',atlas.size,BG)
        preview.alpha_composite(atlas)
        preview.resize((720,960),NEAREST).convert('RGB').save(OUT/f'{v.lower()}-poses.png')
    for direction in ('front','right','back','left'):
        for step in (0,1,0,2)*2:
            frame=Image.new('RGB',(864,352),BG)
            d=ImageDraw.Draw(frame)
            for i,v in enumerate('ABC'):
                avatar=sprite(v,direction,step).resize((240,240),NEAREST)
                frame.paste(avatar,(24+i*288,48),avatar)
                label(d,(124+i*288,306),v,23,WHITE)
            frames.append(frame)
    frames[0].save(OUT/'walk-comparison.gif',save_all=True,append_images=frames[1:],duration=160,loop=0,disposal=2)


if __name__ == '__main__':
    sheet()
    export()
    print('Rendered 3 proposals, 36 poses, and one animation; alpha is binary.')
