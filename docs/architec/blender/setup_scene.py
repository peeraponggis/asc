# -*- coding: utf-8 -*-
"""ฉาก render อัตโนมัติใน Blender (Phase 2B) — รันด้วย Blender เอง ไม่ใช่ Python ทั่วไป (โดย ลุงพี)

  # โมเดลจาก ASC Studio (3d.glb) → ภาพ render + ไฟล์ .blend
  blender -b -P blender\\setup_scene.py -- --glb "<โครงการ>\\3d.glb" --out "<โครงการ>\\render.png" --save "<โครงการ>\\scene.blend"

  # สร้างไฟล์แม่แบบ (ไม่ต้องมีโมเดล): บ้าน / โรงงาน พร้อมแผงบนหลังคา
  blender -b -P blender\\setup_scene.py -- --template house   --save 3d_models\\templates\\house_template.blend
  blender -b -P blender\\setup_scene.py -- --template factory --save 3d_models\\templates\\factory_template.blend

ตัวเลือก: --engine EEVEE|CYCLES (ค่าเริ่ม EEVEE — เครื่อง home RAM 8 GB) · --res 1920x1080 · --samples 64
          --hdri ไฟล์.hdr (ไม่ใส่ = ท้องฟ้าจำลองในตัว ไม่ต้องดาวน์โหลด) · --sun-el 45 --sun-az 135 · --view 225/35 (ทิศกล้อง/มุมก้ม)
          --restyle  ทาสีวัสดุใหม่ตามชื่อวัตถุ (แผง/หลังคา/ผนัง) แทนสีจาก glb
"""
import argparse
import math
import sys

import bpy
from mathutils import Vector


def args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser(prog="setup_scene.py")
    ap.add_argument("--glb")
    ap.add_argument("--template", choices=["house", "factory"])
    ap.add_argument("--out")
    ap.add_argument("--save")
    ap.add_argument("--engine", default="EEVEE", choices=["EEVEE", "CYCLES"])
    ap.add_argument("--res", default="1920x1080")
    ap.add_argument("--samples", type=int, default=64)
    ap.add_argument("--hdri")
    ap.add_argument("--sun-el", type=float, default=45.0)
    ap.add_argument("--sun-az", type=float, default=135.0)
    ap.add_argument("--view", default="225/35")
    ap.add_argument("--restyle", action="store_true")
    return ap.parse_args(argv)


# ------------------------------------------------------------------ วัสดุ
def material(name, color, metallic=0.0, roughness=0.5, transmission=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*color, 1.0)
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Roughness"].default_value = roughness
    for key in ("Transmission Weight", "Transmission"):          # ชื่อช่องเปลี่ยนใน Blender 4.0
        if key in b.inputs:
            b.inputs[key].default_value = transmission
            break
    return m


MATS = {}


def mats():
    if not MATS:
        MATS.update({
            "pv": material("PV ผิวแผง", (0.02, 0.04, 0.10), 0.3, 0.12),
            "frame": material("PV กรอบอลูมิเนียม", (0.75, 0.76, 0.78), 1.0, 0.3),
            "roof": material("หลังคาเมทัลชีท", (0.55, 0.58, 0.62), 0.8, 0.35),
            "wall": material("ผนังทาสีขาว", (0.86, 0.84, 0.80), 0.0, 0.8),
            "glass": material("กระจก", (0.8, 0.9, 1.0), 0.0, 0.0, 1.0),
            "ground": material("พื้นหญ้า", (0.16, 0.30, 0.10), 0.0, 0.95),
            "concrete": material("คอนกรีต", (0.52, 0.52, 0.50), 0.0, 0.9),
        })
    return MATS


def restyle(objs):
    m = mats()
    for o in objs:
        n = o.name.lower()
        key = ("pv" if any(k in n for k in ("pv", "panel", "module", "แผง")) else
               "roof" if any(k in n for k in ("roof", "หลังคา")) else
               "glass" if "glass" in n or "window" in n else
               "wall" if any(k in n for k in ("wall", "building", "อาคาร")) else None)
        if key and o.type == "MESH":
            o.data.materials.clear()
            o.data.materials.append(m[key])


# ------------------------------------------------------------------ โมเดลแม่แบบ
def box(name, size, loc, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    o.data.materials.append(mat)
    return o


def gable_roof(name, w, d, h, z, overhang, mat):
    """หลังคาจั่ว: สันตามแกน x · ลาดลงเหนือ/ใต้"""
    x, y = w / 2 + overhang, d / 2 + overhang
    verts = [(-x, -y, z), (x, -y, z), (x, 0, z + h), (-x, 0, z + h), (-x, y, z), (x, y, z)]
    faces = [(0, 1, 2, 3), (3, 2, 5, 4)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    me.materials.append(mat)
    mod = o.modifiers.new("หนา", "SOLIDIFY")
    mod.thickness = 0.05
    return o, math.atan2(h, y)


def pv_array(name, origin, tilt_rad, rows, cols, m=mats):
    """แผง 1.134 × 2.278 ม. แนวตั้ง วางบนลาดหลังคาด้านใต้ (−y)"""
    mm = m()
    pw, pl, gap = 1.134, 2.278, 0.02
    objs = []
    for r in range(rows):
        for c in range(cols):
            x = origin[0] + c * (pw + gap)
            s = r * (pl + gap) + pl / 2
            y = origin[1] + math.cos(tilt_rad) * s
            z = origin[2] + math.sin(tilt_rad) * s + 0.08
            bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, z))
            o = bpy.context.active_object
            o.name = f"{name}_{r}_{c}"
            o.scale = (pw, pl, 0.035)
            o.rotation_euler = (tilt_rad, 0, 0)                 # ยกขึ้นทางเหนือ ตามลาดหลังคาด้านใต้
            o.data.materials.append(mm["pv"])
            objs.append(o)
    return objs


