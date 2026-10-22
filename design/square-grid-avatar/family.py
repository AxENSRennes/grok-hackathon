"""Character and accessory studies using the approved square-cell sprite."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from generate import FRONT, PALETTE

OUT = Path(__file__).resolve().parent / 'family'
OUT.mkdir(exist_ok=True)
BG = '#202940'
WHITE = '#edf6ff'
INK = '#0b102e'

# Only the head changes. All characters retain the approved body and cell size.
HEADS = {
    'CYAN': FRONT[:14],
    'PINK': [
        '......####......',
        '.....#hhhh#.....',
        '.....#hllh#.....',
        '....##hhhh##....',
        '...#hhhhhhhh#...',
        '..#hhhllhhhhh#..',
        '.#hhhhhhhhhhh#..',
        '.#hhhsshhsshh#..',
        '.#hhsssssssshh#.',
        '.#hssssssssssh#.',
        '.#sss#ssss#sss#.',
        '..#ss#ssss#ss#..',
        '..#dssssssssd#..',
        '...#dddswsdd#...',
    ],
    'YELLOW': [
        '................',
        '......#####.....',
        '....##hhhhh#....',
        '...#hhlllhhh#...',
        '..#hhllhhhhhh#..',
        '..#hhhhhhhhhh#..',
        '.#hhhhhhhhhhh#..',
        '.#hhhhhsssshh#..',
        '.#hhhsssssssh#..',
        '.#hhsssssssss#..',
        '.#sss#ssss#ss#..',
        '..#ss#ssss#ss#..',
        '..#dssssssssd#..',
        '...#dddswsdd#...',
    ],
    'ORANGE': [
        '.....##..##.....',
        '...##hh##hh##...',
        '..#hlhhhhhhhl#..',
        '.#hhhhhlhhhhhh#.',
        '.#hlhhhhhhhhlh#.',
        '.#hhhhhhlhhhhh#.',
        '.#hhshhhhshhhh#.',
        '.#hsssshhssshh#.',
        '.#hssssssssssh#.',
        '.#ssssssssssss#.',
        '.#sss#ssss#sss#.',
        '..#ss#ssss#ss#..',
        '..#dssssssssd#..',
        '...#dddswsdd#...',
    ],
    'VIOLET': [
        '................',
        '.....######.....',
        '...##hhhhhh##...',
        '..#hhlllhhhhh#..',
        '..#hhhhhhhhhh#..',
        '.#hhhhhhhhhhhh#.',
        '.#hhhhhhhhhhhh#.',
        '.#hhhhhsshhhhh#.',
        '.#hhsssssshhhh#.',
        '.#hhsssssssshh#.',
        '.#hss#ssss#shh#.',
        '.#hss#ssss#shh#.',
        '.#hdsssssssdhh#.',
        '..##dddswsdd##..',
    ],
}

COLORS = {
    'CYAN': {},
    'PINK': {'c':'#ff359f','b':'#c61674','a':'#ff86c7','s':'#bd7d58','d':'#96553f','h':'#352535','l':'#56384a'},
    'YELLOW': {'c':'#ffe256','b':'#c9a936','a':'#fff3a3','s':'#f4cfaa','d':'#cba17f','h':'#bd8539','l':'#ebba60'},
    'ORANGE': {'c':'#ff8d43','b':'#ce572b','a':'#ffc184','s':'#9b6044','d':'#744433','h':'#242034','l':'#453347'},
    'VIOLET': {'c':'#ac7afa','b':'#754bb8','a':'#d7b7ff','s':'#e4b18c','d':'#b77e61','h':'#442735','l':'#704250'},
}


def character(name):
    rows = HEADS[name] + FRONT[14:]
    assert len(rows)==24 and all(len(row)==16 for row in rows)
    colors = PALETTE | COLORS[name]
    colors = {k:Image.new('RGBA',(1,1),v).getpixel((0,0)) for k,v in colors.items()}
    im=Image.new('RGBA',(32,32))
    for y,row in enumerate(rows):
        for x,cell in enumerate(row):
            im.putpixel((x+8,y+4),colors[cell])
    return im


def stamp(image, rows, x, y, palette):
    colors={k:Image.new('RGBA',(1,1),v).getpixel((0,0)) for k,v in palette.items()}
    for dy,row in enumerate(rows):
        for dx,cell in enumerate(row):
            if cell!='.':
                image.putpixel((x+dx,y+dy),colors[cell])


def accessory(image, name):
    im=image.copy()
    palette={'#':INK,'w':WHITE,'c':'#16bfff','a':'#75ddff','y':'#ffe256','g':'#32cd98','b':'#138969','p':'#ff359f','d':'#c61674'}
    if name=='CAP':
        stamp(im,['...########...','..#wwwwcccc#..','.#wwwwwccccc#.','.#wwwwwccccc#.','.############.','......#cccccc#','.......######.'],9,5,palette)
    elif name=='SPROUT':
        stamp(im,['.##...##.','#gg#.#gg#','#gb#.#bg#','.###b###.','...#b#...','...###...'],12,0,palette)
    elif name=='HEADPHONES':
        stamp(im,['....########....','...#yyyyyyyy#...','..#yy######yy#..','..#y#......#y#..','.##y#......#y##.','#yy##......##yy#','#yw#........#wy#','#yy#........#yy#','.##..........##.'],8,7,palette)
    elif name=='GLASSES':
        stamp(im,['.#####.#####.','#waa#####aaw#','#aaa#...#aaa#','.###.....###.'],9,13,palette)
    elif name=='BOW':
        stamp(im,['##.....##','#p#...#p#','#pp###pp#','#pd#y#dp#','#p#####p#','##.....##'],16,5,palette)
    elif name=='SCARF':
        stamp(im,['##########','#ywywywyw#','#######yw#','......#yw#','......####'],11,18,palette)
    return im


def scale(image, factor):
    assert set(image.getchannel('A').tobytes()) <= {0,255}
    result=image.resize((image.width*factor,image.height*factor),Image.Resampling.NEAREST)
    # Check scaling preserves whole, uniformly colored square cells.
    for y in range(image.height):
        for x in range(image.width):
            assert len(result.crop((x*factor,y*factor,(x+1)*factor,(y+1)*factor)).getcolors())==1
    return result


def label(image,x,y,text,size=18,color=WHITE):
    ImageDraw.Draw(image).text((x,y),text,font=ImageFont.truetype('/System/Library/Fonts/Menlo.ttc',size),fill=color)


def place(sheet,sprite,x,y,factor):
    large=scale(sprite,factor)
    sheet.paste(large,(x,y),large)


def walk(sprite,phase):
    im=sprite.copy()
    # Only feet move. No body squash, interpolation, rotation or fractional pixels.
    if phase==0:
        return im
    dy=-1 if phase==1 else 1
    feet=[(11,16,dy),(16,21,-dy)]
    for x0,x1,_ in feet:
        for y in range(25,29):
            for x in range(x0,x1):
                im.putpixel((x,y),(0,0,0,0))
    for x0,x1,offset in feet:
        foot=sprite.crop((x0,25,x1,28))
        im.paste(foot,(x0,25+offset),foot)
    return im


def main():
    people=Image.new('RGB',(1280,470),BG)
    label(people,36,24,'FIVE CHARACTERS / ONE SHARED GRID',26)
    label(people,36,66,'Same proportions. Different hair, skin tones and hoodies.',17,'#b0bdd7')
    for i,name in enumerate(HEADS):
        avatar=character(name)
        avatar.save(OUT/f'{name.lower()}.png')
        place(people,avatar,24+i*248,114,7)
        label(people,82+i*248,371,name,20)
    people.save(OUT/'characters.png')

    accessories=['CAP','SPROUT','HEADPHONES','GLASSES','BOW','SCARF']
    sheet=Image.new('RGB',(1104,830),BG)
    label(sheet,36,24,'SIX ACCESSORIES / SAME SQUARE CELLS',26)
    for i,name in enumerate(accessories):
        x=44+(i%3)*352
        y=98+(i//3)*348
        avatar=accessory(character('CYAN'),name)
        avatar.save(OUT/f'accessory-{name.lower()}.png')
        place(sheet,avatar,x,y,8)
        label(sheet,x+58,y+268,name,20)
    sheet.save(OUT/'accessories.png')

    combos=[('CYAN','SPROUT','GLASSES'),('PINK','BOW',None),('YELLOW','HEADPHONES',None),('ORANGE','CAP','GLASSES'),('VIOLET','SCARF',None)]
    deck=[]
    for name,first,second in combos:
        avatar=accessory(character(name),first)
        if second:
            avatar=accessory(avatar,second)
        deck.append(avatar)
    sequence=[0,1,0,2]
    animation=[]
    for phase in sequence:
        frame=Image.new('RGB',(1280,440),BG)
        label(frame,36,24,'WALK / ALTERNATING FEET',26)
        label(frame,36,65,'Left up + right down, then reverse. Body stays still.',17,'#b0bdd7')
        for i,avatar in enumerate(deck):
            place(frame,walk(avatar,phase),24+i*248,112,7)
        animation.append(frame)
    animation[0].save(OUT/'combinations.png')
    # A shared, exact sprite palette prevents GIF dithering inside square cells.
    colors=set()
    for avatar in deck:
        for _,color in avatar.getcolors(maxcolors=1024):
            if color[3]:
                colors.add(color[:3])
    for color in (BG,WHITE,'#b0bdd7'):
        colors.add(Image.new('RGB',(1,1),color).getpixel((0,0)))
    entries=sorted(colors)
    assert len(entries)<=256
    palette=Image.new('P',(1,1))
    palette.putpalette([v for rgb in entries for v in rgb]+[0]*(768-3*len(entries)))
    animation=[frame.quantize(palette=palette,dither=Image.Dither.NONE) for frame in animation]
    animation[0].save(OUT/'walking.gif',save_all=True,append_images=animation[1:],duration=[100,180,100,180],loop=0,disposal=2)

    poses=Image.new('RGB',(1136,430),BG)
    label(poses,36,24,'FOOT ANIMATION / FOUR KEYFRAMES',26)
    for i,(phase,name) in enumerate(zip(sequence,['IDLE','LEFT UP','IDLE','RIGHT UP'])):
        place(poses,walk(character('CYAN'),phase),24+i*280,95,8)
        label(poses,85+i*280,365,name,17)
    poses.save(OUT/'foot-poses.png')
    atlas=Image.new('RGBA',(128,160))
    for y,name in enumerate(HEADS):
        for x,phase in enumerate(sequence):
            atlas.paste(walk(character(name),phase),(x*32,y*32))
    atlas.save(OUT/'walking-atlas.png')
    print('Exported 5 character proposals, 6 accessories, combinations, 4 walking frames and animation.')


if __name__=='__main__':
    main()
