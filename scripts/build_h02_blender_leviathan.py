import math
import shutil
from pathlib import Path

import bpy
from mathutils import Euler, Vector


ROOT = Path(__file__).resolve().parents[1]
OUT_GLB = ROOT / "assets" / "hunyuan" / "raw" / "H02_sand_leviathan_rigged_v1.glb"
PUBLIC_GLB = ROOT / "public" / "models" / "leviathan_rigged.glb"


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
        "shell": make_mat("h02_voxel_burnt_red_shell", (0.58, 0.16, 0.08, 1.0)),
        "shell_hi": make_mat("h02_voxel_sunlit_shell", (0.76, 0.27, 0.12, 1.0)),
        "shell_tip": make_mat("h02_voxel_hot_shell_edges", (0.90, 0.38, 0.16, 1.0)),
        "shell_dark": make_mat("h02_voxel_dark_plate_gaps", (0.23, 0.07, 0.04, 1.0)),
        "belly": make_mat("h02_voxel_sand_belly", (0.66, 0.45, 0.27, 1.0)),
        "belly_dark": make_mat("h02_voxel_shadowed_belly", (0.46, 0.28, 0.16, 1.0)),
        "bone": make_mat("h02_voxel_ivory_bone", (0.83, 0.74, 0.55, 1.0)),
        "bone_dark": make_mat("h02_voxel_old_bone_edges", (0.58, 0.48, 0.34, 1.0)),
        "claw": make_mat("h02_voxel_dark_claw", (0.18, 0.11, 0.08, 1.0)),
        "eye": make_mat("h02_voxel_teal_eye", (0.0, 0.86, 0.78, 1.0)),
        "shadow": make_mat("h02_voxel_mouth_shadow", (0.06, 0.03, 0.025, 1.0)),
        "sand": make_mat("h02_voxel_dust_accent", (0.90, 0.68, 0.34, 1.0)),
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
        modifier = obj.modifiers.new("H02_BlockyArmature", "ARMATURE")
        modifier.object = armature
        return obj


