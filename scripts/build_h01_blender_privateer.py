import math
import shutil
from pathlib import Path

import bpy
from mathutils import Euler, Vector


ROOT = Path(__file__).resolve().parents[1]
OUT_GLB = ROOT / "assets" / "hunyuan" / "raw" / "H01_hero_rigged_v1.glb"
PUBLIC_GLB = ROOT / "public" / "models" / "hero_rigged.glb"


def clear_scene():
    bpy.ops.object.mode_set(mode="OBJECT") if bpy.ops.object.mode_set.poll() else None
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)
    for mesh in list(bpy.data.meshes):
        bpy.data.meshes.remove(mesh)
    for armature in list(bpy.data.armatures):
        bpy.data.armatures.remove(armature)
    for material in list(bpy.data.materials):
        bpy.data.materials.remove(material)


def make_mat(name, color, roughness=0.86, metallic=0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = color
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
    return mat


def make_materials():
    return {
        "skin": make_mat("h01_sunburnt_skin", (0.86, 0.54, 0.34, 1.0)),
        "skin_hi": make_mat("h01_sunlit_skin_edge", (0.98, 0.68, 0.43, 1.0)),
        "skin_shadow": make_mat("h01_skin_shadow", (0.54, 0.30, 0.20, 1.0)),
        "teal": make_mat("h01_weathered_teal_cloth", (0.02, 0.48, 0.46, 1.0)),
        "teal_hi": make_mat("h01_sunlit_teal_edge", (0.05, 0.66, 0.58, 1.0)),
        "teal_dark": make_mat("h01_dark_teal_shadow", (0.01, 0.20, 0.22, 1.0)),
        "red": make_mat("h01_privateer_red", (0.78, 0.08, 0.04, 1.0)),
        "red_dark": make_mat("h01_dark_privateer_red", (0.42, 0.04, 0.03, 1.0)),
        "leather": make_mat("h01_sun_dark_leather", (0.31, 0.17, 0.09, 1.0)),
        "leather_dark": make_mat("h01_deep_leather_shadow", (0.15, 0.08, 0.04, 1.0)),
        "wood": make_mat("h01_aged_wood", (0.46, 0.25, 0.11, 1.0)),
        "brass": make_mat("h01_dull_brass", (0.93, 0.61, 0.18, 1.0), metallic=0.18),
        "brass_dark": make_mat("h01_old_brass_shadow", (0.58, 0.36, 0.10, 1.0), metallic=0.12),
        "cloth": make_mat("h01_sand_cloth_wrap", (0.78, 0.68, 0.48, 1.0)),
        "lens": make_mat("h01_deep_goggle_lens", (0.02, 0.09, 0.08, 1.0), roughness=0.38),
        "bone": make_mat("h01_bone_blade", (0.82, 0.75, 0.58, 1.0)),
        "iron": make_mat("h01_dark_iron_edge", (0.14, 0.15, 0.14, 1.0), metallic=0.15),
    }


class MeshBuilder:
    def __init__(self, materials):
        self.materials = list(materials.values())
        self.material_index = {name: index for index, name in enumerate(materials.keys())}
        self.verts = []
        self.faces = []
        self.face_mats = []
        self.vertex_bones = []

    def add_box(self, dims, loc, material_name, bone_name, rotation=(0.0, 0.0, 0.0)):
        sx, sy, sz = [value * 0.5 for value in dims]
        local = [
            (-sx, -sy, -sz),
            (sx, -sy, -sz),
            (sx, sy, -sz),
            (-sx, sy, -sz),
            (-sx, -sy, sz),
            (sx, -sy, sz),
            (sx, sy, sz),
            (-sx, sy, sz),
        ]
        rot = Euler(rotation, "XYZ").to_matrix()
        center = Vector(loc)
        start = len(self.verts)
        for co in local:
            self.verts.append(tuple(center + rot @ Vector(co)))
            self.vertex_bones.append(bone_name)
        self.faces.extend(
            [
                (start + 0, start + 1, start + 2, start + 3),
                (start + 4, start + 7, start + 6, start + 5),
                (start + 0, start + 4, start + 5, start + 1),
                (start + 1, start + 5, start + 6, start + 2),
                (start + 2, start + 6, start + 7, start + 3),
                (start + 3, start + 7, start + 4, start + 0),
            ]
        )
        self.face_mats.extend([self.material_index[material_name]] * 6)

    def build_object(self, name, bone_names, armature):
        mesh = bpy.data.meshes.new(f"{name}Mesh")
        mesh.from_pydata(self.verts, [], self.faces)
        mesh.update()

        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)
        for mat in self.materials:
            obj.data.materials.append(mat)
        for poly, mat_index in zip(obj.data.polygons, self.face_mats):
            poly.material_index = mat_index
            poly.use_smooth = False

        groups = {bone_name: obj.vertex_groups.new(name=bone_name) for bone_name in bone_names}
        for vertex_index, bone_name in enumerate(self.vertex_bones):
            groups[bone_name].add([vertex_index], 1.0, "REPLACE")

        obj.parent = armature
        modifier = obj.modifiers.new("H01_BlockyArmature", "ARMATURE")
        modifier.object = armature
        return obj