def template(kind):
    m = mats()
    if kind == "house":
        w, d, hw, rh = 10.0, 8.0, 3.0, 1.6
        box("อาคาร", (w, d, hw), (0, 0, hw / 2), m["wall"])
        roof, tilt = gable_roof("หลังคา", w, d, rh, hw, 0.6, m["roof"])
        pv_array("แผง", (-w / 2 + 1.0, -(d / 2 + 0.6) + 0.4, hw), tilt, 2, 7)
    else:
        w, d, hw, rh = 40.0, 24.0, 8.0, 2.6
        box("อาคาร", (w, d, hw), (0, 0, hw / 2), m["wall"])
        roof, tilt = gable_roof("หลังคา", w, d, rh, hw, 0.8, m["roof"])
        pv_array("แผง", (-w / 2 + 1.5, -(d / 2 + 0.8) + 0.6, hw), tilt, 4, 30)
    box("ลานคอนกรีต", (w + 16, d + 16, 0.1), (0, 0, 0.05), m["concrete"])


# ------------------------------------------------------------------ ฉาก
def world(hdri, sun_el, sun_az):
    w = bpy.data.worlds.get("World") or bpy.data.worlds.new("World")
    bpy.context.scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    if hdri:
        env = nt.nodes.new("ShaderNodeTexEnvironment")
        env.image = bpy.data.images.load(hdri)
        nt.links.new(env.outputs["Color"], bg.inputs["Color"])
    else:
        sky = nt.nodes.new("ShaderNodeTexSky")
        for t in ("NISHITA", "MULTIPLE_SCATTERING", "HOSEK_WILKIE"):   # ชื่อชนิดฟ้าต่างกันตามรุ่น Blender
            try:
                sky.sky_type = t
                break
            except TypeError:
                continue
        if hasattr(sky, "sun_elevation"):
            sky.sun_elevation = math.radians(sun_el)
            sky.sun_rotation = math.radians(sun_az)
        nt.links.new(sky.outputs["Color"], bg.inputs["Color"])
        bg.inputs["Strength"].default_value = 0.35
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
    ld = bpy.data.lights.new("ดวงอาทิตย์", "SUN")
    ld.energy = 4.0
    ld.angle = math.radians(0.6)
    sun = bpy.data.objects.new("ดวงอาทิตย์", ld)
    bpy.context.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(90 - sun_el), 0, math.radians(sun_az))


def scene_bounds(objs):
    pts = [o.matrix_world @ Vector(c) for o in objs if o.type == "MESH" for c in o.bound_box]
    if not pts:
        return Vector((0, 0, 0)), 10.0
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return (lo + hi) / 2, max((hi - lo).length, 1.0)


def ground(center, size):
    bpy.ops.mesh.primitive_plane_add(size=size * 6, location=(center.x, center.y, -0.01))
    g = bpy.context.active_object
    g.name = "พื้นดิน"
    g.data.materials.append(mats()["ground"])


def camera(center, size, view):
    az, el = (float(v) for v in view.split("/"))
    cd = bpy.data.cameras.new("กล้อง")
    cd.lens = 35
    cam = bpy.data.objects.new("กล้อง", cd)
    bpy.context.collection.objects.link(cam)
    dist = size * 1.35
    cam.location = center + Vector((math.sin(math.radians(az)) * math.cos(math.radians(el)),
                                    math.cos(math.radians(az)) * math.cos(math.radians(el)),
                                    math.sin(math.radians(el)))) * dist
    target = bpy.data.objects.new("เป้ากล้อง", None)
    target.location = center
    bpy.context.collection.objects.link(target)
    c = cam.constraints.new("TRACK_TO")
    c.target = target
    c.track_axis = "TRACK_NEGATIVE_Z"
    c.up_axis = "UP_Y"
    bpy.context.scene.camera = cam


def render_settings(a):
    sc = bpy.context.scene
    if a.engine == "CYCLES":
        sc.render.engine = "CYCLES"
        sc.cycles.samples = a.samples
        sc.cycles.use_denoising = True
    else:
        for eng in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):          # 4.2–4.x ใช้ _NEXT · รุ่นอื่นใช้ชื่อเดิม
            try:
                sc.render.engine = eng
                break
            except TypeError:
                continue
    w, h = (int(v) for v in a.res.lower().split("x"))
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = "PNG"
    sc.view_settings.view_transform = "AgX" if "AgX" in [i.identifier for i in sc.view_settings.bl_rna.properties["view_transform"].enum_items] else "Filmic"


def main():
    a = args()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if a.glb:
        bpy.ops.import_scene.gltf(filepath=a.glb)
        if a.restyle:
            restyle(bpy.context.scene.objects)
    elif a.template:
        template(a.template)
    else:
        print("ต้องใส่ --glb หรือ --template")
        sys.exit(2)
    objs = list(bpy.context.scene.objects)
    center, size = scene_bounds(objs)
    ground(center, size)
    world(a.hdri, a.sun_el, a.sun_az)
    camera(center, size, a.view)
    render_settings(a)
    if a.save:
        bpy.ops.wm.save_as_mainfile(filepath=a.save)
        print(f"บันทึก {a.save}")
    if a.out:
        bpy.context.scene.render.filepath = a.out
        bpy.ops.render.render(write_still=True)
        print(f"render {a.out}")


if __name__ == "__main__":
    main()
