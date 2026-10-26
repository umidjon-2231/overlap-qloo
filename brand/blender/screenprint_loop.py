"""Overlap waiting-screen loop: a screen-print pull.

An Ink tour shirt sits under a print screen. The squeegee pulls across and the
Knockout Venn mark prints through in Paper and Coral. The screen lifts, the
shirt slides off, a blank one slides in, and the loop starts again.

Flat brand inks (emission only, Standard view transform) with Freestyle ink
lines, so it reads as a printed illustration rather than glossy 3D.

Render (from the repo root):
  blender -b -P brand/blender/screenprint_loop.py -- <out_dir> --render [--transparent]
writes <out_dir>/frame_0001.png ... (72 frames, 24 fps, 960x600, Paper ground or alpha).
Encode for apps/web/public/motion: WebM VP9 with alpha (yuva420p) plus an MP4 composited on Paper.
"""

import math
import os
import sys

import bpy

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else os.path.join(ROOT, "brand", "blender", "out")
MARK = os.path.join(ROOT, "brand", "png", "mark", "overlap-mark-color-dark-1024w.png")

FRAMES = 72


def srgb(hex_):
    """Hex sRGB to linear RGBA, so emission colours land on the exact brand values."""
    out = []
    for i in (0, 2, 4):
        c = int(hex_[i : i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (*out, 1.0)


INK = srgb("111216")
INK_2 = srgb("2A2C33")
PAPER = srgb("F3F3F1")
CORAL = srgb("FF5A36")
STEEL = srgb("9C9EA5")
RULE = srgb("CFCFC9")

# ---------- scene ----------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 960
scene.render.resolution_y = 600
scene.render.fps = 24
scene.frame_start = 1
scene.frame_end = FRAMES
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
# --transparent renders RGBA for an alpha WebM, so the loop sits on any page ground without a box.
scene.render.film_transparent = "--transparent" in sys.argv
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA" if scene.render.film_transparent else "RGB"
scene.render.filepath = os.path.join(OUT, "frame_")
try:
    scene.eevee.taa_render_samples = 16
except AttributeError:
    pass

world = bpy.data.worlds.new("Paper")
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs["Color"].default_value = PAPER
bg.inputs["Strength"].default_value = 1.0
scene.world = world

# Freestyle: thin ink outlines on silhouettes and creases, like a printed drawing.
scene.render.use_freestyle = True
scene.render.line_thickness_mode = "ABSOLUTE"
scene.render.line_thickness = 1.6
fs = scene.view_layers[0].freestyle_settings
lineset = fs.linesets[0] if len(fs.linesets) else fs.linesets.new("Ink")
if lineset.linestyle is None:
    lineset.linestyle = bpy.data.linestyles.new("InkLine")
lineset.select_by_visibility = True
lineset.select_silhouette = True
lineset.select_border = True
lineset.select_crease = True
lineset.linestyle.color = INK[:3]
lineset.linestyle.thickness = 1.6


def flat(name, color):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = color
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(em.outputs[0], out.inputs[0])
    return mat


def box(name, size, loc, mat, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    ob = bpy.context.object
    ob.name = name
    ob.scale = size
    bpy.ops.object.transform_apply(scale=True)
    ob.data.materials.append(mat)
    if parent:
        ob.parent = parent
    return ob


def key(ob, path, frame, value, interp="BEZIER"):
    bpy.context.preferences.edit.keyframe_new_interpolation_type = interp
    setattr(ob, path, value) if not isinstance(value, tuple) else setattr(ob, path, value)
    ob.keyframe_insert(data_path=path, frame=frame)


# ---------- the shirt (flat T silhouette, extruded a little) ----------
def shirt_mesh():
    import bmesh

    # Outline in metres, centred, chest at y=0. Front view of a tee laid flat.
    pts = [
        (-0.55, -1.30), (0.55, -1.30), (0.55, 0.55), (0.95, 0.30), (1.15, 0.70),
        (0.62, 1.10), (0.28, 1.15), (0.0, 0.98), (-0.28, 1.15), (-0.62, 1.10),
        (-1.15, 0.70), (-0.95, 0.30), (-0.55, 0.55),
    ]
    me = bpy.data.meshes.new("Shirt")
    bm = bmesh.new()
    verts = [bm.verts.new((x, y, 0.0)) for x, y in pts]
    face = bm.faces.new(verts)
    ext = bmesh.ops.extrude_face_region(bm, geom=[face])
    top = [v for v in ext["geom"] if isinstance(v, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=top, vec=(0, 0, 0.04))
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("Shirt", me)
    scene.collection.objects.link(ob)
    ob.data.materials.append(flat("ShirtInk", INK))
    return ob


shirt = shirt_mesh()

# The print: the mark image on a plane over the chest, revealed left to right by the squeegee.
print_w, print_h = 0.92, 0.92 * 62 / 92
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0.05, 0.045))
plate = bpy.context.object
plate.name = "Print"
plate.scale = (print_w, print_h, 1)
bpy.ops.object.transform_apply(scale=True)
plate.parent = shirt

pm = bpy.data.materials.new("PrintInk")
pm.use_nodes = True
try:
    pm.surface_render_method = "BLENDED"
except AttributeError:
    pm.blend_method = "BLEND"
nt = pm.node_tree
nt.nodes.clear()
tex = nt.nodes.new("ShaderNodeTexImage")
tex.image = bpy.data.images.load(MARK)
tex.interpolation = "Linear"
uv = nt.nodes.new("ShaderNodeTexCoord")
sep = nt.nodes.new("ShaderNodeSeparateXYZ")
reveal = nt.nodes.new("ShaderNodeValue")
reveal.name = "Reveal"
reveal.outputs[0].default_value = 0.0
less = nt.nodes.new("ShaderNodeMath")
less.operation = "LESS_THAN"
mul = nt.nodes.new("ShaderNodeMath")
mul.operation = "MULTIPLY"
em = nt.nodes.new("ShaderNodeEmission")
tr = nt.nodes.new("ShaderNodeBsdfTransparent")
mix = nt.nodes.new("ShaderNodeMixShader")
out = nt.nodes.new("ShaderNodeOutputMaterial")
nt.links.new(uv.outputs["UV"], sep.inputs[0])
nt.links.new(sep.outputs["X"], less.inputs[0])
nt.links.new(reveal.outputs[0], less.inputs[1])
nt.links.new(tex.outputs["Alpha"], mul.inputs[0])
nt.links.new(less.outputs[0], mul.inputs[1])
nt.links.new(tex.outputs["Color"], em.inputs["Color"])
nt.links.new(mul.outputs[0], mix.inputs["Fac"])
nt.links.new(tr.outputs[0], mix.inputs[1])
nt.links.new(em.outputs[0], mix.inputs[2])
nt.links.new(mix.outputs[0], out.inputs[0])
plate.data.materials.append(pm)

# ---------- the press: screen frame, squeegee, ink bead ----------
steel = flat("Steel", STEEL)
rule = flat("Mesh", RULE)
ink2 = flat("Rubber", INK_2)
paper = flat("Handle", PAPER)
coral = flat("CoralInk", CORAL)

press = bpy.data.objects.new("Press", None)
scene.collection.objects.link(press)
fw, fh, bar = 1.55, 1.25, 0.07
box("FrameTop", (fw, bar, 0.06), (0, fh / 2 + 0.05, 0), steel, press)
box("FrameBottom", (fw, bar, 0.06), (0, -fh / 2 + 0.05, 0), steel, press)
box("FrameLeft", (bar, fh, 0.06), (-fw / 2, 0.05, 0), steel, press)
box("FrameRight", (bar, fh, 0.06), (fw / 2, 0.05, 0), steel, press)

squeegee = bpy.data.objects.new("Squeegee", None)
squeegee.parent = press
scene.collection.objects.link(squeegee)
box("Blade", (0.05, 1.05, 0.16), (0, 0.05, 0.06), ink2, squeegee)
box("Grip", (0.11, 1.15, 0.12), (0, 0.05, 0.19), paper, squeegee)
bpy.ops.mesh.primitive_cylinder_add(radius=0.035, depth=1.0, location=(0.07, 0.05, 0.02), rotation=(math.pi / 2, 0, 0))
bead = bpy.context.object
bead.name = "InkBead"
bead.data.materials.append(coral)
bead.parent = squeegee

# ---------- camera: orthographic, looking down at a press-bench angle ----------
cam_data = bpy.data.cameras.new("Cam")
cam_data.type = "ORTHO"
cam_data.ortho_scale = 4.6
cam = bpy.data.objects.new("Cam", cam_data)
scene.collection.objects.link(cam)
cam.location = (2.2, -3.6, 7.0)
aim = bpy.data.objects.new("Aim", None)
scene.collection.objects.link(aim)
aim.location = (0, -0.05, 0.2)
track = cam.constraints.new("TRACK_TO")
track.target = aim
track.track_axis = "TRACK_NEGATIVE_Z"
track.up_axis = "UP_Y"
scene.camera = cam

# ---------- animation ----------
x0, x1 = -print_w / 2 - 0.08, print_w / 2 + 0.08
down, up = 0.12, 0.85

# Press: down from frame 1, lifts after the pull, comes back down for the next shirt.
for f, z, interp in [(1, down, "BEZIER"), (44, down, "BEZIER"), (52, up, "BEZIER"), (64, up, "BEZIER"), (72, down, "BEZIER")]:
    key(press, "location", f, (0, 0, z), interp)

# Squeegee: pull across 6-40, then travel back while the screen is up.
for f, x, interp in [(1, x0, "BEZIER"), (6, x0, "LINEAR"), (40, x1, "BEZIER"), (52, x1, "BEZIER"), (64, x0, "BEZIER"), (72, x0, "BEZIER")]:
    key(squeegee, "location", f, (x, 0, 0), interp)

# Shirt: centred, slides out right, jumps off-screen left (one frame, unseen), slides back in.
for f, x, interp in [(1, 0.0, "BEZIER"), (52, 0.0, "BEZIER"), (60, 4.2, "LINEAR"), (61, -4.2, "BEZIER"), (70, 0.0, "BEZIER"), (72, 0.0, "BEZIER")]:
    key(shirt, "location", f, (x, 0, 0), interp)

# Print reveal tracks the blade's leading edge; it resets while the shirt is off-screen.
for f, v, interp in [(1, 0.0, "LINEAR"), (7, 0.0, "LINEAR"), (40, 1.0, "LINEAR"), (60, 1.0, "LINEAR"), (61, 0.0, "LINEAR")]:
    bpy.context.preferences.edit.keyframe_new_interpolation_type = interp
    reveal.outputs[0].default_value = v
    reveal.outputs[0].keyframe_insert("default_value", frame=f)

os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, "brand", "blender", "screenprint_loop.blend"))
if "--render" in sys.argv:
    bpy.ops.render.render(animation=True)
