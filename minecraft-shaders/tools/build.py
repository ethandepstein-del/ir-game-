#!/usr/bin/env python3
"""Generate the per-dimension program stubs, validate, and zip the pack.

    python3 tools/build.py            # regenerate stubs + build dist/Clarity-<version>.zip
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
    "prepare":               ("prepare_clouds", []),
    "deferred":              ("deferred", []),
    "deferred1":             ("deferred_temporal", []),
    "deferred2":             ("deferred_atrous_first", []),
    "deferred3":             ("deferred_atrous_wide", ["ATROUS_STEP 2"]),
    "deferred4":             ("deferred_atrous_wide", ["ATROUS_STEP 4"]),
    "deferred5":             ("deferred_apply", []),
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
# The overworld shadow pass writes the voxel grid with imageAtomicMax.
COMPAT430 = "#version 430 compatibility"
VERSION_OVERRIDES = {("", "shadow"): COMPAT430}
# Programs that read the integer voxel image (usampler3D / texelFetch).
for _folder in ("", "world-1", "world1"):
    for _name in ("deferred", "deferred1", "deferred2", "deferred3", "deferred4", "deferred5", "composite1"):
        VERSION_OVERRIDES[(_folder, _name)] = COMPAT430


# Extensions a program's stage needs, placed right after #version.
# composite3 meters exposure from mip levels in its vertex stage.
EXTENSIONS = {("composite3", "vsh"): ["#extension GL_ARB_shader_texture_lod : enable"]}


def write_stubs():
    for folder, dim_defines in DIMENSIONS.items():
        out_dir = os.path.join(SHADERS, folder)
        os.makedirs(out_dir, exist_ok=True)
        for name, (program, defines) in PROGRAMS.items():
            for stage, ext in (("VSH", "vsh"), ("FSH", "fsh")):
                lines = [VERSION_OVERRIDES.get((folder, name), "#version 120")]
                lines += EXTENSIONS.get((name, ext), [])
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


def write_compute():
    """deferred.csh: the barrier pass (overworld only; RT is overworld only)."""
    lines = ["#version 430", '#include "/program/deferred_barrier.glsl"']
    with open(os.path.join(SHADERS, "deferred.csh"), "w") as f:
        f.write("\n".join(lines) + "\n")


def check_compute():
    tool = shutil.which("glslangValidator")
    with tempfile.TemporaryDirectory() as tmp:
        src = expand(os.path.join(SHADERS, "deferred.csh"))
        path = os.path.join(tmp, "s.comp")
        with open(path, "w") as f:
            f.write(src)
        r = subprocess.run([tool, "-S", "comp", path], capture_output=True, text=True)
        if r.returncode != 0:
            print("FAIL deferred.csh")
            print(r.stdout.strip())
            return 1
    return 0


# Bump on every release. It is baked into the zip name (so a new download
# never lands as "Clarity (1).zip" next to an old copy) and shown in the
# shader options menu, so players can see which build is actually loaded.
VERSION = "2.2"


def build_zip():
    dist = os.path.join(ROOT, "dist")
    os.makedirs(dist, exist_ok=True)
    for old in os.listdir(dist):
        if old.startswith("Clarity") and old.endswith(".zip"):
            os.remove(os.path.join(dist, old))
    out = os.path.join(dist, "Clarity-%s.zip" % VERSION)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for base, _, files in os.walk(PACK):
            for fn in sorted(files):
                full = os.path.join(base, fn)
                z.write(full, os.path.relpath(full, PACK))
    print("wrote", os.path.relpath(out, ROOT))


if __name__ == "__main__":
    write_stubs()
    write_compute()
    if "--check" in sys.argv:
        failed = check_compute() + check() + check(("MC_RENDER_STAGE_STARS 5", "IS_IRIS")) + check(("RT_GI", "IS_IRIS"))
        if failed:
            sys.exit("%d program(s) failed to compile" % failed)
        print("all programs compile")
    build_zip()