def make_armature():
    bone_specs = [
        ("root", (0.0, -2.45, 0.72), (0.0, -2.45, 1.35), None),
        ("head", (0.0, -2.40, 0.74), (0.0, -1.86, 0.82), "root"),
        ("body_01", (0.0, -1.76, 0.72), (0.0, -1.18, 0.75), "head"),
        ("body_02", (0.0, -1.18, 0.75), (0.0, -0.58, 0.79), "body_01"),
        ("body_03", (0.0, -0.58, 0.79), (0.0, 0.02, 0.81), "body_02"),
        ("body_04", (0.0, 0.02, 0.81), (0.0, 0.62, 0.80), "body_03"),
        ("body_05", (0.0, 0.62, 0.80), (0.0, 1.22, 0.76), "body_04"),
        ("body_06", (0.0, 1.22, 0.76), (0.0, 1.82, 0.70), "body_05"),
        ("body_07", (0.0, 1.82, 0.70), (0.0, 2.36, 0.63), "body_06"),
        ("tail_01", (0.0, 2.36, 0.63), (0.0, 2.94, 0.56), "body_07"),
        ("tail_02", (0.0, 2.94, 0.56), (0.0, 3.56, 0.48), "tail_01"),
        ("jaw_upper", (0.0, -2.36, 0.92), (0.0, -2.90, 1.02), "head"),
        ("jaw_lower", (0.0, -2.34, 0.46), (0.0, -2.86, 0.34), "head"),
    ]

    arm_data = bpy.data.armatures.new("H02_sand_leviathan_armature_data")
    arm_data.display_type = "STICK"
    arm = bpy.data.objects.new("H02_sand_leviathan_armature", arm_data)
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
    centers = [-1.48, -0.90, -0.30, 0.30, 0.90, 1.48, 2.02]
    widths = [1.38, 1.95, 2.38, 2.55, 2.32, 1.78, 1.24]
    heights = [0.74, 0.98, 1.14, 1.18, 1.02, 0.80, 0.58]
    lengths = [0.62, 0.66, 0.68, 0.68, 0.64, 0.60, 0.54]

    for idx, (y, width, height, length) in enumerate(zip(centers, widths, heights, lengths), start=1):
        bone = f"body_{idx:02d}"
        belly_z = 0.34 + height * 0.24
        top_z = belly_z + height * 0.47
        builder.add_box((width * 0.82, length, height * 0.52), (0.0, y, belly_z), "belly", bone)
        builder.add_box((width * 0.46, length * 0.94, 0.24), (0.0, y - 0.02, top_z), "shell_hi", bone)
        builder.add_box((width * 0.28, length * 0.88, 0.22), (-width * 0.31, y, top_z - 0.04), "shell", bone)
        builder.add_box((width * 0.28, length * 0.88, 0.22), (width * 0.31, y, top_z - 0.04), "shell", bone)
        builder.add_box((0.09, length * 0.98, 0.27), (0.0, y - 0.02, top_z - 0.02), "shell_dark", bone)
        builder.add_box((0.24, length * 0.76, 0.22), (-width * 0.54, y, belly_z + 0.08), "bone", bone)
        builder.add_box((0.24, length * 0.76, 0.22), (width * 0.54, y, belly_z + 0.08), "bone", bone)
        builder.add_box((width * 0.34, length * 0.18, 0.11), (0.0, y - length * 0.29, top_z + 0.16), "shell_tip", bone)
        builder.add_box((width * 0.38, length * 0.16, 0.10), (0.0, y + length * 0.03, top_z + 0.17), "shell_tip", bone)
        builder.add_box((width * 0.30, length * 0.15, 0.09), (0.0, y + length * 0.31, top_z + 0.14), "shell", bone)
        builder.add_box((0.08, length * 0.64, 0.10), (-width * 0.18, y, top_z + 0.12), "shell_dark", bone)
        builder.add_box((0.08, length * 0.64, 0.10), (width * 0.18, y, top_z + 0.12), "shell_dark", bone)
        builder.add_box((width * 0.18, length * 0.18, 0.14), (-width * 0.42, y - length * 0.22, belly_z + 0.26), "bone_dark", bone)
        builder.add_box((width * 0.18, length * 0.18, 0.14), (width * 0.42, y - length * 0.22, belly_z + 0.26), "bone_dark", bone)
        builder.add_box((width * 0.20, length * 0.18, 0.13), (-width * 0.43, y + length * 0.20, belly_z + 0.22), "bone", bone)
        builder.add_box((width * 0.20, length * 0.18, 0.13), (width * 0.43, y + length * 0.20, belly_z + 0.22), "bone", bone)
        builder.add_box((width * 0.52, length * 0.16, 0.09), (0.0, y + length * 0.34, belly_z - height * 0.21), "belly_dark", bone)

        if idx in (2, 3, 4, 5, 6):
            builder.add_box((0.18, 0.22, 0.38), (-0.34, y - 0.05, top_z + 0.28), "claw", bone)
            builder.add_box((0.18, 0.22, 0.38), (0.34, y - 0.05, top_z + 0.28), "claw", bone)
            builder.add_box((0.12, 0.16, 0.28), (0.0, y + 0.18, top_z + 0.24), "claw", bone)
        if idx in (2, 3, 4, 5):
            for side in (-1, 1):
                sx = side * width * 0.56
                builder.add_box(
                    (0.24, 0.24, 0.42),
                    (sx + side * 0.13, y - 0.09, belly_z - 0.18),
                    "claw",
                    bone,
                    rotation=(0.0, side * 0.30, side * 0.34),
                )
                builder.add_box(
                    (0.20, 0.22, 0.40),
                    (sx + side * 0.29, y - 0.18, belly_z - 0.43),
                    "claw",
                    bone,
                    rotation=(0.08, side * 0.36, side * 0.56),
                )
                builder.add_box(
                    (0.22, 0.18, 0.18),
                    (sx + side * 0.24, y - 0.12, belly_z - 0.30),
                    "bone_dark",
                    bone,
                    rotation=(0.0, side * 0.24, side * 0.44),
                )
                builder.add_box(
                    (0.30, 0.18, 0.22),
                    (sx + side * 0.47, y - 0.30, belly_z - 0.66),
                    "bone",
                    bone,
                    rotation=(0.12, side * 0.48, side * 0.68),
                )
                builder.add_box(
                    (0.13, 0.12, 0.24),
                    (sx + side * 0.61, y - 0.36, belly_z - 0.69),
                    "bone",
                    bone,
                    rotation=(0.02, side * 0.64, side * 0.72),
                )


