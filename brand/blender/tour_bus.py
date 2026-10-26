"""Overlap tour bus: the low-poly model the run screen drives along the tour route.

Flat brand inks only (base colours; the web app renders them unlit with ink outlines).
Ink body, Paper window band, Coral stripe, the Knockout Venn mark on both sides.
Wheels are separate objects named Wheel_* so the app can spin them.

Export (from the repo root):
  blender -b -P brand/blender/tour_bus.py
writes apps/web/public/models/tour-bus.glb
"""

import os

import bpy

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "apps", "web", "public", "models", "tour-bus.glb")
MARK = os.path.join(ROOT, "brand", "png", "mark", "overlap-mark-color-dark-512w.png")


def srgb(hex_):
    out = []
    for i in (0, 2, 4):
        c = int(hex_[i : i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (*out, 1.0)


bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(name, hex_):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = srgb(hex_)
    bsdf.inputs["Roughness"].default_value = 1.0
    return m


INK = mat("Ink", "111216")
INK2 = mat("Ink2", "2A2C33")
PAPER = mat("Paper", "F3F3F1")
CORAL = mat("Coral", "FF5A36")
STEEL = mat("Steel", "9C9EA5")

parts = []


def box(name, size, loc, material):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    ob = bpy.context.object
    ob.name = name
    ob.scale = size
    bpy.ops.object.transform_apply(scale=True)
    ob.data.materials.append(material)
    parts.append(ob)
    return ob


# Bus faces +X. Length 2.4, width 0.9, wheels sit on z=0.
L, W, H = 2.4, 0.9, 0.95
z0 = 0.18
body = box("Body", (L, W, H), (0, 0, z0 + H / 2), INK)
bev = body.modifiers.new("Bevel", "BEVEL")
bev.width = 0.05
bev.segments = 1
bpy.context.view_layer.objects.active = body
bpy.ops.object.modifier_apply(modifier="Bevel")

# Window band on both sides, split into panes by ink mullions.
band_z = z0 + H * 0.68
for side in (-1, 1):
    y = side * (W / 2 + 0.006)
    box(f"Band{side}", (L * 0.86, 0.012, 0.26), (-0.05, y, band_z), PAPER)
    for i in range(1, 6):
        x = -0.05 - L * 0.43 + i * (L * 0.86 / 6)
        box(f"Mullion{side}_{i}", (0.045, 0.016, 0.27), (x, y, band_z), INK)
    # Coral stripe low on the side, the tour livery.
    box(f"Stripe{side}", (L * 0.98, 0.012, 0.07), (0, y, z0 + 0.2), CORAL)

# Windshield and destination sign.
box("Windshield", (0.012, W * 0.82, 0.34), (L / 2 + 0.006, 0, band_z - 0.02), PAPER)
box("Sign", (0.012, W * 0.6, 0.09), (L / 2 + 0.006, 0, z0 + H - 0.1), CORAL)
box("Bumper", (0.06, W * 0.95, 0.08), (L / 2 + 0.02, 0, z0 + 0.06), STEEL)

# Roof rack.
box("Roof", (L * 0.55, W * 0.7, 0.07), (-0.25, 0, z0 + H + 0.035), INK2)

# The mark on both sides: an image plane with alpha.
mark = bpy.data.materials.new("Mark")
mark.use_nodes = True
nt = mark.node_tree
bsdf = nt.nodes["Principled BSDF"]
bsdf.inputs["Roughness"].default_value = 1.0
tex = nt.nodes.new("ShaderNodeTexImage")
tex.image = bpy.data.images.load(MARK)
nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
nt.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
try:
    mark.surface_render_method = "BLENDED"
except AttributeError:
    mark.blend_method = "BLEND"
mw, mh = 0.5, 0.5 * 62 / 92
for side in (-1, 1):
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0.35, side * (W / 2 + 0.014), z0 + 0.42), rotation=(1.5708, 0, 0 if side < 0 else 3.14159))
    ob = bpy.context.object
    ob.name = f"Mark{side}"
    ob.scale = (mw, mh, 1)
    bpy.ops.object.transform_apply(scale=True)
    ob.data.materials.append(mark)
    parts.append(ob)

# Wheels: Ink tyres with Paper hubs, separate objects for spinning.
r = 0.17
for i, x in enumerate((-L * 0.32, L * 0.3)):
    for side in (-1, 1):
        # Tyre and hub joined into one mesh with rotation applied, so the axle is the object's local Y
        # (three.js local Z after the Y-up export) and the app can spin it with rotation.z.
        loc = (x, side * (W / 2 - 0.02), r)
        bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=r, depth=0.12, location=loc, rotation=(1.5708, 0, 0))
        wheel = bpy.context.object
        wheel.data.materials.append(INK2)
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=r * 0.45, depth=0.125, location=loc, rotation=(1.5708, 0, 0))
        hub = bpy.context.object
        hub.data.materials.append(PAPER)
        bpy.ops.object.select_all(action="DESELECT")
        wheel.select_set(True)
        hub.select_set(True)
        bpy.context.view_layer.objects.active = wheel
        bpy.ops.object.join()
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        wheel.name = f"Wheel_{i}_{'L' if side < 0 else 'R'}"

# Join the static body parts into one mesh; wheels stay separate.
bpy.ops.object.select_all(action="DESELECT")
for p in parts:
    p.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.join()
body.name = "Bus"

os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_apply=True, export_yup=True)
print("EXPORTED", OUT)
