"""Run in a separate Blender --background process; never saves or edits the source .blend.

Blender --background --python scripts/export-logo-intro.py -- SOURCE.blend OUTPUT_DIR
"""
import bpy
import hashlib
import json
import math
import sys
from pathlib import Path

source, output = map(Path, sys.argv[sys.argv.index('--') + 1:])
output.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(source))
scene = bpy.data.scenes['NexoFolio - Primitives to Logo']
bpy.context.window.scene = scene
root = next(obj for obj in scene.objects if obj.name.startswith('NexoFolio_Root'))
meshes = [next(obj for obj in scene.objects if obj.type == 'MESH' and obj.name.startswith(name)) for name in ['Left_Obsidian', 'Right_Prismatic']]
hinges = [next(obj for obj in scene.objects if obj.name.startswith(name)) for name in ['Left_Hinge', 'Right_Hinge']]
spins = [next(obj for obj in scene.objects if obj.name.startswith(name)) for name in ['Spin_Left', 'Spin_Right']]
primitive_names = ['Primitive_Rectangle', 'Primitive_Triangle']
frames = []
camera_states = []
audit = []
for index, mesh in enumerate(meshes):
    assert mesh.parent == spins[index] and spins[index].parent == hinges[index]
    assert 'Jelly_Compression' in mesh.data.shape_keys.key_blocks
    assert primitive_names[index] in mesh.data.shape_keys.key_blocks

for frame in range(1, 193):
    scene.frame_set(frame)
    bpy.context.view_layer.update()
    camera_states.append([*[float(v) for row in scene.camera.matrix_world for v in row], float(scene.camera.data.ortho_scale)])
    # The existing frontend uses X/right, Y/up, Z/depth; Blender is X/right, Z/up.
    parts = []
    for index, mesh in enumerate(meshes):
        hinge, spin = hinges[index], spins[index]
        assert max(abs(v - 1) for v in hinge.scale) < 1e-6
        assert max(abs(v - 1) for v in spin.scale) < 1e-6
        assert abs(hinge.location.y) < 1e-6
        assert abs(hinge.rotation_euler.x) + abs(hinge.rotation_euler.z) < 1e-6
        assert abs(spin.rotation_euler.x) + abs(spin.rotation_euler.y) < 1e-6
        keys = mesh.data.shape_keys.key_blocks
        parts.append({'x': hinge.location.x, 'y': hinge.location.z, 'roll': -hinge.rotation_euler.y, 'spin': spin.rotation_euler.z, 'jelly': keys['Jelly_Compression'].value, 'primitive': keys[primitive_names[index]].value})
    frames.append({'rootY': root.location.z, 'parts': parts})
    if frame in [1, 43, 70, 73, 116, 192]:
        audit.append({'frame': frame, 'parts': parts, 'worldMatrices': [[[float(v) for v in row] for row in mesh.matrix_world] for mesh in meshes]})

assert all(max(abs(a-b) for a,b in zip(camera_states[0], state)) < 1e-6 for state in camera_states)
assert all(abs(part['primitive'] - 1) < 1e-6 for part in frames[0]['parts'])
assert all(abs(part['primitive']) < 1e-6 for part in frames[69]['parts'])
assert all(abs(part['jelly'] - 1) < 1e-6 for part in frames[115]['parts'])
for index, part in enumerate(frames[-1]['parts']):
    assert abs(part['spin'] - (1 if index == 0 else -1) * 7 * math.tau) < 1e-5
    assert abs(part['primitive']) + abs(part['jelly']) < 1e-6
    assert abs(part['x'] - [.35, .53][index]) < 1e-6

# Export at the equivalent rest orientation, retaining both explicit spin pivots.
scene.frame_set(192)
for obj in [root, *hinges, *spins, *[mesh.data.shape_keys for mesh in meshes]]:
    obj.animation_data_clear()
for spin in spins:
    spin.rotation_euler.z = 0
for mesh in meshes:
    for key in mesh.data.shape_keys.key_blocks:
        key.value = 0
bpy.context.view_layer.update()
bpy.ops.object.select_all(action='DESELECT')
for obj in [root, *hinges, *spins, *meshes]:
    obj.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.export_scene.gltf(filepath=str(output/'nexofolio-elastic.glb'), export_format='GLB', use_selection=True, export_apply=False, export_animations=False, export_current_frame=True, export_morph=True)
timeline = {'version': 2, 'fps': 30, 'duration': 6.4, 'frames': frames, 'primitiveNames': primitive_names}
(output/'intro-timeline.json').write_text(json.dumps(timeline, separators=(',', ':')))
(output/'intro-export.json').write_text(json.dumps({'source': str(source), 'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'fps': 30, 'frames': len(frames), 'duration': 6.4, 'cameraFixed': True, 'cameraOrthoScale': scene.camera.data.ortho_scale, 'spinTurns': [7, -7], 'hierarchy': [{'mesh': mesh.name, 'spin': mesh.parent.name, 'hinge': mesh.parent.parent.name, 'morphNames': [key.name for key in mesh.data.shape_keys.key_blocks][1:]} for mesh in meshes], 'keyframes': audit}, indent=2))
print('EXPORTED_SHAPE_SPIN', output, flush=True)
