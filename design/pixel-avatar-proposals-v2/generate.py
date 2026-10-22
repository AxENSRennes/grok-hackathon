"""Standalone art exploration. Does not import or modify the game."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).parent
INK = '#10162f'
BG = '#1b2441'
WHITE = '#f4f2df'
COLORS = ['#24c9f4', '#ff4ca5', '#ffda57', '#ff9954', '#ab86f5']
SKINS = ['#efb88e', '#b87551', '#df9b71', '#f5cea5', '#915d43']
HAIR = ['#443349', '#352d42', '#694135', '#efd089', '#302e41']
FAMILIES = [('A', 'Pocket', (16, 24), 'Small adventurers'),
            ('B', 'Capsule', (16, 20), 'Hooded, round silhouettes'),
            ('C', 'Block', (16, 20), 'Compact square silhouettes'),
            ('D', 'Mini', (12, 16), 'The simplest readable characters')]

def shade(color, delta):
    return tuple(max(0, min(255, int(color[i:i+2], 16) + delta)) for i in (1, 3, 5)) + (255,)

def outlined(image, points, color):
    mask = Image.new('1', image.size)
    ImageDraw.Draw(mask).polygon(points, fill=1)
    pixels = mask.load()
    draw = ImageDraw.Draw(image)
    # Four-neighbour dilation gives a one-cell outline, never a smooth curve.
    for y in range(image.height):
        for x in range(image.width):
            if pixels[x, y]:
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    if 0 <= x+dx < image.width and 0 <= y+dy < image.height:
                        draw.point((x+dx, y+dy), fill=INK)
    draw.polygon(points, fill=color)

def make_sprite(family, variant):
    size = next(f[2] for f in FAMILIES if f[0] == family)
    im = Image.new('RGBA', size)
    d = ImageDraw.Draw(im)
    shirt, skin, hair = COLORS[variant], SKINS[variant], HAIR[variant]
    dark, light = shade(shirt, -38), shade(shirt, 32)
    if family == 'A':
        # A short, separate torso leaves room for readable walking legs.
        d.rectangle((4, 19, 6, 22), fill=INK); d.rectangle((9, 19, 11, 22), fill=INK)
        d.rectangle((4, 22, 6, 22), fill=WHITE); d.rectangle((9, 22, 11, 22), fill=WHITE)
        outlined(im, [(4, 13), (11, 13), (12, 15), (12, 17), (10, 18), (5, 18), (3, 17), (3, 15)], shirt)
        d.rectangle((5, 17, 10, 18), fill=dark); d.point((3, 17), fill=skin); d.point((12, 17), fill=skin)
        d.line((5, 14, 5, 16), fill=light); d.point((7, 14), fill=WHITE); d.point((9, 14), fill=WHITE)
        outlined(im, [(5, 3), (10, 3), (12, 5), (12, 10), (10, 12), (5, 12), (3, 10), (3, 5)], skin)
        d.rectangle((4, 10, 11, 11), fill=shade(skin, -16))
        hx, hy, left_eye, right_eye, eyes_y = 3, 3, 6, 10, 8
    elif family == 'B':
        d.rectangle((4, 17, 6, 18), fill=INK); d.rectangle((9, 17, 11, 18), fill=INK)
        outlined(im, [(6, 3), (9, 3), (11, 4), (12, 6), (12, 14), (11, 16), (4, 16), (3, 14), (3, 6), (4, 4)], shirt)
        d.rectangle((4, 13, 11, 15), fill=dark); d.line((4, 7, 4, 12), fill=light)
        # The skin window keeps the bean-like body recognisably human.
        outlined(im, [(6, 6), (10, 6), (11, 7), (11, 10), (10, 11), (5, 11), (4, 10), (4, 7)], skin)
        d.rectangle((6, 6, 10, 6), fill=hair); d.point((5, 7), fill=hair)
        d.point((6, 8), fill=INK); d.point((9, 8), fill=INK)
        d.point((7, 10), fill=shade(skin, -24))
        d.point((2, 13), fill=skin); d.point((13, 13), fill=skin)
        d.line((6, 13, 9, 13), fill=light)
        if variant == 1: d.rectangle((6, 2, 8, 2), fill=hair)
        if variant == 2: d.point((9, 2), fill=WHITE)
        if variant == 3: d.rectangle((6, 4, 9, 4), fill=WHITE)
        if variant == 4: d.point((8, 1), fill='#58cda7'); d.point((9, 1), fill='#58cda7'); d.point((8, 2), fill=INK)
        return im
    elif family == 'C':
        d.rectangle((4, 16, 6, 18), fill=INK); d.rectangle((9, 16, 11, 18), fill=INK)
        d.line((4, 18, 6, 18), fill=WHITE); d.line((9, 18, 11, 18), fill=WHITE)
        outlined(im, [(4, 10), (11, 10), (12, 11), (12, 14), (10, 16), (5, 16), (3, 14), (3, 11)], shirt)
        d.rectangle((5, 14, 10, 15), fill=dark); d.rectangle((3, 13, 3, 14), fill=skin); d.rectangle((12, 13, 12, 14), fill=skin)
        d.line((5, 11, 5, 13), fill=light)
        outlined(im, [(4, 3), (11, 3), (12, 4), (12, 8), (11, 9), (4, 9), (3, 8), (3, 4)], skin)
        hx, hy, left_eye, right_eye, eyes_y = 3, 3, 6, 10, 6
    else:
        d.rectangle((3, 13, 4, 15), fill=INK); d.rectangle((7, 13, 8, 15), fill=INK)
        d.point((3, 15), fill=WHITE); d.point((8, 15), fill=WHITE)
        outlined(im, [(3, 9), (8, 9), (9, 11), (8, 12), (3, 12), (2, 11)], shirt)
        d.line((4, 12, 7, 12), fill=dark); d.point((3, 10), fill=light)
        outlined(im, [(3, 2), (8, 2), (9, 3), (9, 6), (8, 7), (3, 7), (2, 6), (2, 3)], skin)
        d.line((3, 2, 8, 2), fill=hair); d.point((2, 3), fill=hair); d.point((3, 3), fill=hair)
        if variant % 2 == 0: d.point((4, 3), fill=hair)
        d.point((4, 5), fill=INK); d.point((7, 5), fill=INK)
        if variant == 1: d.rectangle((4, 0, 6, 1), fill=hair)
        if variant == 2: d.rectangle((3, 1, 8, 1), fill=WHITE); d.line((7, 2, 10, 2), fill=shirt)
        if variant == 4: d.point((6, 0), fill='#58cda7')
        return im
    # Four simple hair silhouettes share a restrained two-colour vocabulary.
    d.rectangle((hx+1, hy, hx+7, hy+1), fill=hair)
    d.rectangle((hx, hy+2, hx+1, hy+4), fill=hair)
    if variant == 0:
        d.rectangle((hx+2, hy+2, hx+4, hy+2), fill=hair); d.point((hx+2, hy+3), fill=hair)
    elif variant == 1:
        d.rectangle((hx+3, hy-2, hx+5, hy-1), fill=hair)
        d.rectangle((hx+7, hy+2, hx+8, hy+3), fill=hair)
    elif variant == 2:
        d.rectangle((hx+1, hy-1, hx+7, hy), fill=WHITE)
        d.line((hx+6, hy+1, hx+10, hy+1), fill=shirt)
    elif variant == 3:
        d.rectangle((hx+5, hy+2, hx+8, hy+2), fill=hair); d.point((hx+7, hy+3), fill=hair)
    else:
        d.point((hx+2, hy-1), fill=hair); d.point((hx+6, hy-1), fill=hair)
        d.point((hx+7, hy+2), fill=hair); d.point((hx+5, hy-2), fill='#58cda7')
    d.point((left_eye, eyes_y), fill=INK); d.point((right_eye, eyes_y), fill=INK)
    d.point((8, eyes_y+2), fill=shade(skin, -27))
    return im

def font(size):
    for name in ['/System/Library/Fonts/Menlo.ttc', '/Library/Fonts/Arial.ttf']:
        if Path(name).exists(): return ImageFont.truetype(name, size)
    return ImageFont.load_default(size=size)

def build_board(frames=None):
    board = Image.new('RGB', (1440, 1400), BG)
    d = ImageDraw.Draw(board)
    d.text((50, 35), 'SIDEQUEST / PIXEL CHARACTER STUDIES', fill=WHITE, font=font(31))
    d.text((50, 85), '4 silhouettes / 5 looks each / native pixel grids / concept only', fill='#adbbd5', font=font(19))
    for row, (key, name, size, detail) in enumerate(FAMILIES):
        top = 150 + row * 300
        d.line((45, top, 1395, top), fill='#344263', width=1)
        d.text((50, top+25), key, fill=COLORS[row], font=font(44))
        d.text((50, top+85), name.upper(), fill=WHITE, font=font(23))
        d.text((50, top+122), f'{size[0]}x{size[1]} px', fill='#adbbd5', font=font(18))
        for variant in range(5):
            im = make_sprite(key, variant)
            zoom = im.resize((im.width*8, im.height*8), Image.Resampling.NEAREST)
            x = 320 + variant*236 - zoom.width//2
            y = top+48 + (24-size[1])*8
            if frames is not None:
                tick = frames
                jump = [0, 0, 0, 1, 2, 3, 4, 3, 2, 1, 0, 0][(tick+variant*2)%12]
                y -= jump*8
            board.paste(zoom, (x, y), zoom)
            # A second small sample previews the density of a crowded room.
            small = im.resize((im.width*2, im.height*2), Image.Resampling.NEAREST)
            board.paste(small, (320+variant*236-small.width//2, top+245), small)
    return board

if __name__ == '__main__':
    (OUT / 'sprites').mkdir(exist_ok=True)
    for key, name, size, detail in FAMILIES:
        for variant in range(5):
            make_sprite(key, variant).save(OUT / 'sprites' / f'{key.lower()}-{variant+1}.png')
    board = build_board()
    board.save(OUT / 'proposals.png')
    for row, (key, *_rest) in enumerate(FAMILIES):
        board.crop((0, 145+row*300, 1440, 450+row*300)).save(OUT / f'{key.lower()}-family.png')
    frames = [build_board(i) for i in range(12)]
    frames[0].save(OUT / 'jump-preview.gif', save_all=True, append_images=frames[1:], duration=100, loop=0, disposal=2)
    # Every native sprite is transparent or opaque, with no blended edge pixels.
    for key, *_rest in FAMILIES:
        for variant in range(5):
            im = make_sprite(key, variant)
            assert set(im.getchannel('A').getdata()) <= {0, 255}
    print('Created 20 native sprites, 4 family sheets, comparison board and jump preview.')
