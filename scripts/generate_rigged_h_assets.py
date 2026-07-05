import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "assets" / "hunyuan" / "raw"


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)


def make_mat(name, color, roughness=0.82, metallic=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return mat


def box_mesh(name, dims, loc, mat, bone_name=None, armature=None, bevel=0.0):
    sx, sy, sz = [v * 0.5 for v in dims]
    x, y, z = loc
    verts = [
        (x - sx, y - sy, z - sz),
        (x + sx, y - sy, z - sz),
        (x + sx, y + sy, z - sz),
        (x - sx, y + sy, z - sz),
        (x - sx, y - sy, z + sz),
        (x + sx, y - sy, z + sz),
        (x + sx, y + sy, z + sz),
        (x - sx, y + sy, z + sz),
    ]
    faces = [
        (0, 1, 2, 3),
        (4, 7, 6, 5),
        (0, 4, 5, 1),
        (1, 5, 6, 2),
        (2, 6, 7, 3),
        (3, 7, 4, 0),
    ]
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.use_smooth = False

    if bevel > 0:
        bevel_mod = obj.modifiers.new("tiny_hard_bevel", "BEVEL")
        bevel_mod.width = bevel
        bevel_mod.segments = 1
        bevel_mod.affect = "EDGES"
        obj.modifiers.new("weighted_block_normals", "WEIGHTED_NORMAL")

    if bone_name and armature:
        vg = obj.vertex_groups.new(name=bone_name)
        vg.add(list(range(len(obj.data.vertices))), 1.0, "ADD")
        mod = obj.modifiers.new("Armature", "ARMATURE")
        mod.object = armature
        obj.parent = armature
    return obj


def wedge_mesh(name, verts, faces, mat, bone_name=None, armature=None):
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.use_smooth = False
    if bone_name and armature:
        vg = obj.vertex_groups.new(name=bone_name)
        vg.add(list(range(len(obj.data.vertices))), 1.0, "ADD")
        mod = obj.modifiers.new("Armature", "ARMATURE")
        mod.object = armature
        obj.parent = armature
    return obj


def oriented_box_mesh(name, dims, loc, mat, bone_name=None, armature=None, rotation=(0, 0, 0), bevel=0.0):
    sx, sy, sz = [v * 0.5 for v in dims]
    local_verts = [
        (-sx, -sy, -sz),
        (sx, -sy, -sz),
        (sx, sy, -sz),
        (-sx, sy, -sz),
        (-sx, -sy, sz),
        (sx, -sy, sz),
        (sx, sy, sz),
        (-sx, sy, sz),
    ]
    cx, cy, cz = loc
    rx, ry, rz = rotation
    crx, srx = math.cos(rx), math.sin(rx)
    cry, sry = math.cos(ry), math.sin(ry)
    crz, srz = math.cos(rz), math.sin(rz)

    def rotate(v):
        x, y, z = v
        y, z = y * crx - z * srx, y * srx + z * crx
        x, z = x * cry + z * sry, -x * sry + z * cry
        x, y = x * crz - y * srz, x * srz + y * crz
        return (x + cx, y + cy, z + cz)

    verts = [rotate(v) for v in local_verts]
    faces = [
        (0, 1, 2, 3),
        (4, 7, 6, 5),
        (0, 4, 5, 1),
        (1, 5, 6, 2),
        (2, 6, 7, 3),
        (3, 7, 4, 0),
    ]
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.use_smooth = False
    if bevel > 0:
        bevel_mod = obj.modifiers.new("tiny_hard_bevel", "BEVEL")
        bevel_mod.width = bevel
        bevel_mod.segments = 1
        bevel_mod.affect = "EDGES"
        obj.modifiers.new("weighted_block_normals", "WEIGHTED_NORMAL")
    if bone_name and armature:
        vg = obj.vertex_groups.new(name=bone_name)
        vg.add(list(range(len(obj.data.vertices))), 1.0, "ADD")
        mod = obj.modifiers.new("Armature", "ARMATURE")
        mod.object = armature
        obj.parent = armature
    return obj


def make_armature(name, bones):
    arm_data = bpy.data.armatures.new(f"{name}Armature")
    arm_data.display_type = "STICK"
    arm_obj = bpy.data.objects.new(name, arm_data)
    bpy.context.collection.objects.link(arm_obj)
    bpy.context.view_layer.objects.active = arm_obj
    arm_obj.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")

    edit_bones = {}
    for bone_name, head, tail, parent in bones:
        eb = arm_data.edit_bones.new(bone_name)
        eb.head = head
        eb.tail = tail
        eb.roll = 0
        edit_bones[bone_name] = eb
    for bone_name, _head, _tail, parent in bones:
        if parent:
            edit_bones[bone_name].parent = edit_bones[parent]
            edit_bones[bone_name].use_connect = False
    bpy.ops.object.mode_set(mode="OBJECT")
    return arm_obj


def set_pose(arm, frame, rotations=None, locations=None):
    rotations = rotations or {}
    locations = locations or {}
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="POSE")
    for pb in arm.pose.bones:
        pb.rotation_mode = "XYZ"
        if pb.name in rotations:
            pb.rotation_euler = rotations[pb.name]
        if pb.name in locations:
            pb.location = locations[pb.name]
        pb.keyframe_insert(data_path="rotation_euler", frame=frame)
        if pb.name in locations:
            pb.keyframe_insert(data_path="location", frame=frame)
    bpy.ops.object.mode_set(mode="OBJECT")