def make_armature():
    bone_specs = [
        ("root", (0.0, 0.0, 0.0), (0.0, 0.0, 0.72), None),
        ("hips", (0.0, 0.0, 0.82), (0.0, 0.0, 1.16), "root"),
        ("spine", (0.0, 0.0, 1.16), (0.0, 0.0, 1.96), "hips"),
        ("head", (0.0, 0.0, 1.96), (0.0, 0.0, 2.72), "spine"),
        ("left_thigh", (-0.24, 0.0, 1.02), (-0.24, 0.0, 0.56), "hips"),
        ("left_shin", (-0.24, 0.0, 0.56), (-0.24, 0.0, 0.08), "left_thigh"),
        ("right_thigh", (0.24, 0.0, 1.02), (0.24, 0.0, 0.56), "hips"),
        ("right_shin", (0.24, 0.0, 0.56), (0.24, 0.0, 0.08), "right_thigh"),
        ("left_upper_arm", (-0.52, 0.0, 1.86), (-0.72, 0.0, 1.34), "spine"),
        ("left_forearm", (-0.72, 0.0, 1.34), (-0.72, 0.0, 0.92), "left_upper_arm"),
        ("right_upper_arm", (0.52, 0.0, 1.86), (0.72, 0.0, 1.34), "spine"),
        ("right_forearm", (0.72, 0.0, 1.34), (0.72, 0.0, 0.92), "right_upper_arm"),
    ]

    arm_data = bpy.data.armatures.new("H01_blender_privateer_armature_data")
    arm_data.display_type = "STICK"
    arm = bpy.data.objects.new("H01_blender_privateer_armature", arm_data)
    bpy.context.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")

    edit_bones = {}
    for name, head, tail, _parent in bone_specs:
        bone = arm_data.edit_bones.new(name)
        bone.head = head
        bone.tail = tail
        bone.roll = 0.0
        edit_bones[name] = bone
    for name, _head, _tail, parent in bone_specs:
        if parent:
            edit_bones[name].parent = edit_bones[parent]
            edit_bones[name].use_connect = False

    bpy.ops.object.mode_set(mode="OBJECT")
    return arm, [name for name, _head, _tail, _parent in bone_specs]


