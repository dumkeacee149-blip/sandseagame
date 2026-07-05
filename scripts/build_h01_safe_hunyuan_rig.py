import math
import os

import bpy


ROOT = "/Users/a7/我的世界"
RAW_DIR = os.path.join(ROOT, "assets", "hunyuan", "raw")
BASE_FBX = os.path.join(RAW_DIR, "H01_hero_rigged_v1.fbx")
OUT_GLB = os.path.join(RAW_DIR, "H01_hero_rigged_v1.glb")


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)


def import_base():
    bpy.ops.import_scene.fbx(filepath=BASE_FBX)
    armature = next(obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE")
    mesh = next(obj for obj in bpy.context.scene.objects if obj.type == "MESH")
    armature.name = "H01_Armature"
    mesh.name = "H01_Hero_Skinned"
    fix_weapon_skinning(mesh)
    return armature, mesh


def fix_weapon_skinning(mesh):
    right_hand = mesh.vertex_groups.get("RightHand")
    if not right_hand:
        return

    # The Hunyuan auto-skin spreads the saw blade across neighboring bones.
    # Keep the blade rigid on the hand to avoid smeared sword silhouettes in motion.
    blade_indices = []
    for vertex in mesh.data.vertices:
        world = mesh.matrix_world @ vertex.co
        if world.x < -0.18 and world.y < -0.24 and 0.22 < world.z < 1.32:
            blade_indices.append(vertex.index)

    for group in mesh.vertex_groups:
        try:
            group.remove(blade_indices)
        except RuntimeError:
            pass
    right_hand.add(blade_indices, 1.0, "REPLACE")


def reset_pose(armature):
    for bone in armature.pose.bones:
        bone.rotation_mode = "XYZ"
        bone.rotation_euler = (0.0, 0.0, 0.0)
        bone.location = (0.0, 0.0, 0.0)
        bone.scale = (1.0, 1.0, 1.0)


def apply_pose(armature, rotations=None, locations=None):
    rotations = rotations or {}
    locations = locations or {}
    for name, rot in rotations.items():
        if name in armature.pose.bones:
            armature.pose.bones[name].rotation_euler = tuple(math.radians(v) for v in rot)
    for name, loc in locations.items():
        if name in armature.pose.bones:
            armature.pose.bones[name].location = loc


def key_pose(armature, frame, rotations=None, locations=None):
    bpy.context.scene.frame_set(frame)
    reset_pose(armature)
    apply_pose(armature, rotations, locations)
    for bone in armature.pose.bones:
        bone.keyframe_insert(data_path="rotation_euler", frame=frame)
        bone.keyframe_insert(data_path="location", frame=frame)
        bone.keyframe_insert(data_path="scale", frame=frame)


def make_action(armature, name, frames):
    action = bpy.data.actions.new(name=name)
    action.use_fake_user = True
    armature.animation_data_create()
    armature.animation_data.action = action
    for frame, rotations, locations in frames:
        key_pose(armature, frame, rotations, locations)
    return action


def build_actions(armature):
    make_action(
        armature,
        "Idle",
        [
            (1, {"Spine2": (1, 0, 0), "Head": (-1, 0, 0)}, {"Hips": (0, 0, 0)}),
            (31, {"Spine2": (-2, 0, 1), "Head": (1, 0, -1)}, {"Hips": (0, 0, 0.012)}),
            (61, {"Spine2": (1, 0, 0), "Head": (-1, 0, 0)}, {"Hips": (0, 0, 0)}),
        ],
    )

    make_action(
        armature,
        "Walk",
        [
            (
                1,
                {
                    "LeftUpLeg": (14, 0, 0),
                    "LeftLeg": (-8, 0, 0),
                    "RightUpLeg": (-12, 0, 0),
                    "RightLeg": (10, 0, 0),
                    "LeftArm": (-4, 0, 2),
                    "RightArm": (2, 0, -1),
                    "Spine2": (0, 0, -2),
                },
                {"Hips": (0, 0, 0.0)},
            ),
            (
                19,
                {
                    "LeftUpLeg": (-12, 0, 0),
                    "LeftLeg": (10, 0, 0),
                    "RightUpLeg": (14, 0, 0),
                    "RightLeg": (-8, 0, 0),
                    "LeftArm": (4, 0, -2),
                    "RightArm": (-2, 0, 1),
                    "Spine2": (0, 0, 2),
                },
                {"Hips": (0, 0, 0.018)},
            ),
            (
                37,
                {
                    "LeftUpLeg": (14, 0, 0),
                    "LeftLeg": (-8, 0, 0),
                    "RightUpLeg": (-12, 0, 0),
                    "RightLeg": (10, 0, 0),
                    "LeftArm": (-4, 0, 2),
                    "RightArm": (2, 0, -1),
                    "Spine2": (0, 0, -2),
                },
                {"Hips": (0, 0, 0.0)},
            ),
        ],
    )

    make_action(
        armature,
        "Run",
        [
            (
                1,
                {
                    "Spine": (4, 0, 0),
                    "Spine2": (5, 0, -3),
                    "LeftUpLeg": (22, 0, 0),
                    "LeftLeg": (-16, 0, 0),
                    "RightUpLeg": (-18, 0, 0),
                    "RightLeg": (18, 0, 0),
                    "LeftArm": (-6, 0, 2),
                    "RightArm": (2, 0, -1),
                },
                {"Hips": (0, 0, 0.0)},
            ),
            (
                13,
                {
                    "Spine": (4, 0, 0),
                    "Spine2": (5, 0, 3),
                    "LeftUpLeg": (-18, 0, 0),
                    "LeftLeg": (18, 0, 0),
                    "RightUpLeg": (22, 0, 0),
                    "RightLeg": (-16, 0, 0),
                    "LeftArm": (6, 0, -2),
                    "RightArm": (-2, 0, 1),
                },
                {"Hips": (0, 0, 0.025)},
            ),
            (
                25,
                {
                    "Spine": (4, 0, 0),
                    "Spine2": (5, 0, -3),
                    "LeftUpLeg": (22, 0, 0),
                    "LeftLeg": (-16, 0, 0),
                    "RightUpLeg": (-18, 0, 0),
                    "RightLeg": (18, 0, 0),
                    "LeftArm": (-6, 0, 2),
                    "RightArm": (2, 0, -1),
                },
                {"Hips": (0, 0, 0.0)},
            ),
        ],
    )

    make_action(
        armature,
        "Attack",
        [
            (1, {"Spine2": (0, 0, 0), "RightArm": (0, 0, 0), "RightForeArm": (0, 0, 0)}, {}),
            (
                12,
                {
                    "Spine": (2, 0, -7),
                    "Spine2": (4, 0, -10),
                    "RightArm": (-8, 0, -8),
                    "RightForeArm": (6, 0, -4),
                    "Head": (-2, 0, 4),
                },
                {"Hips": (0, 0, 0.01)},
            ),
            (
                24,
                {
                    "Spine": (0, 0, 8),
                    "Spine2": (2, 0, 13),
                    "RightArm": (10, 0, 8),
                    "RightForeArm": (-8, 0, 3),
                    "Head": (0, 0, -5),
                },
                {"Hips": (0, 0, 0.0)},
            ),
            (38, {"Spine2": (0, 0, 0), "RightArm": (0, 0, 0), "RightForeArm": (0, 0, 0)}, {}),
        ],
    )


def export_glb(armature, mesh):
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 61
    reset_pose(armature)
    bpy.ops.object.select_all(action="DESELECT")
    armature.select_set(True)
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = armature
    for obj in list(bpy.context.scene.objects):
        if obj not in {armature, mesh}:
            bpy.data.objects.remove(obj, do_unlink=True)
    bpy.ops.export_scene.gltf(
        filepath=OUT_GLB,
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
    armature, mesh = import_base()
    build_actions(armature)
    export_glb(armature, mesh)


if __name__ == "__main__":
    main()