def create_action(arm, name, keys):
    action = bpy.data.actions.new(name)
    arm.animation_data_create()
    arm.animation_data.action = action
    for frame, rotations, locations in keys:
        set_pose(arm, frame, rotations, locations)
    action.frame_start = min(frame for frame, _rot, _loc in keys)
    action.frame_end = max(frame for frame, _rot, _loc in keys)
    # Blender 5.x stores action curves through layered action data. The glTF
    # exporter samples these actions, so default key interpolation is fine here.
    track = arm.animation_data.nla_tracks.new()
    track.name = name
    strip = track.strips.new(name, int(action.frame_start), action)
    strip.name = name
    strip.frame_end = action.frame_end
    track.mute = True
    arm.animation_data.action = None
    return action


def hero_materials():
    return {
        "skin": make_mat("skin_sunburnt", (0.86, 0.55, 0.34, 1.0)),
        "shadow": make_mat("skin_shadow", (0.57, 0.30, 0.19, 1.0)),
        "teal": make_mat("weathered_teal_cloth", (0.02, 0.50, 0.48, 1.0)),
        "dark_teal": make_mat("deep_teal_shadow", (0.01, 0.22, 0.23, 1.0)),
        "red": make_mat("privateer_red", (0.78, 0.07, 0.04, 1.0)),
        "leather": make_mat("sun_dark_leather", (0.32, 0.17, 0.09, 1.0)),
        "wood": make_mat("aged_wood", (0.47, 0.25, 0.10, 1.0)),
        "brass": make_mat("dull_brass", (0.95, 0.63, 0.18, 1.0), metallic=0.25),
        "lens": make_mat("deep_goggle_lens", (0.02, 0.09, 0.08, 1.0), roughness=0.35),
        "bone": make_mat("bone_blade", (0.78, 0.72, 0.57, 1.0)),
        "iron": make_mat("dark_iron_edge", (0.15, 0.16, 0.15, 1.0), metallic=0.15),
    }