def add_body(builder):
    builder.add_box((0.72, 0.44, 0.78), (0.0, 0.0, 1.52), "leather", "spine")
    builder.add_box((0.42, 0.06, 0.42), (0.0, -0.25, 1.56), "teal", "spine")
    builder.add_box((0.34, 0.07, 0.12), (0.0, -0.30, 1.80), "cloth", "spine")
    builder.add_box((0.30, 0.075, 0.13), (0.0, -0.31, 1.32), "leather_dark", "spine")
    builder.add_box((0.13, 0.08, 0.16), (-0.24, -0.31, 1.57), "brass_dark", "spine")
    builder.add_box((0.13, 0.08, 0.16), (0.24, -0.31, 1.57), "brass_dark", "spine")
    builder.add_box((0.14, 0.07, 0.92), (-0.20, -0.28, 1.53), "wood", "spine", rotation=(0.0, -0.50, 0.0))
    builder.add_box((0.14, 0.07, 0.92), (0.20, -0.28, 1.53), "wood", "spine", rotation=(0.0, 0.50, 0.0))
    builder.add_box((0.055, 0.085, 0.09), (-0.33, -0.33, 1.78), "brass", "spine")
    builder.add_box((0.055, 0.085, 0.09), (0.33, -0.33, 1.78), "brass", "spine")
    builder.add_box((0.055, 0.085, 0.09), (-0.13, -0.34, 1.28), "brass", "spine")
    builder.add_box((0.055, 0.085, 0.09), (0.13, -0.34, 1.28), "brass", "spine")
    builder.add_box((0.88, 0.48, 0.15), (0.0, -0.01, 1.13), "wood", "hips")
    builder.add_box((0.22, 0.08, 0.17), (0.0, -0.29, 1.14), "brass", "hips")
    builder.add_box((0.23, 0.18, 0.24), (-0.36, -0.13, 1.00), "leather_dark", "hips")
    builder.add_box((0.20, 0.16, 0.20), (0.36, -0.15, 1.02), "cloth", "hips")
    builder.add_box((0.08, 0.20, 0.11), (-0.36, -0.27, 1.13), "brass_dark", "hips")
    builder.add_box((0.07, 0.18, 0.10), (0.36, -0.27, 1.14), "brass", "hips")
    builder.add_box((0.10, 0.08, 0.58), (-0.52, -0.02, 1.32), "red_dark", "spine")
    builder.add_box((0.10, 0.08, 0.50), (0.52, -0.01, 1.30), "red", "spine")
    builder.add_box((0.86, 0.10, 0.96), (0.0, 0.34, 1.45), "teal", "spine")
    builder.add_box((0.70, 0.12, 0.20), (0.0, 0.37, 0.94), "teal_dark", "spine")
    builder.add_box((0.70, 0.12, 0.16), (0.0, 0.39, 1.86), "teal_hi", "spine")
    builder.add_box((0.18, 0.14, 0.66), (-0.30, 0.42, 1.35), "teal_dark", "spine")
    builder.add_box((0.18, 0.14, 0.62), (0.30, 0.42, 1.32), "teal_dark", "spine")
    builder.add_box((0.10, 0.15, 0.42), (0.0, 0.44, 1.23), "red_dark", "spine")