def add_head(builder):
    builder.add_box((1.46, 0.72, 0.72), (0.0, -2.03, 0.73), "shell", "head")
    builder.add_box((1.16, 0.32, 0.26), (0.0, -2.38, 1.03), "shell_dark", "head")
    builder.add_box((1.05, 0.30, 0.38), (0.0, -2.53, 0.78), "shell_hi", "head")
    builder.add_box((0.72, 0.18, 0.16), (0.0, -2.18, 1.18), "shell_tip", "head")
    builder.add_box((0.48, 0.16, 0.16), (0.0, -2.50, 1.20), "shell", "head")
    builder.add_box((0.12, 0.54, 0.18), (-0.46, -2.20, 1.02), "shell_dark", "head")
    builder.add_box((0.12, 0.54, 0.18), (0.46, -2.20, 1.02), "shell_dark", "head")
    builder.add_box((0.82, 0.30, 0.18), (0.0, -2.70, 1.05), "bone", "jaw_upper")
    builder.add_box((0.78, 0.36, 0.18), (0.0, -2.66, 0.38), "bone", "jaw_lower")
    builder.add_box((0.68, 0.20, 0.20), (0.0, -2.66, 0.69), "shadow", "head")
    builder.add_box((0.48, 0.06, 0.08), (0.0, -2.84, 0.68), "shadow", "head")
    builder.add_box((0.12, 0.06, 0.08), (-0.22, -2.88, 0.86), "shadow", "head")
    builder.add_box((0.12, 0.06, 0.08), (0.22, -2.88, 0.86), "shadow", "head")

    for side in (-1, 1):
        builder.add_box((0.22, 0.07, 0.17), (side * 0.34, -2.73, 0.91), "eye", "head")
        builder.add_box((0.30, 0.08, 0.09), (side * 0.34, -2.70, 1.03), "bone_dark", "head")
        builder.add_box((0.22, 0.40, 0.36), (side * 0.72, -2.18, 0.58), "bone", "head")
        builder.add_box((0.18, 0.34, 0.20), (side * 0.86, -2.28, 0.76), "bone_dark", "head")
        builder.add_box(
            (0.14, 0.12, 0.45),
            (side * 0.36, -2.88, 0.72),
            "bone",
            "jaw_upper",
            rotation=(0.28, side * 0.20, 0.0),
        )
        builder.add_box(
            (0.10, 0.10, 0.30),
            (side * 0.12, -2.90, 0.74),
            "bone",
            "jaw_upper",
            rotation=(0.25, side * 0.10, 0.0),
        )
        builder.add_box(
            (0.10, 0.10, 0.30),
            (side * 0.58, -2.82, 0.70),
            "bone_dark",
            "jaw_upper",
            rotation=(0.34, side * 0.28, 0.0),
        )
        builder.add_box(
            (0.12, 0.11, 0.36),
            (side * 0.32, -2.86, 0.48),
            "bone",
            "jaw_lower",
            rotation=(-0.24, side * 0.12, 0.0),
        )
        builder.add_box(
            (0.09, 0.10, 0.24),
            (side * 0.10, -2.88, 0.48),
            "bone",
            "jaw_lower",
            rotation=(-0.22, side * 0.08, 0.0),
        )
        builder.add_box(
            (0.16, 0.18, 0.42),
            (side * 0.62, -2.02, 1.12),
            "claw",
            "head",
            rotation=(0.0, side * 0.30, 0.0),
        )
        builder.add_box(
            (0.12, 0.18, 0.34),
            (side * 0.42, -1.76, 1.20),
            "claw",
            "head",
            rotation=(0.0, side * 0.22, side * 0.10),
        )
        builder.add_box(
            (0.14, 0.34, 0.12),
            (side * 0.92, -2.06, 0.46),
            "bone",
            "head",
            rotation=(0.0, side * 0.36, side * 0.12),
        )


def add_tail(builder):
    builder.add_box((0.96, 0.58, 0.42), (0.0, 2.58, 0.57), "shell", "tail_01")
    builder.add_box((0.70, 0.60, 0.32), (0.0, 3.06, 0.50), "shell_dark", "tail_01")
    builder.add_box((0.46, 0.58, 0.24), (0.0, 3.50, 0.45), "bone", "tail_02")
    builder.add_box((0.62, 0.22, 0.18), (0.0, 2.54, 0.84), "shell_hi", "tail_01")
    builder.add_box((0.48, 0.20, 0.16), (0.0, 2.90, 0.75), "shell", "tail_01")
    builder.add_box((0.34, 0.20, 0.14), (0.0, 3.26, 0.66), "shell_tip", "tail_02")
    builder.add_box((0.16, 0.34, 0.16), (-0.38, 2.70, 0.52), "bone", "tail_01")
    builder.add_box((0.16, 0.34, 0.16), (0.38, 2.70, 0.52), "bone", "tail_01")
    builder.add_box((0.13, 0.28, 0.13), (-0.28, 3.18, 0.45), "bone_dark", "tail_02")
    builder.add_box((0.13, 0.28, 0.13), (0.28, 3.18, 0.45), "bone_dark", "tail_02")
    builder.add_box((0.18, 0.34, 0.34), (0.0, 3.28, 0.78), "claw", "tail_02", rotation=(0.25, 0.0, 0.0))
    builder.add_box((0.14, 0.24, 0.26), (-0.20, 3.42, 0.66), "claw", "tail_02", rotation=(0.12, 0.18, 0.0))
    builder.add_box((0.14, 0.24, 0.26), (0.20, 3.42, 0.66), "claw", "tail_02", rotation=(0.12, -0.18, 0.0))
    builder.add_box((0.38, 0.24, 0.16), (0.0, 3.80, 0.43), "bone", "tail_02", rotation=(0.0, 0.0, 0.0))
    builder.add_box((0.26, 0.14, 0.12), (0.0, 3.98, 0.44), "bone_dark", "tail_02", rotation=(0.0, 0.0, 0.0))


