# Sandsea Privateers Environment Asset Checklist

Environment assets are approved separately from character, vehicle, and prop assets. Hunyuan world-generation outputs define the broad art mood; Hunyuan GLB modules define game-ready terrain pieces.

| ID | Asset | Hunyuan Route | Prompt | Acceptance Bar |
| --- | --- | --- | --- | --- |
| E00 | Sandsea World Mood | 3D World / World Generation | 我的世界风像素方块沙海环境，金色移动沙丘，远处绿洲城镇和黑石遗迹，橙色天空，青色符文光，低模游戏场景 | Establishes sky color, far dunes, oasis/ruin silhouettes, and sandsea mood. Can be reference if not runtime-ready. |
| E01 | Sky Panorama | 3D World / 360 Panorama | 我的世界风像素方块沙海天空全景，金色沙丘地平线，青蓝高空，橙色夕阳，远处沙暴云墙，低模游戏天空盒 | Skybox reference or source image; horizon must be useful in-game and not realistic stock photo. |
| E02 | Rolling Dune Tile | Text-to-3D | 我的世界风方块体素沙海地块，金色移动沙丘，盐白硬地纹，少量风蚀石块，硬边像素模型 | Repeatable ground tile; blocky dunes; no full scene clutter. |
| E03 | Oasis Shore Tile | Text-to-3D | 我的世界风方块体素绿洲水岸地块，浅蓝水池，砂岩台阶，棕榈阴影，红布小旗，硬边像素模型 | Town-adjacent tile; readable water edge; works with existing tent and palm assets. |
| E04 | Sunken Ruin Tile | Text-to-3D | 我的世界风方块体素半埋古代遗迹地块，黑石残墙，碎石台阶，青色符文裂缝，沙丘覆盖，硬边像素模型 | Exploration tile; clear ancient-tech glow; supports ruin gate and obelisk. |
| E05 | Sandstorm Wall | 3D World / 360 Panorama or Text-to-3D | 我的世界风像素方块沙海沙暴远景，橙灰色风暴云墙，金色沙尘，远处遗迹剪影，游戏天空背景 | Background hazard/mood layer; should read as sandstorm rather than smoke or apocalypse. |

## Approval Rule

Approve E00-E05 before gameplay production starts. Sky and sandstorm assets can be approved as panorama/reference images first; terrain modules should be downloaded as GLB and verified in the local viewer before becoming runtime assets.