def add_head(builder):
    builder.add_box((0.72, 0.66, 0.66), (0.0, -0.03, 2.33), "skin", "head")
    builder.add_box((0.54, 0.045, 0.13), (0.0, -0.405, 2.51), "skin_hi", "head")
    builder.add_box((0.12, 0.05, 0.16), (0.0, -0.43, 2.33), "skin_hi", "head")
    builder.add_box((0.22, 0.04, 0.07), (0.0, -0.39, 2.20), "skin_shadow", "head")
    builder.add_box((0.22, 0.045, 0.055), (0.0, -0.43, 2.16), "skin_shadow", "head")
    builder.add_box((0.06, 0.04, 0.17), (-0.27, -0.40, 2.31), "red", "head")
    builder.add_box((0.06, 0.04, 0.17), (0.27, -0.40, 2.31), "red", "head")
    builder.add_box((0.86, 0.18, 0.78), (0.0, 0.36, 2.38), "teal", "head")
    builder.add_box((0.72, 0.11, 0.12), (0.0, 0.49, 2.66), "teal_dark", "head")
    builder.add_box((0.36, 0.12, 0.15), (-0.22, 0.50, 2.95), "teal_hi", "head")
    builder.add_box((0.34, 0.12, 0.15), (0.22, 0.50, 2.95), "teal_hi", "head")
    builder.add_box((0.15, 0.70, 0.80), (-0.45, -0.02, 2.36), "teal", "head")
    builder.add_box((0.15, 0.70, 0.80), (0.45, -0.02, 2.36), "teal", "head")
    builder.add_box((0.09, 0.46, 0.50), (-0.54, -0.04, 2.24), "teal_dark", "head")
    builder.add_box((0.09, 0.44, 0.48), (0.54, -0.04, 2.25), "teal_dark", "head")
    builder.add_box((0.88, 0.16, 0.20), (0.0, -0.42, 2.66), "red", "head")
    builder.add_box((0.92, 0.06, 0.07), (0.0, -0.51, 2.75), "red_dark", "head")
    builder.add_box((0.20, 0.18, 0.14), (-0.48, -0.38, 2.68), "red_dark", "head", rotation=(0.0, 0.0, 0.24))
    builder.add_box((0.16, 0.14, 0.12), (-0.62, -0.30, 2.62), "red", "head", rotation=(0.0, 0.0, 0.24))
    builder.add_box((0.92, 0.78, 0.16), (0.0, -0.02, 2.73), "red", "head")
    builder.add_box((0.72, 0.58, 0.08), (0.0, -0.02, 2.84), "red_dark", "head")
    builder.add_box((0.82, 0.72, 0.15), (0.0, -0.02, 2.86), "teal", "head")
    builder.add_box((0.62, 0.52, 0.08), (0.0, -0.02, 2.96), "teal_hi", "head")
    builder.add_box((0.28, 0.06, 0.21), (-0.18, -0.43, 2.43), "brass", "head")
    builder.add_box((0.28, 0.06, 0.21), (0.18, -0.43, 2.43), "brass", "head")
    builder.add_box((0.34, 0.045, 0.06), (-0.18, -0.48, 2.58), "brass_dark", "head")
    builder.add_box((0.34, 0.045, 0.06), (0.18, -0.48, 2.58), "brass_dark", "head")
    builder.add_box((0.19, 0.07, 0.14), (-0.18, -0.47, 2.43), "lens", "head")
    builder.add_box((0.19, 0.07, 0.14), (0.18, -0.47, 2.43), "lens", "head")
    builder.add_box((0.08, 0.08, 0.05), (-0.18, -0.52, 2.45), "teal_hi", "head")
    builder.add_box((0.08, 0.08, 0.05), (0.18, -0.52, 2.45), "teal_hi", "head")
    builder.add_box((0.12, 0.07, 0.06), (0.0, -0.46, 2.43), "brass", "head")
    builder.add_box((0.10, 0.05, 0.10), (-0.40, -0.38, 2.10), "brass", "head")
    builder.add_box((0.05, 0.04, 0.20), (-0.42, -0.41, 1.96), "brass_dark", "head")
    builder.add_box((0.08, 0.045, 0.08), (0.38, -0.42, 2.54), "skin_shadow", "head")