def build_hero():
    clear_scene()
    mats = hero_materials()
    bones = [
        ("root", (0, 0, 0.0), (0, 0, 1.05), None),
        ("hips", (0, 0, 1.05), (0, 0, 1.35), "root"),
        ("spine", (0, 0, 1.35), (0, 0, 2.18), "hips"),
        ("head", (0, 0, 2.18), (0, 0, 2.98), "spine"),
        ("left_thigh", (-0.26, 0, 1.1), (-0.26, 0, 0.58), "hips"),
        ("left_shin", (-0.26, 0, 0.58), (-0.26, 0, 0.08), "left_thigh"),
        ("right_thigh", (0.26, 0, 1.1), (0.26, 0, 0.58), "hips"),
        ("right_shin", (0.26, 0, 0.58), (0.26, 0, 0.08), "right_thigh"),
        ("left_upper_arm", (-0.58, 0, 2.02), (-0.82, 0, 1.42), "spine"),
        ("left_forearm", (-0.82, 0, 1.42), (-0.85, 0, 0.92), "left_upper_arm"),
        ("right_upper_arm", (0.58, 0, 2.02), (0.82, 0, 1.42), "spine"),
        ("right_forearm", (0.82, 0, 1.42), (0.85, 0, 0.92), "right_upper_arm"),
    ]
    arm = make_armature("H01_hero_armature", bones)

    # Body proportions and colors mirror the approved A02 Hunyuan candidate:
    # red scarf, teal hood/cape, brass goggles, leather armor, and saber.
    box_mesh("torso_leather_block", (0.78, 0.44, 0.82), (0, 0, 1.67), mats["leather"], "spine", arm, 0.012)
    box_mesh("chest_teal_panel", (0.44, 0.055, 0.44), (0, -0.235, 1.72), mats["teal"], "spine", arm)
    box_mesh("cross_belt_a", (0.12, 0.06, 0.95), (-0.22, -0.255, 1.70), mats["wood"], "spine", arm)
    bpy.data.objects["cross_belt_a"].rotation_euler[1] = -0.55
    box_mesh("cross_belt_b", (0.12, 0.06, 0.95), (0.22, -0.258, 1.70), mats["wood"], "spine", arm)
    bpy.data.objects["cross_belt_b"].rotation_euler[1] = 0.55
    box_mesh("belt", (0.98, 0.50, 0.16), (0, -0.01, 1.22), mats["wood"], "hips", arm)
    box_mesh("belt_buckle", (0.24, 0.075, 0.18), (0, -0.285, 1.23), mats["brass"], "hips", arm)

    box_mesh("head_skin_block", (0.78, 0.70, 0.70), (0, -0.03, 2.52), mats["skin"], "head", arm, 0.01)
    box_mesh("mouth_shadow", (0.22, 0.035, 0.07), (0, -0.395, 2.37), mats["shadow"], "head", arm)
    box_mesh("cheek_left_red", (0.06, 0.036, 0.18), (-0.29, -0.397, 2.47), mats["red"], "head", arm)
    box_mesh("cheek_right_red", (0.06, 0.036, 0.18), (0.29, -0.397, 2.47), mats["red"], "head", arm)
    box_mesh("hood_back_teal", (0.88, 0.18, 0.82), (0, 0.38, 2.58), mats["teal"], "head", arm)
    box_mesh("hood_left_teal", (0.16, 0.74, 0.86), (-0.48, -0.02, 2.55), mats["teal"], "head", arm)
    box_mesh("hood_right_teal", (0.16, 0.74, 0.86), (0.48, -0.02, 2.55), mats["teal"], "head", arm)
    box_mesh("scarf_red_front", (0.92, 0.16, 0.22), (0, -0.43, 2.85), mats["red"], "head", arm)
    box_mesh("scarf_red_wrap", (0.96, 0.86, 0.18), (0, -0.02, 2.92), mats["red"], "head", arm)
    box_mesh("scarf_teal_top", (0.86, 0.78, 0.16), (0, -0.02, 3.05), mats["teal"], "head", arm)

    box_mesh("goggle_left_frame", (0.28, 0.052, 0.22), (-0.19, -0.43, 2.62), mats["brass"], "head", arm)
    box_mesh("goggle_right_frame", (0.28, 0.052, 0.22), (0.19, -0.43, 2.62), mats["brass"], "head", arm)
    box_mesh("goggle_left_lens", (0.20, 0.06, 0.15), (-0.19, -0.462, 2.62), mats["lens"], "head", arm)
    box_mesh("goggle_right_lens", (0.20, 0.06, 0.15), (0.19, -0.462, 2.62), mats["lens"], "head", arm)
    box_mesh("goggle_bridge", (0.13, 0.06, 0.07), (0, -0.455, 2.62), mats["brass"], "head", arm)
    box_mesh("cape_teal", (0.88, 0.10, 1.02), (0, 0.36, 1.66), mats["teal"], "spine", arm)
    box_mesh("cape_dark_bottom", (0.74, 0.12, 0.18), (0, 0.38, 1.06), mats["dark_teal"], "spine", arm)

    for side, x in (("left", -0.27), ("right", 0.27)):
        box_mesh(f"{side}_thigh_teal", (0.30, 0.34, 0.50), (x, 0.0, 0.93), mats["teal"], f"{side}_thigh", arm)
        box_mesh(f"{side}_shin_leather", (0.28, 0.32, 0.52), (x, 0.0, 0.38), mats["leather"], f"{side}_shin", arm)
        box_mesh(f"{side}_boot", (0.36, 0.44, 0.20), (x, -0.05, 0.10), mats["wood"], f"{side}_shin", arm)
        box_mesh(f"{side}_shoulder_teal", (0.28, 0.36, 0.24), (x * 2.18, 0.0, 1.93), mats["teal"], f"{side}_upper_arm", arm)
        box_mesh(f"{side}_upper_arm_skin", (0.24, 0.26, 0.54), (x * 2.55, 0.0, 1.55), mats["skin"], f"{side}_upper_arm", arm)
        box_mesh(f"{side}_bracer", (0.28, 0.30, 0.24), (x * 2.98, -0.01, 1.16), mats["wood"], f"{side}_forearm", arm)
        box_mesh(f"{side}_hand", (0.22, 0.25, 0.18), (x * 3.08, -0.03, 0.94), mats["skin"], f"{side}_forearm", arm)

    # Saber points toward Blender -Y, which exports as glTF +Z: this makes the character face +Z.
    box_mesh("saber_grip", (0.13, 0.14, 0.42), (0.97, -0.08, 0.94), mats["wood"], "right_forearm", arm)
    blade_verts = [
        (0.86, -0.20, 1.02),
        (1.08, -0.20, 1.02),
        (1.04, -0.34, 1.92),
        (0.86, -0.32, 1.74),
        (0.88, -0.13, 1.02),
        (1.10, -0.13, 1.02),
        (1.06, -0.25, 1.92),
        (0.88, -0.25, 1.74),
    ]
    blade_faces = [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (3, 2, 6, 7), (1, 5, 6, 2), (0, 3, 7, 4)]
    wedge_mesh("curved_saber_blade", blade_verts, blade_faces, mats["bone"], "right_forearm", arm)

    create_action(
        arm,
        "Idle",
        [
            (1, {"spine": (0.02, 0, 0.0), "head": (-0.02, 0, 0), "left_upper_arm": (0.05, 0, -0.03), "right_upper_arm": (-0.03, 0, 0.02)}, {"root": (0, 0, 0)}),
            (20, {"spine": (-0.025, 0, 0.035), "head": (0.025, 0, -0.025), "left_upper_arm": (-0.035, 0, 0.03), "right_upper_arm": (0.04, 0, -0.03)}, {"root": (0, 0, 0.025)}),
            (40, {"spine": (0.02, 0, 0.0), "head": (-0.02, 0, 0), "left_upper_arm": (0.05, 0, -0.03), "right_upper_arm": (-0.03, 0, 0.02)}, {"root": (0, 0, 0)}),
        ],
    )
    create_action(
        arm,
        "Walk",
        [
            (1, {"left_thigh": (0.42, 0, 0), "right_thigh": (-0.42, 0, 0), "left_shin": (-0.15, 0, 0), "right_shin": (0.26, 0, 0), "left_upper_arm": (-0.32, 0, -0.06), "right_upper_arm": (0.32, 0, 0.08), "spine": (0, 0, 0.04)}, {"root": (0, 0, 0.015)}),
            (16, {"left_thigh": (-0.42, 0, 0), "right_thigh": (0.42, 0, 0), "left_shin": (0.26, 0, 0), "right_shin": (-0.15, 0, 0), "left_upper_arm": (0.32, 0, 0.08), "right_upper_arm": (-0.32, 0, -0.06), "spine": (0, 0, -0.04)}, {"root": (0, 0, 0.045)}),
            (32, {"left_thigh": (0.42, 0, 0), "right_thigh": (-0.42, 0, 0), "left_shin": (-0.15, 0, 0), "right_shin": (0.26, 0, 0), "left_upper_arm": (-0.32, 0, -0.06), "right_upper_arm": (0.32, 0, 0.08), "spine": (0, 0, 0.04)}, {"root": (0, 0, 0.015)}),
        ],
    )
    create_action(
        arm,
        "Run",
        [
            (1, {"left_thigh": (0.74, 0, 0), "right_thigh": (-0.72, 0, 0), "left_shin": (-0.30, 0, 0), "right_shin": (0.48, 0, 0), "left_upper_arm": (-0.60, 0, -0.10), "right_upper_arm": (0.70, 0, 0.12), "spine": (0.13, 0, 0.07)}, {"root": (0, 0, 0.03)}),
            (12, {"left_thigh": (-0.72, 0, 0), "right_thigh": (0.74, 0, 0), "left_shin": (0.48, 0, 0), "right_shin": (-0.30, 0, 0), "left_upper_arm": (0.70, 0, 0.12), "right_upper_arm": (-0.60, 0, -0.10), "spine": (0.13, 0, -0.07)}, {"root": (0, 0, 0.08)}),
            (24, {"left_thigh": (0.74, 0, 0), "right_thigh": (-0.72, 0, 0), "left_shin": (-0.30, 0, 0), "right_shin": (0.48, 0, 0), "left_upper_arm": (-0.60, 0, -0.10), "right_upper_arm": (0.70, 0, 0.12), "spine": (0.13, 0, 0.07)}, {"root": (0, 0, 0.03)}),
        ],
    )
    create_action(
        arm,
        "Attack",
        [
            (1, {"spine": (0.0, 0, -0.12), "right_upper_arm": (0.45, -0.15, 0.15), "right_forearm": (0.15, 0.1, 0.0), "left_upper_arm": (-0.1, 0, -0.05)}, {"root": (0, 0, 0.02)}),
            (10, {"spine": (-0.08, 0, 0.32), "right_upper_arm": (-1.05, -0.34, -0.28), "right_forearm": (-0.62, 0.08, -0.35), "head": (0.04, 0, 0.18), "left_upper_arm": (0.2, 0.0, -0.18)}, {"root": (0, 0, 0.05)}),
            (18, {"spine": (0.18, 0, -0.42), "right_upper_arm": (0.92, 0.10, 0.52), "right_forearm": (0.76, -0.18, 0.30), "head": (-0.08, 0, -0.20), "left_upper_arm": (-0.24, 0.05, 0.20)}, {"root": (0, 0, 0.04)}),
            (30, {"spine": (0.0, 0, -0.12), "right_upper_arm": (0.45, -0.15, 0.15), "right_forearm": (0.15, 0.1, 0.0), "left_upper_arm": (-0.1, 0, -0.05)}, {"root": (0, 0, 0.02)}),
        ],
    )
    return arm