def build_mesh(armature, bone_names):
    materials = make_materials()
    builder = MeshBuilder(materials)
    add_head(builder)
    add_body(builder)
    add_tail(builder)
    return builder.build_object("H02_sand_leviathan_skinned_mesh", bone_names, armature)


def reset_pose(armature):
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode="POSE")
    for pose_bone in armature.pose.bones:
        pose_bone.rotation_mode = "XYZ"
        pose_bone.rotation_euler = (0.0, 0.0, 0.0)
        pose_bone.location = (0.0, 0.0, 0.0)
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
    body_bones = [f"body_{idx:02d}" for idx in range(1, 8)]

    swim_keys = []
    for frame, phase in [(1, 0.0), (14, math.pi), (28, math.tau)]:
        rotations = {"head": (0.02 * math.sin(phase), 0.0, 0.12 * math.sin(phase - 0.5))}
        for idx, bone in enumerate(body_bones):
            rotations[bone] = (
                0.02 * math.sin(phase + idx * 0.55),
                0.0,
                0.16 * math.sin(phase + idx * 0.62),
            )
        rotations["tail_01"] = (0.0, 0.0, 0.24 * math.sin(phase + 4.4))
        rotations["tail_02"] = (0.0, 0.0, 0.34 * math.sin(phase + 5.0))
        swim_keys.append((frame, rotations, {"root": (0.0, 0.0, 0.04 if frame == 14 else 0.0)}))
    create_action(armature, "Swim", swim_keys)

    burrow_keys = []
    for frame, drop, curl in [(1, 0.0, 0.0), (12, -0.12, 0.55), (24, -0.04, 0.22), (36, 0.0, 0.0)]:
        rotations = {"head": (-0.18 * curl, 0.0, -0.10 * curl)}
        for idx, bone in enumerate(body_bones):
            rotations[bone] = (-0.05 * idx * curl, 0.0, math.sin(idx * 0.8) * 0.12 * curl)
        rotations["tail_01"] = (-0.20 * curl, 0.0, 0.18 * curl)
        rotations["tail_02"] = (-0.28 * curl, 0.0, 0.28 * curl)
        burrow_keys.append((frame, rotations, {"root": (0.0, 0.0, drop)}))
    create_action(armature, "Burrow", burrow_keys)

    create_action(
        armature,
        "Bite",
        [
            (
                1,
                {"head": (0.0, 0.0, 0.0), "jaw_upper": (0.0, 0.0, 0.0), "jaw_lower": (0.0, 0.0, 0.0)},
                {"root": (0.0, 0.0, 0.0)},
            ),
            (
                9,
                {
                    "head": (-0.12, 0.0, 0.0),
                    "body_01": (-0.05, 0.0, 0.05),
                    "jaw_upper": (-0.30, 0.0, 0.0),
                    "jaw_lower": (0.58, 0.0, 0.0),
                },
                {"root": (0.0, -0.06, 0.04)},
            ),
            (
                16,
                {
                    "head": (0.18, 0.0, 0.0),
                    "body_01": (0.08, 0.0, -0.04),
                    "body_02": (-0.06, 0.0, 0.02),
                    "jaw_upper": (0.15, 0.0, 0.0),
                    "jaw_lower": (-0.22, 0.0, 0.0),
                },
                {"root": (0.0, -0.14, 0.03)},
            ),
            (
                26,
                {"head": (0.0, 0.0, 0.0), "jaw_upper": (0.0, 0.0, 0.0), "jaw_lower": (0.0, 0.0, 0.0)},
                {"root": (0.0, 0.0, 0.0)},
            ),
        ],
    )


def export_glb(armature, mesh):
    OUT_GLB.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 36
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