def add_limbs(builder):
    for side, x in (("left", -0.25), ("right", 0.25)):
        builder.add_box((0.28, 0.32, 0.48), (x, 0.0, 0.84), "teal", f"{side}_thigh")
        builder.add_box((0.20, 0.34, 0.10), (x, -0.03, 1.08), "leather_dark", f"{side}_thigh")
        builder.add_box((0.16, 0.35, 0.09), (x, -0.04, 0.66), "brass_dark", f"{side}_thigh")
        builder.add_box((0.26, 0.30, 0.48), (x, 0.0, 0.34), "leather", f"{side}_shin")
        builder.add_box((0.28, 0.32, 0.12), (x, -0.02, 0.52), "cloth", f"{side}_shin")
        builder.add_box((0.22, 0.32, 0.10), (x, -0.03, 0.22), "leather_dark", f"{side}_shin")
        builder.add_box((0.34, 0.44, 0.18), (x, -0.05, 0.10), "wood", f"{side}_shin")
        builder.add_box((0.38, 0.16, 0.09), (x, -0.26, 0.17), "leather_dark", f"{side}_shin")
        builder.add_box((0.24, 0.14, 0.07), (x, -0.32, 0.04), "brass_dark", f"{side}_shin")

    for side, sx in (("left", -1), ("right", 1)):
        builder.add_box((0.36, 0.38, 0.24), (sx * 0.58, 0.0, 1.80), "teal", f"{side}_upper_arm")
        builder.add_box((0.30, 0.20, 0.14), (sx * 0.62, -0.18, 1.88), "teal_hi", f"{side}_upper_arm")
        builder.add_box((0.20, 0.16, 0.16), (sx * 0.72, -0.22, 1.74), "brass_dark", f"{side}_upper_arm")
        builder.add_box((0.24, 0.25, 0.50), (sx * 0.72, 0.0, 1.40), "skin", f"{side}_upper_arm")
        builder.add_box((0.24, 0.27, 0.10), (sx * 0.72, -0.01, 1.62), "cloth", f"{side}_upper_arm")
        builder.add_box((0.27, 0.28, 0.22), (sx * 0.78, -0.02, 1.05), "wood", f"{side}_forearm")
        builder.add_box((0.29, 0.30, 0.09), (sx * 0.78, -0.03, 1.16), "leather_dark", f"{side}_forearm")
        builder.add_box((0.22, 0.31, 0.07), (sx * 0.78, -0.04, 0.96), "brass_dark", f"{side}_forearm")
        builder.add_box((0.22, 0.24, 0.17), (sx * 0.80, -0.04, 0.84), "skin", f"{side}_forearm")
        builder.add_box((0.08, 0.045, 0.11), (sx * 0.72, -0.18, 0.79), "skin_hi", f"{side}_forearm")
        builder.add_box((0.08, 0.045, 0.11), (sx * 0.84, -0.18, 0.79), "skin_hi", f"{side}_forearm")

    builder.add_box((0.13, 0.14, 0.40), (0.91, -0.10, 0.86), "wood", "right_forearm")
    builder.add_box((0.28, 0.08, 0.12), (0.91, -0.18, 1.05), "brass", "right_forearm")
    builder.add_box((0.10, 0.10, 0.10), (0.91, -0.10, 0.62), "brass_dark", "right_forearm")
    builder.add_box((0.18, 0.06, 0.42), (0.95, -0.30, 1.10), "bone", "right_forearm", rotation=(0.16, 0.0, -0.10))
    builder.add_box((0.16, 0.055, 0.42), (0.98, -0.35, 1.48), "bone", "right_forearm", rotation=(0.16, 0.0, -0.10))
    builder.add_box((0.11, 0.045, 0.32), (1.00, -0.39, 1.80), "bone", "right_forearm", rotation=(0.16, 0.0, -0.10))
    builder.add_box((0.055, 0.04, 1.15), (1.07, -0.37, 1.38), "iron", "right_forearm", rotation=(0.16, 0.0, -0.10))
    builder.add_box((0.045, 0.035, 0.62), (0.86, -0.31, 1.24), "brass_dark", "right_forearm", rotation=(0.16, 0.0, -0.10))


def build_mesh(armature, bone_names):
    materials = make_materials()
    builder = MeshBuilder(materials)
    add_body(builder)
    add_head(builder)
    add_limbs(builder)
    return builder.build_object("H01_blender_privateer_skinned_mesh", bone_names, armature)