def leviathan_materials():
    return {
        "shell": make_mat("leviathan_red_brown_shell", (0.58, 0.17, 0.08, 1.0)),
        "shell_dark": make_mat("leviathan_dark_shell_edges", (0.30, 0.08, 0.04, 1.0)),
        "belly": make_mat("leviathan_sand_belly", (0.63, 0.41, 0.24, 1.0)),
        "dark": make_mat("leviathan_dark_shadow", (0.17, 0.08, 0.05, 1.0)),
        "bone": make_mat("leviathan_bone_plate", (0.82, 0.72, 0.53, 1.0)),
        "claw": make_mat("leviathan_dark_claw", (0.23, 0.13, 0.08, 1.0)),
        "teal": make_mat("leviathan_teal_eye", (0.02, 0.88, 0.80, 1.0)),
    }


def build_leviathan():
    clear_scene()
    mats = leviathan_materials()
    bones = [("root", (0, 0, 0), (0, 0, 0.7), None)]
    for i in range(6):
        name = f"body_{i+1:02d}"
        parent = "root" if i == 0 else f"body_{i:02d}"
        bones.append((name, (0, i * 0.48, 0.72), (0, (i + 1) * 0.48, 0.72), parent))
    bones.append(("tail", (0, 2.95, 0.62), (0, 3.65, 0.55), "body_06"))
    bones.append(("jaw_upper", (0, -0.52, 0.86), (0, -1.18, 1.00), "body_01"))
    bones.append(("jaw_lower", (0, -0.52, 0.48), (0, -1.16, 0.30), "body_01"))
    arm = make_armature("H02_leviathan_armature", bones)

    widths = [1.55, 2.20, 2.42, 2.28, 1.92, 1.46]
    heights = [0.72, 0.95, 1.04, 0.96, 0.80, 0.64]
    lengths = [0.56, 0.58, 0.60, 0.58, 0.54, 0.50]
    for i, width in enumerate(widths):
        y = i * 0.48
        z = 0.56 + heights[i] * 0.20 + math.sin(i * 0.7) * 0.035
        bone = f"body_{i+1:02d}"
        box_mesh(f"segment_{i+1:02d}_belly_mass", (width * 0.90, lengths[i], heights[i] * 0.56), (0, y, z - 0.10), mats["belly"], bone, arm, 0.012)
        box_mesh(f"segment_{i+1:02d}_shell_center", (width * 0.48, lengths[i] * 0.92, 0.22), (0, y - 0.01, z + heights[i] * 0.40), mats["shell"], bone, arm, 0.015)
        box_mesh(f"segment_{i+1:02d}_shell_left", (width * 0.24, lengths[i] * 0.86, 0.20), (-width * 0.31, y, z + heights[i] * 0.34), mats["shell"], bone, arm, 0.014)
        box_mesh(f"segment_{i+1:02d}_shell_right", (width * 0.24, lengths[i] * 0.86, 0.20), (width * 0.31, y, z + heights[i] * 0.34), mats["shell"], bone, arm, 0.014)
        box_mesh(f"segment_{i+1:02d}_dark_gap", (0.09, lengths[i] * 0.98, 0.24), (0, y - 0.015, z + heights[i] * 0.36), mats["shell_dark"], bone, arm)
        box_mesh(f"segment_{i+1:02d}_left_bone_flange", (0.24, lengths[i] * 0.72, 0.22), (-width * 0.54, y, z + 0.08), mats["bone"], bone, arm, 0.006)
        box_mesh(f"segment_{i+1:02d}_right_bone_flange", (0.24, lengths[i] * 0.72, 0.22), (width * 0.54, y, z + 0.08), mats["bone"], bone, arm, 0.006)
        if i in (1, 2, 3, 4):
            box_mesh(f"segment_{i+1:02d}_top_spike_a", (0.22, 0.20, 0.32), (-0.34, y - 0.04, z + heights[i] * 0.60), mats["claw"], bone, arm)
            box_mesh(f"segment_{i+1:02d}_top_spike_b", (0.22, 0.20, 0.32), (0.34, y - 0.04, z + heights[i] * 0.60), mats["claw"], bone, arm)
        if i in (1, 2, 3):
            leg_y = y - 0.06
            for side, sx in (("left", -1), ("right", 1)):
                x0 = sx * width * 0.52
                oriented_box_mesh(
                    f"segment_{i+1:02d}_{side}_foreleg",
                    (0.28, 0.23, 0.62),
                    (x0 + sx * 0.18, leg_y, z - 0.30),
                    mats["claw"],
                    bone,
                    arm,
                    rotation=(0, 0, sx * 0.38),
                    bevel=0.006,
                )
                oriented_box_mesh(
                    f"segment_{i+1:02d}_{side}_bone_claw",
                    (0.30, 0.18, 0.42),
                    (x0 + sx * 0.40, leg_y - 0.10, z - 0.58),
                    mats["bone"],
                    bone,
                    arm,
                    rotation=(0.0, sx * 0.28, sx * 0.62),
                    bevel=0.004,
                )

    box_mesh("head_crimson_skull", (1.42, 0.74, 0.76), (0, -0.55, 0.74), mats["shell"], "body_01", arm, 0.018)
    box_mesh("head_brow_block", (1.18, 0.34, 0.22), (0, -0.92, 1.05), mats["shell_dark"], "body_01", arm, 0.008)
    box_mesh("snout_front_plate", (1.04, 0.28, 0.38), (0, -1.06, 0.76), mats["shell"], "body_01", arm, 0.01)
    box_mesh("left_eye", (0.16, 0.06, 0.14), (-0.32, -1.22, 0.91), mats["teal"], "body_01", arm)
    box_mesh("right_eye", (0.16, 0.06, 0.14), (0.32, -1.22, 0.91), mats["teal"], "body_01", arm)
    box_mesh("left_cheek_bone", (0.24, 0.42, 0.34), (-0.70, -0.78, 0.54), mats["bone"], "body_01", arm, 0.006)
    box_mesh("right_cheek_bone", (0.24, 0.42, 0.34), (0.70, -0.78, 0.54), mats["bone"], "body_01", arm, 0.006)
    box_mesh("upper_jaw_plate", (1.18, 0.52, 0.20), (0, -1.18, 0.98), mats["bone"], "jaw_upper", arm, 0.006)
    box_mesh("lower_jaw_plate", (1.02, 0.46, 0.18), (0, -1.16, 0.36), mats["bone"], "jaw_lower", arm, 0.006)
    for sx in (-1, 1):
        oriented_box_mesh(
            f"{'left' if sx < 0 else 'right'}_upper_fang",
            (0.16, 0.12, 0.46),
            (sx * 0.40, -1.42, 0.76),
            mats["bone"],
            "jaw_upper",
            arm,
            rotation=(0.28, sx * 0.18, 0),
        )
        oriented_box_mesh(
            f"{'left' if sx < 0 else 'right'}_lower_tusk",
            (0.14, 0.12, 0.38),
            (sx * 0.34, -1.38, 0.44),
            mats["bone"],
            "jaw_lower",
            arm,
            rotation=(-0.25, sx * 0.14, 0),
        )

    box_mesh("tail_base_shell", (1.04, 0.50, 0.42), (0, 2.96, 0.58), mats["shell"], "tail", arm, 0.012)
    box_mesh("tail_tip_bone", (0.56, 0.72, 0.24), (0, 3.45, 0.52), mats["bone"], "tail", arm, 0.006)
    box_mesh("tail_top_spike", (0.22, 0.20, 0.32), (0, 3.08, 0.92), mats["claw"], "tail", arm)

    swim_keys = []
    for frame, phase in [(1, 0), (16, math.pi), (32, math.tau)]:
        rotations = {}
        for i in range(6):
            rotations[f"body_{i+1:02d}"] = (0.0, math.sin(phase + i * 0.58) * 0.055, math.sin(phase + i * 0.72) * 0.16)
        rotations["tail"] = (0.0, 0.0, math.sin(phase + 4.2) * 0.26)
        swim_keys.append((frame, rotations, {"root": (0, 0, 0.0 if frame != 16 else 0.07)}))
    create_action(arm, "Swim", swim_keys)

    burrow_keys = []
    for frame, drop in [(1, 0.0), (14, -0.48), (28, 0.0)]:
        rotations = {}
        for i in range(6):
            rotations[f"body_{i+1:02d}"] = (-0.10 * i if frame == 14 else 0.0, 0.0, math.sin(i) * (0.10 if frame == 14 else 0.03))
        rotations["tail"] = (-0.45 if frame == 14 else 0.0, 0.0, 0.12 if frame == 14 else 0.0)
        burrow_keys.append((frame, rotations, {"root": (0, 0, drop)}))
    create_action(arm, "Burrow", burrow_keys)

    create_action(
        arm,
        "Bite",
        [
            (1, {"jaw_upper": (0.0, 0, 0), "jaw_lower": (0.0, 0, 0), "body_01": (0, 0, 0)}, {"root": (0, 0, 0)}),
            (10, {"jaw_upper": (-0.42, 0, 0), "jaw_lower": (0.64, 0, 0), "body_01": (-0.16, 0, 0)}, {"root": (0, -0.04, 0.07)}),
            (18, {"jaw_upper": (0.20, 0, 0), "jaw_lower": (-0.30, 0, 0), "body_01": (0.18, 0, 0), "body_02": (-0.12, 0, 0)}, {"root": (0, -0.12, 0.03)}),
            (28, {"jaw_upper": (0.0, 0, 0), "jaw_lower": (0.0, 0, 0), "body_01": (0, 0, 0)}, {"root": (0, 0, 0)}),
        ],
    )
    return arm


