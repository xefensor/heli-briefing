#!/usr/bin/env python3
"""Provision pinned static decoder assets for the optional browser experiment.

This downloads software from npm only, never weather data, and runs no package
installation hooks. Generated files stay in build-excluded web/data.
"""

from __future__ import annotations

import base64
import hashlib
import io
from pathlib import Path
import shutil
import tarfile
from urllib.request import Request, urlopen

HERE = Path(__file__).resolve().parent
REPOSITORY = HERE.parents[1]
OUTPUT = REPOSITORY / "web" / "data" / "ceiling-proof"
CACHE = REPOSITORY / ".cache" / "browser-ceiling"

PACKAGES = (
    {
        "name": "eccodes-wasm-2.48.2.tgz",
        "url": "https://registry.npmjs.org/@meri-imperiumi/eccodes-wasm/-/eccodes-wasm-2.48.2.tgz",
        "integrity": "Z7rD3xInomPG7FS97ORD1UGKAdgeeRP9ofa9k4m8d+k2sDfDQeAjTzvs9UOndyaZovaSbEQeIoNX8gTmQNhiSA==",
        "limit": 10_000_000,
        "files": {
            "package/build/eccodes/eccodes.js": "eccodes.js",
            "package/build/eccodes/eccodes.wasm": "eccodes.wasm",
            "package/build/eccodes/index.js": "wrapper.js",
            "package/LICENSE": "eccodes-LICENSE.txt",
        },
    },
    {
        "name": "wasm-bz2-0.3.0.tgz",
        "url": "https://registry.npmjs.org/@foxglove/wasm-bz2/-/wasm-bz2-0.3.0.tgz",
        "integrity": "MP18X3TbeoGT3Kfke7KrYin+5zESfcPnsdD2gaVviN1xzteoDDfVTZbVmbdfGrIV/qAAhBhBVbRcrN25rWSNOQ==",
        "limit": 2_000_000,
        "files": {
            "package/wasm/module.js": "bz2.js",
            "package/wasm/module.wasm": "module.wasm",
            "package/LICENSE": "bz2-LICENSE.txt",
        },
    },
)


def verified_archive(package: dict) -> bytes:
    cache = CACHE / package["name"]
    if cache.is_file():
        data = cache.read_bytes()
    else:
        request = Request(package["url"], headers={"User-Agent": "Heli-Briefing-ceiling-research/1"})
        with urlopen(request, timeout=45) as response:
            if response.geturl() != package["url"]:
                raise ValueError("Unexpected package download redirect")
            data = response.read(package["limit"] + 1)
    if len(data) > package["limit"]:
        raise ValueError(f"Package exceeds its download bound: {package['name']}")
    actual = base64.b64encode(hashlib.sha512(data).digest()).decode("ascii")
    if actual != package["integrity"]:
        raise ValueError(f"Package integrity mismatch: {package['name']}")
    CACHE.mkdir(parents=True, exist_ok=True)
    cache.write_bytes(data)
    return data


def setup() -> None:
    # Validate both archives before changing any existing working proof.
    archives = [(package, verified_archive(package)) for package in PACKAGES]
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for package, data in archives:
        with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as archive:
            # No extractall: only these exact, verified package members are read.
            for source, target in package["files"].items():
                member = archive.getmember(source)
                if not member.isfile() or member.size > 45_000_000:
                    raise ValueError(f"Unexpected package member: {source}")
                stream = archive.extractfile(member)
                if stream is None:
                    raise ValueError(f"Missing package member: {source}")
                (OUTPUT / target).write_bytes(stream.read())

    wrapper = OUTPUT / "wrapper.js"
    text = wrapper.read_text()
    before = "module.exports = { Eccodes, CodesHandle, EccodesError, createEccodes };"
    after = "self.CeilingProofWrapper = { Eccodes, CodesHandle, EccodesError, createEccodes };"
    if text.count(before) != 1:
        raise ValueError("Pinned ecCodes wrapper differs from the checked browser adapter")
    wrapper.write_text(text.replace(before, after))

    bzip = OUTPUT / "bz2.js"
    text = bzip.read_text()
    before = "Module.locateFile = function (input, prefix) {"
    after = "Module.locateFile = Module.locateFile || function (input, prefix) {"
    if text.count(before) != 1:
        raise ValueError("Pinned bzip2 loader differs from the checked browser adapter")
    bzip.write_text(text.replace(before, after))

    for name in ("index.html", "worker.js"):
        shutil.copyfile(HERE / name, OUTPUT / name)
    notices = (HERE / "THIRD_PARTY_NOTICES.md").read_text()
    for path in sorted((HERE / "licenses").glob("*.txt")):
        notices += f"\n\n--- {path.name} ---\n\n{path.read_text()}"
    (OUTPUT / "LICENSES.txt").write_text(notices)
    # Local assets are deliberately excluded from Git even before root updates
    # the repository-wide ignore policy; never hide source or documentation.
    (OUTPUT / ".gitignore").write_text("*\n")
    print(f"Prepared {OUTPUT}")
    print("Open /data/ceiling-proof/index.html in the existing project preview.")
    print("These generated decoder assets and the experiment are excluded from the application build.")


if __name__ == "__main__":
    setup()
