import argparse
import json
import random
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageFont


def mask_for(draw_size, word, font, pad, stroke=0):
    mask = Image.new("L", draw_size, 0)
    draw = ImageDraw.Draw(mask)
    draw.text((pad, pad), word, font=font, fill=255, stroke_width=stroke, stroke_fill=255)
    return mask


def tiled_texture(path, size, tile_size, brightness):
    texture = Image.open(path).convert("RGB").resize((tile_size, tile_size), Image.Resampling.LANCZOS)
    fill = Image.new("RGB", size, (200, 205, 215))
    for x in range(0, size[0], tile_size):
        for y in range(0, size[1], tile_size):
            fill.paste(texture, (x, y))
    return ImageEnhance.Brightness(fill).enhance(brightness)


def gold_gradient(width, height):
    stops = [
        (0.00, (110, 84, 22)),
        (0.22, (196, 158, 52)),
        (0.40, (246, 226, 122)),
        (0.52, (255, 244, 176)),
        (0.64, (222, 184, 74)),
        (0.82, (146, 110, 32)),
        (1.00, (94, 71, 18)),
    ]
    gradient = Image.new("RGB", (1, height))
    for y in range(height):
        progress = y / height
        for index in range(len(stops) - 1):
            start, left = stops[index]
            end, right = stops[index + 1]
            if start <= progress <= end:
                ratio = (progress - start) / max(1e-6, end - start)
                gradient.putpixel(
                    (0, y),
                    tuple(int(left[channel] + (right[channel] - left[channel]) * ratio) for channel in range(3)),
                )
                break
    return gradient.resize((width, height))


def platinum(name, face, body, fill, font, word, pad, draw_size):
    shadow = Image.new("RGBA", draw_size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).text(
        (pad, pad + 24),
        word,
        font=font,
        fill=(0, 0, 0, 170),
        stroke_width=26,
        stroke_fill=(0, 0, 0, 170),
    )
    name.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(13)))
    draw = ImageDraw.Draw(name)
    draw.text(
        (pad, pad),
        word,
        font=font,
        fill=(88, 94, 108, 255),
        stroke_width=30,
        stroke_fill=(54, 58, 68, 255),
    )
    draw.text(
        (pad, pad),
        word,
        font=font,
        fill=(216, 222, 232, 255),
        stroke_width=13,
        stroke_fill=(216, 222, 232, 255),
    )
    name.paste(fill, (0, 0), face.filter(ImageFilter.MinFilter(7)))


def gold(name, face, body, fill, draw_size):
    face_inner = face.filter(ImageFilter.MinFilter(9))
    ring = ImageChops.subtract(body, face_inner)
    shadow = Image.new("RGBA", draw_size, (0, 0, 0, 0))
    shadow.paste(Image.new("RGBA", draw_size, (0, 0, 0, 175)), (0, 22), body)
    name.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(13)))

    extrusion = Image.new("RGBA", draw_size, (0, 0, 0, 0))
    for offset in (16, 11, 6):
        extrusion.paste(Image.new("RGBA", draw_size, (74, 56, 16, 255)), (0, offset), body)
    name.alpha_composite(extrusion)
    name.paste(gold_gradient(*draw_size), (0, 0), ring)

    bevel = ImageChops.subtract(ring, ring.filter(ImageFilter.MinFilter(5)))
    bevel_top = Image.new("L", draw_size, 0)
    ImageDraw.Draw(bevel_top).rectangle((0, 0, draw_size[0], int(draw_size[1] * 0.52)), fill=255)
    bevel = ImageChops.multiply(bevel, bevel_top)
    name.paste(
        Image.new("RGBA", draw_size, (255, 246, 196, 255)),
        (0, 0),
        bevel.point(lambda value: int(value * 0.55)),
    )

    name.paste(fill, (0, 0), face_inner)
    edge = ImageChops.subtract(face_inner, face_inner.filter(ImageFilter.MinFilter(5)))
    name.paste(
        Image.new("RGBA", draw_size, (255, 250, 220, 255)),
        (0, 0),
        edge.point(lambda value: int(value * 0.5)),
    )


def sparkle(draw, x, y, radius):
    points = [
        (x, y - radius),
        (x + radius * 0.16, y - radius * 0.16),
        (x + radius, y),
        (x + radius * 0.16, y + radius * 0.16),
        (x, y + radius),
        (x - radius * 0.16, y + radius * 0.16),
        (x - radius, y),
        (x - radius * 0.16, y - radius * 0.16),
    ]
    draw.polygon(points, fill=(255, 255, 255, 235))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--word", required=True)
    parser.add_argument("--font", required=True)
    parser.add_argument("--texture", required=True)
    parser.add_argument("--preset", choices=("platinum", "gold"), required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--preview")
    parser.add_argument("--width", type=int, default=3750)
    parser.add_argument("--padding", type=int, default=140)
    parser.add_argument("--tile", type=int, default=880)
    parser.add_argument("--sparkles", type=int, default=13)
    parser.add_argument("--seed", type=int, default=23)
    args = parser.parse_args()

    size = 100
    while True:
        font = ImageFont.truetype(args.font, size)
        if font.getlength(args.word) >= args.width:
            break
        size += 25
    font = ImageFont.truetype(args.font, size)
    word_width = int(font.getlength(args.word))
    ascent, descent = font.getmetrics()
    draw_size = (word_width + args.padding * 2, ascent + descent + args.padding * 2 + 30)

    face = mask_for(draw_size, args.word, font, args.padding)
    body = mask_for(draw_size, args.word, font, args.padding, 32)
    fill = tiled_texture(args.texture, draw_size, args.tile, 1.07)
    name = Image.new("RGBA", draw_size, (0, 0, 0, 0))

    if args.preset == "platinum":
        platinum(name, face, body, fill, font, args.word, args.padding, draw_size)
    else:
        gold(name, face, body, fill, draw_size)

    random.seed(args.seed)
    sparkles = Image.new("RGBA", draw_size, (0, 0, 0, 0))
    sparkle_draw = ImageDraw.Draw(sparkles)
    pixels = face.load()
    placed = 0
    tries = 0
    while placed < args.sparkles and tries < 400:
        tries += 1
        x = random.randint(args.padding + 40, max(args.padding + 40, draw_size[0] - args.padding - 40))
        y = random.randint(args.padding + 40, max(args.padding + 40, draw_size[1] - args.padding - 40))
        if pixels[x, y] > 200:
            sparkle(sparkle_draw, x, y, random.randint(30, 58))
            placed += 1
    name.alpha_composite(sparkles.filter(ImageFilter.GaussianBlur(1)))

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    name.save(output)
    if args.preview:
        preview = Image.new("RGBA", (draw_size[0] + 200, draw_size[1] + 200), (0, 0, 0, 255))
        preview.alpha_composite(name, (100, 100))
        preview_path = Path(args.preview)
        preview_path.parent.mkdir(parents=True, exist_ok=True)
        preview.convert("RGB").save(preview_path, quality=92)
    print(json.dumps({"output": str(output), "preview": args.preview, "size": draw_size, "font_size": size, "preset": args.preset}))


if __name__ == "__main__":
    main()