def delete_flat_a07_sand_base(obj):
    mesh = obj.data
    adj = [set() for _ in mesh.vertices]
    for edge in mesh.edges:
        a, b = edge.vertices
        adj[a].add(b)
        adj[b].add(a)

    seen = set()
    delete_indices = set()
    for start in range(len(mesh.vertices)):
        if start in seen:
            continue
        stack = [start]
        seen.add(start)
        comp = []
        while stack:
            idx = stack.pop()
            comp.append(idx)
            for other in adj[idx]:
                if other not in seen:
                    seen.add(other)
                    stack.append(other)
        coords = [mesh.vertices[idx].co for idx in comp]
        min_x = min(v.x for v in coords)
        max_x = max(v.x for v in coords)
        min_y = min(v.y for v in coords)
        max_y = max(v.y for v in coords)
        min_z = min(v.z for v in coords)
        max_z = max(v.z for v in coords)
        avg_z = sum(v.z for v in coords) / len(coords)
        area = (max_x - min_x) * (max_y - min_y)
        height = max_z - min_z
        # A07's sand pedestal imports as several broad, flat, low components.
        # Keep claws and jaw chips by deleting only components fully under the
        # creature's usable lower silhouette.
        if max_z < 0.082 or (avg_z < 0.045 and height < 0.05):
            delete_indices.update(comp)

    if not delete_indices:
        return 0

    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_mode(type="VERT")
    bpy.ops.mesh.select_all(action="DESELECT")
    bpy.ops.object.mode_set(mode="OBJECT")
    for vert in mesh.vertices:
        vert.select = vert.index in delete_indices
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.delete(type="VERT")
    bpy.ops.object.mode_set(mode="OBJECT")
    mesh.update()
    return len(delete_indices)


