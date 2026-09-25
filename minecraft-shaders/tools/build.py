#!/usr/bin/env python3
"""Generate the per-dimension program stubs, validate, and zip the pack.

    python3 tools/build.py            # regenerate stubs + build dist/Clarity.zip
    python3 tools/build.py --check    # also compile every program with glslangValidator

The real shader code lives in shaders/program and shaders/lib. Each stub in
shaders/, shaders/world-1 (Nether) and shaders/world1 (End) only sets a few
defines and includes the program, which is how OptiFine and Iris both pick a
program per dimension.
"""
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACK = os.path.join(ROOT, "Clarity")
SHADERS = os.path.join(PACK, "shaders")

# name -> (program file, extra defines)
PROGRAMS = {
    "shadow":                ("shadow", []),
    "gbuffers_basic":        ("gbuffers_basic", []),
    "gbuffers_textured":     ("gbuffers_textured", []),
    "gbuffers_textured_lit": ("gbuffers_textured", []),
    "gbuffers_damagedblock": ("gbuffers_textured", ["DAMAGED"]),
    "gbuffers_weather":      ("gbuffers_textured", ["WEATHER"]),
    "gbuffers_terrain":      ("gbuffers_lit", ["TERRAIN"]),
    "gbuffers_block":        ("gbuffers_lit", ["BLOCK"]),
    "gbuffers_entities":     ("gbuffers_lit", ["ENTITIES"]),
    "gbuffers_hand":         ("gbuffers_lit", ["HAND"]),
    "gbuffers_hand_water":   ("gbuffers_lit", ["HAND"]),
    "gbuffers_water":        ("gbuffers_water", []),
    "gbuffers_skybasic":     ("gbuffers_skybasic", []),
    "gbuffers_skytextured":  ("gbuffers_skytextured", []),
    "gbuffers_clouds":       ("gbuffers_clouds", []),
    "gbuffers_armor_glint":  ("gbuffers_emissive", []),
    "gbuffers_spidereyes":   ("gbuffers_emissive", ["GLOW_BOOST 1.5"]),
    "gbuffers_beaconbeam":   ("gbuffers_emissive", ["GLOW_BOOST 1.5"]),
    "deferred":              ("deferred", []),
    "deferred1":             ("deferred_atrous", ["ATROUS_STEP 1"]),
    "deferred2":             ("deferred_atrous", ["ATROUS_STEP 2"]),
    "deferred3":             ("deferred_atrous", ["ATROUS_STEP 4"]),
    "deferred4":             ("deferred_apply", []),
    "composite":             ("composite", []),
    "composite1":            ("composite1", []),
    "composite2":            ("composite2", []),
    "composite3":            ("composite3", []),
    "final":                 ("final", []),
}

DIMENSIONS = {
    "": ["OVERWORLD"],
    "world-1": ["NETHER", "NO_SHADOW"],
    "world1": ["END", "NO_SHADOW"],
}


# Programs that need a newer GLSL version in a given dimension folder.
# The overworld shadow pass writes the voxel grid with imageStore.
VERSION_OVERRIDES = {("", "shadow"): "#version 430 compatibility"}


def write_stubs():
    for folder, dim_defines in DIMENSIONS.items():
        out_dir = os.path.join(SHADERS, folder)
        os.makedirs(out_dir, exist_ok=True)
        for name, (program, defines) in PROGRAMS.items():
            for stage, ext in (("VSH", "vsh"), ("FSH", "fsh")):
                lines = [VERSION_OVERRIDES.get((folder, name), "#version 120")]
                lines += ["#define " + d for d in dim_defines + [stage] + defines]
                lines.append('#include "/program/%s.glsl"' % program)
                with open(os.path.join(out_dir, "%s.%s" % (name, ext)), "w") as f:
                    f.write("\n".join(lines) + "\n")


INCLUDE = re.compile(r'^\s*#include\s+"(/[^"]+)"\s*$', re.M)


def expand(path, seen=()):
    with open(path) as f:
        src = f.read()

    def repl(m):
        inc = os.path.join(SHADERS, m.group(1).lstrip("/"))
        return expand(inc, seen + (path,))

    return INCLUDE.sub(repl, src)


def check(extra_defines=()):
    tool = shutil.which("glslangValidator")
    if not tool:
        sys.exit("glslangValidator not found (apt install glslang-tools)")
    failures = 0
    with tempfile.TemporaryDirectory() as tmp:
        for folder in DIMENSIONS:
            for name in PROGRAMS:
                for ext, stage in (("vsh", "vert"), ("fsh", "frag")):
                    stub = os.path.join(SHADERS, folder, "%s.%s" % (name, ext))
                    src = expand(stub)
                    if extra_defines:
                        head, rest = src.split("\n", 1)
                        src = head + "\n" + "".join("#define %s\n" % d for d in extra_defines) + rest
                    tmp_file = os.path.join(tmp, "s." + stage)
                    with open(tmp_file, "w") as f:
                        f.write(src)
                    r = subprocess.run([tool, "-S", stage, tmp_file], capture_output=True, text=True)
                    if r.returncode != 0:
                        failures += 1
                        print("FAIL %s/%s.%s %s" % (folder or ".", name, ext, extra_defines))
                        print(r.stdout.strip())
    return failures


def build_zip():
    dist = os.path.join(ROOT, "dist")
    os.makedirs(dist, exist_ok=True)
    out = os.path.join(dist, "Clarity.zip")
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for base, _, files in os.walk(PACK):
            for fn in sorted(files):
                full = os.path.join(base, fn)
                z.write(full, os.path.relpath(full, PACK))
    print("wrote", os.path.relpath(out, ROOT))


if __name__ == "__main__":
    write_stubs()
    if "--check" in sys.argv:
        failed = check() + check(("MC_RENDER_STAGE_STARS 5", "IS_IRIS")) + check(("RT_GI", "IS_IRIS"))
        if failed:
            sys.exit("%d program(s) failed to compile" % failed)
        print("all programs compile")
    build_zip()
