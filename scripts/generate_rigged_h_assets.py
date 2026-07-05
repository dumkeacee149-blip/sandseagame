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
        "shell": make_mat("leviathan_red_brown_shell", (0.48, 0.16, 0.08, 1.0)),
        "dark": make_mat("leviathan_dark_shadow", (0.17, 0.08, 0.05, 1.0)),
        "bone": make_mat("leviathan_bone_plate", (0.76, 0.66, 0.48, 1.0)),
        "teal": make_mat("leviathan_teal_eye", (0.02, 0.88, 0.80, 1.0)),
    }


def build_leviathan():
    clear_scene()
    mats = leviathan_materials()
    bones = [("root", (0, 0, 0), (0, 0, 0.7), None)]
    for i in range(8):
        name = f"body_{i+1:02d}"
        parent = "root" if i == 0 else f"body_{i:02d}"
        bones.append((name, (0, i * 0.58, 0.65), (0, (i + 1) * 0.58, 0.65), parent))
    bones.append(("jaw_upper", (0, -0.35, 0.82), (0, -0.85, 1.02), "body_01"))
    bones.append(("jaw_lower", (0, -0.35, 0.50), (0, -0.85, 0.32), "body_01"))
    arm = make_armature("H02_leviathan_armature", bones)

    for i in range(8):
        z = 0.65 + math.sin(i * 0.45) * 0.06
        scale = 1.0 - i * 0.055
        y = i * 0.58
        bone = f"body_{i+1:02d}"
        box_mesh(f"segment_{i+1:02d}_shell", (1.15 * scale, 0.50, 0.58 * scale), (0, y, z), mats["shell"], bone, arm, 0.015)
        box_mesh(f"segment_{i+1:02d}_top_plate", (0.76 * scale, 0.28, 0.16), (0, y - 0.02, z + 0.37 * scale), mats["bone"], bone, arm)
        box_mesh(f"segment_{i+1:02d}_left_spike", (0.18, 0.24, 0.18), (-0.62 * scale, y, z + 0.08), mats["bone"], bone, arm)
        box_mesh(f"segment_{i+1:02d}_right_spike", (0.18, 0.24, 0.18), (0.62 * scale, y, z + 0.08), mats["bone"], bone, arm)

    box_mesh("head_block", (1.08, 0.48, 0.64), (0, -0.38, 0.68), mats["shell"], "body_01", arm, 0.015)
    box_mesh("left_eye", (0.16, 0.06, 0.12), (-0.26, -0.64, 0.82), mats["teal"], "body_01", arm)
    box_mesh("right_eye", (0.16, 0.06, 0.12), (0.26, -0.64, 0.82), mats["teal"], "body_01", arm)
    box_mesh("upper_jaw_plate", (0.74, 0.34, 0.20), (0, -0.78, 0.94), mats["bone"], "jaw_upper", arm)
    box_mesh("lower_jaw_plate", (0.68, 0.32, 0.18), (0, -0.78, 0.38), mats["bone"], "jaw_lower", arm)

    swim_keys = []
    for frame, phase in [(1, 0), (16, math.pi), (32, math.tau)]:
        rotations = {}
        for i in range(8):
            rotations[f"body_{i+1:02d}"] = (0.0, 0.0, math.sin(phase + i * 0.68) * 0.18)
        swim_keys.append((frame, rotations, {"root": (0, 0, 0.0 if frame != 16 else 0.05)}))
    create_action(arm, "Swim", swim_keys)

    burrow_keys = []
    for frame, drop in [(1, 0.0), (14, -0.32), (28, 0.0)]:
        rotations = {}
        for i in range(8):
            rotations[f"body_{i+1:02d}"] = (-0.08 * i if frame == 14 else 0.0, 0.0, math.sin(i) * 0.08)
        burrow_keys.append((frame, rotations, {"root": (0, 0, drop)}))
    create_action(arm, "Burrow", burrow_keys)

    create_action(
        arm,
        "Bite",
        [
            (1, {"jaw_upper": (0.0, 0, 0), "jaw_lower": (0.0, 0, 0), "body_01": (0, 0, 0)}, {"root": (0, 0, 0)}),
            (10, {"jaw_upper": (-0.32, 0, 0), "jaw_lower": (0.48, 0, 0), "body_01": (-0.1, 0, 0)}, {"root": (0, -0.03, 0.04)}),
            (18, {"jaw_upper": (0.14, 0, 0), "jaw_lower": (-0.18, 0, 0), "body_01": (0.12, 0, 0)}, {"root": (0, -0.08, 0.02)}),
            (28, {"jaw_upper": (0.0, 0, 0), "jaw_lower": (0.0, 0, 0), "body_01": (0, 0, 0)}, {"root": (0, 0, 0)}),
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