def assign_a07_skin_weights(obj, arm):
    mesh = obj.data
    for name in [
        "root",
        "body_01",
        "body_02",
        "body_03",
        "body_04",
        "body_05",
        "body_06",
        "tail",
        "jaw_upper",
        "jaw_lower",
    ]:
        if name not in obj.vertex_groups:
            obj.vertex_groups.new(name=name)

    min_y = min((obj.matrix_world @ v.co).y for v in mesh.vertices)
    max_y = max((obj.matrix_world @ v.co).y for v in mesh.vertices)
    length = max(max_y - min_y, 0.0001)
    segment_count = 6

    for vert in mesh.vertices:
        world = obj.matrix_world @ vert.co
        y_norm = (world.y - min_y) / length
        assigned = False

        # The head is at Blender -Y, which becomes glTF +Z after export.
        if y_norm < 0.16:
            if world.z > 0.30:
                obj.vertex_groups["jaw_upper"].add([vert.index], 1.0, "REPLACE")
                assigned = True
            elif world.z < 0.23 and world.y < min_y + length * 0.12:
                obj.vertex_groups["jaw_lower"].add([vert.index], 1.0, "REPLACE")
                assigned = True

        if not assigned and y_norm > 0.87:
            obj.vertex_groups["tail"].add([vert.index], 1.0, "REPLACE")
            assigned = True

        if not assigned:
            f = max(0.0, min(0.999, y_norm)) * segment_count
            idx = int(f)
            blend = f - idx
            current = f"body_{min(idx + 1, segment_count):02d}"
            nxt = f"body_{min(idx + 2, segment_count):02d}"
            if current == nxt or blend < 0.001:
                obj.vertex_groups[current].add([vert.index], 1.0, "REPLACE")
            else:
                obj.vertex_groups[current].add([vert.index], 1.0 - blend, "REPLACE")
                obj.vertex_groups[nxt].add([vert.index], blend, "ADD")

    mod = obj.modifiers.new("A07_H02_Armature", "ARMATURE")
    mod.object = arm
    obj.parent = arm