def reset_pose(armature):
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode="POSE")
    for pose_bone in armature.pose.bones:
        pose_bone.rotation_mode = "XYZ"
        pose_bone.rotation_euler = (0.0, 0.0, 0.0)
        pose_bone.location = (0.0, 0.0, 0.0)
        pose_bone.scale = (1.0, 1.0, 1.0)
    bpy.ops.object.mode_set(mode="OBJECT")


def set_key(armature, frame, rotations=None, locations=None):
    rotations = rotations or {}
    locations = locations or {}
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode="POSE")
    for pose_bone in armature.pose.bones:
        pose_bone.rotation_mode = "XYZ"
        pose_bone.rotation_euler = rotations.get(pose_bone.name, (0.0, 0.0, 0.0))
        pose_bone.location = locations.get(pose_bone.name, (0.0, 0.0, 0.0))
        pose_bone.keyframe_insert(data_path="rotation_euler", frame=frame)
        pose_bone.keyframe_insert(data_path="location", frame=frame)
    bpy.ops.object.mode_set(mode="OBJECT")


def create_action(armature, name, keys):
    reset_pose(armature)
    action = bpy.data.actions.new(name)
    armature.animation_data_create()
    armature.animation_data.action = action
    for frame, rotations, locations in keys:
        set_key(armature, frame, rotations, locations)
    action.frame_start = min(frame for frame, _rot, _loc in keys)
    action.frame_end = max(frame for frame, _rot, _loc in keys)

    track = armature.animation_data.nla_tracks.new()
    track.name = name
    strip = track.strips.new(name, int(action.frame_start), action)
    strip.name = name
    strip.frame_end = action.frame_end
    track.mute = True
    armature.animation_data.action = None
    reset_pose(armature)
    return action


