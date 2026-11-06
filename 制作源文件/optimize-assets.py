"""Build static-site images from the four independent V2 cinematic originals.

Usage: python optimize-assets.py [--quality 84]

The four equally sized native images are not enlarged or cropped. HTTP reads one
scene at a time; file:// uses the WebP atlas embedded in atlas-data.js.
Do not regenerate a redundant lossless atlas inside the deployment directory.
"""

import argparse
import base64
import io
import json
from pathlib import Path

from PIL import Image, features


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--quality", type=int, default=84)
    args = parser.parse_args()
    if not 1 <= args.quality <= 100:
        parser.error("--quality must be between 1 and 100")
    if not features.check("webp"):
        raise RuntimeError("This Pillow installation does not support WebP")

    project = Path(__file__).resolve().parents[1]
    source = project / "video-v2" / "images"
    assets = project / "site" / "dist" / "assets"
    names = ("tower-wide.png", "street-wide.png", "river-wide.png", "peel-wide.png")
    scenes = []
    for name in names:
        with Image.open(source / name) as image:
            image.load()
            scenes.append(image.convert("RGB"))
    size = scenes[0].size
    if any(image.size != size for image in scenes):
        raise ValueError("Four native source images must have equal dimensions")

    width, height = size
    atlas = Image.new("RGB", (width * 2, height * 2))
    for index, image in enumerate(scenes):
        atlas.paste(image, (index % 2 * width, index // 2 * height))

    outputs = [(f"scene-{index}.webp", image) for index, image in enumerate(scenes)]
    outputs.append(("jiangmen-atlas.webp", atlas))
    report = {
        "generation": "V2 independent AI cinematic images",
        "quality": args.quality,
        "method": 6,
        "native_scene_size": list(size),
        "resampled": False,
        "sources": list(names),
        "files": [],
    }
    for name, image in outputs:
        target = assets / name
        image.save(target, "WEBP", quality=args.quality, method=6)
        with Image.open(target) as encoded:
            encoded.load()
            if encoded.size != image.size or encoded.format != "WEBP":
                raise RuntimeError(f"Invalid generated image: {target}")
        report["files"].append({"name": name, "width": image.width, "height": image.height, "bytes": target.stat().st_size})

    webp_bytes = (assets / "jiangmen-atlas.webp").read_bytes()
    data_url = "data:image/webp;base64," + base64.b64encode(webp_bytes).decode("ascii")
    (assets / "atlas-data.js").write_text(
        "// Lazy-loaded only for file:// postcard export and collection effects.\n"
        "window.JIANGMEN_ATLAS_DATA = " + json.dumps(data_url) + ";\n",
        encoding="utf-8",
    )

    # Verify the offline data payload is byte-identical to HTTP's image.
    script = (assets / "atlas-data.js").read_text(encoding="utf-8")
    payload = json.loads(script.split(" = ", 1)[1].rstrip(";\n"))
    decoded = base64.b64decode(payload.split(",", 1)[1], validate=True)
    assert decoded == webp_bytes
    with Image.open(io.BytesIO(decoded)) as offline:
        assert offline.size == atlas.size
    report["offline_script_bytes"] = (assets / "atlas-data.js").stat().st_size
    report["redundant_png_in_deployment"] = False
    report["all_webp_bytes"] = sum(item["bytes"] for item in report["files"])
    report["offline_http_atlas_identical"] = True
    report_path = project / "制作源文件" / "web-assets-v2-report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