def build_leviathan():
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=str(OUT_DIR / "A07_hunyuan_leviathan_v1.glb"))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError("A07_hunyuan_leviathan_v1.glb imported no mesh")
    obj = max(meshes, key=lambda item: len(item.data.vertices))
    obj.name = "H02_from_A07_hunyuan_leviathan_mesh"
    obj.data.name = "H02_from_A07_hunyuan_leviathan_mesh"
    for other in meshes:
        if other != obj:
            bpy.data.objects.remove(other, do_unlink=True)

    delete_flat_a07_sand_base(obj)

    min_y = min((obj.matrix_world @ v.co).y for v in obj.data.vertices)
    max_y = max((obj.matrix_world @ v.co).y for v in obj.data.vertices)
    min_z = min((obj.matrix_world @ v.co).z for v in obj.data.vertices)
    max_z = max((obj.matrix_world @ v.co).z for v in obj.data.vertices)
    mid_x = 0.0
    center_z = min_z + (max_z - min_z) * 0.42
    length = max(max_y - min_y, 0.0001)

    bones = [("root", (mid_x, min_y, center_z - 0.18), (mid_x, min_y, center_z + 0.42), None)]
    for i in range(6):
        y0 = min_y + length * (i / 6.0)
        y1 = min_y + length * ((i + 1) / 6.0)
        parent = "root" if i == 0 else f"body_{i:02d}"
        bones.append((f"body_{i+1:02d}", (mid_x, y0, center_z), (mid_x, y1, center_z), parent))
    bones.extend(
        [
            ("tail", (mid_x, min_y + length * 0.86, center_z), (mid_x, max_y + length * 0.10, center_z - 0.03), "body_06"),
            ("jaw_upper", (mid_x, min_y + length * 0.07, center_z + 0.16), (mid_x, min_y - length * 0.10, center_z + 0.24), "body_01"),
            ("jaw_lower", (mid_x, min_y + length * 0.07, center_z - 0.10), (mid_x, min_y - length * 0.10, center_z - 0.20), "body_01"),
        ]
    )
    arm = make_armature("H02_A07_hunyuan_leviathan_armature", bones)
    assign_a07_skin_weights(obj, arm)

    swim_keys = []
    for frame, phase in [(1, 0), (18, math.pi), (36, math.tau)]:
        rotations = {}
        for i in range(6):
            rotations[f"body_{i+1:02d}"] = (
                math.sin(phase + i * 0.45) * 0.035,
                math.sin(phase + i * 0.58) * 0.045,
                math.sin(phase + i * 0.72) * 0.13,
            )
        rotations["tail"] = (0, math.sin(phase + 3.8) * 0.08, math.sin(phase + 4.0) * 0.22)
        swim_keys.append((frame, rotations, {"root": (0, 0, 0.0 if frame != 18 else 0.035)}))
    create_action(arm, "Swim", swim_keys)

    burrow_keys = []
    for frame, drop in [(1, 0.0), (16, -0.18), (32, 0.0)]:
        rotations = {}
        for i in range(6):
            rotations[f"body_{i+1:02d}"] = (-0.08 * i if frame == 16 else 0.0, 0.0, math.sin(i) * (0.11 if frame == 16 else 0.02))
        rotations["tail"] = (-0.32 if frame == 16 else 0.0, 0.0, 0.14 if frame == 16 else 0.0)
        burrow_keys.append((frame, rotations, {"root": (0, 0, drop)}))
    create_action(arm, "Burrow", burrow_keys)

    create_action(
        arm,
        "Bite",
        [
            (1, {"jaw_upper": (0.0, 0, 0), "jaw_lower": (0.0, 0, 0), "body_01": (0, 0, 0)}, {"root": (0, 0, 0)}),
            (10, {"jaw_upper": (-0.30, 0, 0), "jaw_lower": (0.48, 0, 0), "body_01": (-0.09, 0, 0)}, {"root": (0, -0.012, 0.03)}),
            (18, {"jaw_upper": (0.15, 0, 0), "jaw_lower": (-0.22, 0, 0), "body_01": (0.12, 0, 0), "body_02": (-0.07, 0, 0)}, {"root": (0, -0.035, 0.01)}),
            (30, {"jaw_upper": (0.0, 0, 0), "jaw_lower": (0.0, 0, 0), "body_01": (0, 0, 0)}, {"root": (0, 0, 0)}),
        ],
    )
    return arm


def export_glb(path):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.context.scene.objects:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        export_yup=True,
        export_apply=False,
        export_skins=True,
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_force_sampling=True,
        export_frame_range=False,
        export_def_bones=False,
        export_leaf_bone=False,
        export_optimize_animation_size=True,
        export_materials="EXPORT",
    )


def main():
    build_hero()
    export_glb(OUT_DIR / "H01_hero_rigged_v1.glb")
    build_leviathan()
    export_glb(OUT_DIR / "H02_sand_leviathan_rigged_v1.glb")


if __name__ == "__main__":
    main()