def build_actions(armature):
    create_action(
        armature,
        "Idle",
        [
            (1, {"spine": (0.02, 0.0, 0.0), "head": (-0.02, 0.0, 0.0)}, {"root": (0.0, 0.0, 0.0)}),
            (24, {"spine": (-0.025, 0.0, 0.02), "head": (0.02, 0.0, -0.02)}, {"root": (0.0, 0.0, 0.025)}),
            (48, {"spine": (0.02, 0.0, 0.0), "head": (-0.02, 0.0, 0.0)}, {"root": (0.0, 0.0, 0.0)}),
        ],
    )

    walk_a = {
        "left_thigh": (0.48, 0.0, 0.0),
        "left_shin": (-0.24, 0.0, 0.0),
        "right_thigh": (-0.48, 0.0, 0.0),
        "right_shin": (0.28, 0.0, 0.0),
        "left_upper_arm": (-0.28, 0.0, 0.0),
        "right_upper_arm": (0.28, 0.0, 0.0),
        "spine": (0.02, 0.0, 0.025),
    }
    walk_b = {
        "left_thigh": (-0.48, 0.0, 0.0),
        "left_shin": (0.28, 0.0, 0.0),
        "right_thigh": (0.48, 0.0, 0.0),
        "right_shin": (-0.24, 0.0, 0.0),
        "left_upper_arm": (0.28, 0.0, 0.0),
        "right_upper_arm": (-0.28, 0.0, 0.0),
        "spine": (0.02, 0.0, -0.025),
    }
    create_action(
        armature,
        "Walk",
        [
            (1, walk_a, {"root": (0.0, 0.0, 0.015), "left_thigh": (0.0, -0.075, 0.0), "right_thigh": (0.0, 0.075, 0.0)}),
            (13, {}, {"root": (0.0, 0.0, 0.045)}),
            (25, walk_b, {"root": (0.0, 0.0, 0.015), "left_thigh": (0.0, 0.075, 0.0), "right_thigh": (0.0, -0.075, 0.0)}),
            (37, {}, {"root": (0.0, 0.0, 0.045)}),
            (49, walk_a, {"root": (0.0, 0.0, 0.015), "left_thigh": (0.0, -0.075, 0.0), "right_thigh": (0.0, 0.075, 0.0)}),
        ],
    )

    run_a = {
        "spine": (0.11, 0.0, 0.03),
        "left_thigh": (0.72, 0.0, 0.0),
        "left_shin": (-0.38, 0.0, 0.0),
        "right_thigh": (-0.66, 0.0, 0.0),
        "right_shin": (0.44, 0.0, 0.0),
        "left_upper_arm": (-0.38, 0.0, 0.0),
        "right_upper_arm": (0.38, 0.0, 0.0),
    }
    run_b = {
        "spine": (0.11, 0.0, -0.03),
        "left_thigh": (-0.66, 0.0, 0.0),
        "left_shin": (0.44, 0.0, 0.0),
        "right_thigh": (0.72, 0.0, 0.0),
        "right_shin": (-0.38, 0.0, 0.0),
        "left_upper_arm": (0.38, 0.0, 0.0),
        "right_upper_arm": (-0.38, 0.0, 0.0),
    }
    create_action(
        armature,
        "Run",
        [
            (1, run_a, {"root": (0.0, 0.0, 0.035), "left_thigh": (0.0, -0.11, 0.0), "right_thigh": (0.0, 0.11, 0.0)}),
            (9, {}, {"root": (0.0, 0.0, 0.08)}),
            (17, run_b, {"root": (0.0, 0.0, 0.035), "left_thigh": (0.0, 0.11, 0.0), "right_thigh": (0.0, -0.11, 0.0)}),
            (25, {}, {"root": (0.0, 0.0, 0.08)}),
            (33, run_a, {"root": (0.0, 0.0, 0.035), "left_thigh": (0.0, -0.11, 0.0), "right_thigh": (0.0, 0.11, 0.0)}),
        ],
    )

    create_action(
        armature,
        "Attack",
        [
            (
                1,
                {"spine": (0.0, 0.0, -0.10), "right_upper_arm": (0.20, -0.12, 0.12), "right_forearm": (0.08, 0.0, 0.0)},
                {"root": (0.0, 0.0, 0.02)},
            ),
            (
                10,
                {
                    "spine": (-0.05, 0.0, 0.22),
                    "head": (0.03, 0.0, 0.10),
                    "right_upper_arm": (-0.76, -0.22, -0.18),
                    "right_forearm": (-0.35, 0.08, -0.20),
                    "left_upper_arm": (0.18, 0.0, -0.12),
                },
                {"root": (0.0, -0.02, 0.05)},
            ),
            (
                18,
                {
                    "spine": (0.12, 0.0, -0.30),
                    "head": (-0.05, 0.0, -0.15),
                    "right_upper_arm": (0.78, 0.08, 0.42),
                    "right_forearm": (0.46, -0.12, 0.18),
                    "left_upper_arm": (-0.22, 0.0, 0.16),
                },
                {"root": (0.0, -0.09, 0.04)},
            ),
            (
                30,
                {"spine": (0.0, 0.0, -0.10), "right_upper_arm": (0.20, -0.12, 0.12), "right_forearm": (0.08, 0.0, 0.0)},
                {"root": (0.0, 0.0, 0.02)},
            ),
        ],
    )


def export_glb(armature, mesh):
    OUT_GLB.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 49
    reset_pose(armature)
    bpy.ops.object.select_all(action="DESELECT")
    armature.select_set(True)
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.export_scene.gltf(
        filepath=str(OUT_GLB),
        export_format="GLB",
        use_selection=True,
        export_skins=True,
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_merge_animation="NONE",
        export_anim_single_armature=True,
        export_yup=True,
    )


def main():
    clear_scene()
    armature, bone_names = make_armature()
    mesh = build_mesh(armature, bone_names)
    build_actions(armature)
    export_glb(armature, mesh)
    PUBLIC_GLB.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(OUT_GLB, PUBLIC_GLB)
    print(f"Exported {OUT_GLB}")
    print(f"Copied runtime model {PUBLIC_GLB}")


if __name__ == "__main__":
    main()
