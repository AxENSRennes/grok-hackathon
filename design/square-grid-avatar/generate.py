"""One source character per cell, one palette color per square pixel."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent
PALETTE = {
    '.': (0, 0, 0, 0), '#': '#0b102e',
    'h': '#382334', 'l': '#56364a',
    's': '#edb384', 'd': '#ce916b',
    'c': '#16bfff', 'b': '#0789c9', 'a': '#75ddff',
    'w': '#edf6ff', 'p': '#282846',
}

# Each line is one row of square cells. Sixteen artwork columns sit inside
# a 24 x 24 canvas, with four transparent columns on either side.
FRONT = [
    '.......##.......',
    '......#hh#......',
    '....###hh##.....',
    '...#hhhhhhh#....',
    '..#hhllhhhhh#...',
    '..#hhhhhhhhh#...',
    '.#hhhhhhsshhh#..',
    '.#hhhhhsssshh#..',
    '.#hhhhsssssshh#.',
    '.#hhhssssssss#..',
    '.#sss#ssss#ss#..',
    '..#ss#ssss#ss#..',
    '..#sssssssssd#..',
    '...#dddswsdd#...',
    '....########....',
    '...#ccwccwcc#...',
    '..#cacwccwcbc#..',
    '..#caccccccbc#..',
    '..#scbbbbbbcs#..',
    '..##cccccccc##..',
    '...##########...',
    '....#pp##pp#....',
    '...#www##www#...',
    '...##########...',
]

RIGHT = [
    '.......##.......',
    '......#hh#......',
    '....###hh##.....',
    '...#hhhhhhh#....',
    '..#hhllhhhhh#...',
    '..#hhhhhhhhh#...',
    '.#hhhhhhhhhhh#..',
    '.#hhhhhhhsshh#..',
    '.#hhhhhhssss#...',
    '.#hhhhhhss#s#...',
    '.#hhhhhsss#ss#..',
    '..#hhhdsdsss#...',
    '..#ddddssssd#...',
    '...#dddddsw#....',
    '....########....',
    '....#bbcccw#....',
    '....#bcaccw#....',
    '....#bcaccc#....',
    '....#bcsccc#....',
    '....#bbcccc#....',
    '....########....',
    '.....#pp#pp#....',
    '....#www#www#...',
    '....#########...',
]

BACK = [
    '.......##.......',
    '......#hh#......',
    '....###hh##.....',
    '...#hhhhhhh#....',
    '..#hhllhhhhh#...',
    '..#hhhhhhhhh#...',
    '.#hhhhhhhhhhh#..',
    '.#hhhhhhhhhhh#..',
    '.#hhhhhhhhhhhh#.',
    '.#hhhhhhhhhhh#..',
    '.#shhhhhhhhhs#..',
    '..#hhhhhhhhh#...',
    '..#hhhhhhhhh#...',
    '...#hhhhhhhh#...',
    '....########....',
    '...#cc####cc#...',
    '..#cacbbbbcbc#..',
    '..#caccccccbc#..',
    '..#sccccccccs#..',
    '..##cbbbbbbc##..',
    '...##########...',
    '....#pp##pp#....',
    '...#www##www#...',
    '...##########...',
]


def render(rows):
    assert len(rows) == 24
    assert all(len(row) == 16 for row in rows), [(i,len(r)) for i,r in enumerate(rows) if len(r)!=16]
    image = Image.new('RGBA', (24, 24))
    for y, row in enumerate(rows):
        for x, cell in enumerate(row):
            # Point assignment is the only drawing operation in the sprite.
            image.putpixel((x+4,y), Image.new('RGBA',(1,1),PALETTE[cell]).getpixel((0,0)))
    assert set(image.getchannel('A').tobytes()) <= {0,255}
    return image


def enlarged(sprite, scale):
    result = sprite.resize((24*scale,24*scale), Image.Resampling.NEAREST)
    # Verify each logical cell becomes an exactly uniform square block.
    for y in range(24):
        for x in range(24):
            block = result.crop((x*scale,y*scale,(x+1)*scale,(y+1)*scale))
            assert len(block.getcolors()) == 1
    return result


def main():
    front, right, back = [render(rows) for rows in (FRONT,RIGHT,BACK)]
    left = ImageOps.mirror(right)
    views = [('FRONT',front),('RIGHT',right),('BACK',back),('LEFT',left)]
    bg = '#202940'
    sheet = Image.new('RGB',(1224,1010),bg)
    draw = ImageDraw.Draw(sheet)
    def label(x,y,text,size=18,color='#c4d1e5'):
        face = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc',size)
        draw.text((x,y),text,font=face,fill=color)
    label(44,28,'CYAN HOODIE / ONE SQUARE GRID',28,'#edf6ff')
    label(44,76,'24 x 24 cells. One color per cell. No partial pixels.',17)
    for x,title,grid in [(56,'SPRITE',False),(664,'SAME SPRITE + GRID',True)]:
        label(x,129,title,18,'#75ddff')
        large = enlarged(front,21)
        sheet.paste(large,(x,166),large)
        if grid:
            for n in range(25):
                draw.line((x+n*21,166,x+n*21,670),fill='#60718a')
                draw.line((x,166+n*21,x+504,166+n*21),fill='#60718a')
    for i,(name,sprite) in enumerate(views):
        x=96+i*282
        large=enlarged(sprite,7)
        sheet.paste(large,(x,748),large)
        label(x+50,936,name,16)
        sprite.save(ROOT/f'{name.lower()}-24.png')
    sheet.save(ROOT/'proposal.png')
    enlarged(front,24).save(ROOT/'front-enlarged.png')
    atlas=Image.new('RGBA',(96,24))
    for i,(_,sprite) in enumerate(views):
        atlas.paste(sprite,(i*24,0))
    atlas.save(ROOT/'turnaround.png')
    print('Verified 4 sprites, 24 x 24 integer cells, binary alpha, uniform square scaling.')


if __name__ == '__main__':
    main()
