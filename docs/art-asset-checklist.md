# Sandsea Privateers Art Asset Checklist

Before game implementation, approve these core 3D assets as the visual baseline. The local asset board is the source of truth for pixelated/blocky style; Hunyuan prompts are only for optional replacement candidates. Keep generation prompts short because the Hunyuan web UI currently limits text prompts to 150 characters.

| ID | Asset | Hunyuan Prompt | Acceptance Bar |
| --- | --- | --- | --- |
| A01 | Wind-Sail Sand Skiff | 方块体素风沙海风帆沙舟，像素化木质船身，双黄铜滑橇，红色方块三角帆，青色发光方块引擎，硬边低模，独立模型 | Reads as the main vehicle; blocky/voxel silhouette; no smooth toy finish. |
| A02 | Desert Privateer Hero | 方块体素风沙海私掠者角色，像素化头巾护目镜，短披风，皮甲，弯刀，红色和青绿色点缀，硬边低模，独立模型 | Strong readable hero silhouette; blocky body proportions; not modern military. |
| A03 | Oasis Market Tent | 方块体素风绿洲集市帐篷，像素化砂岩底座，红色方块布棚，木箱，铜灯，青绿色水壶，硬边低模，独立模型 | Useful as town module; blocky cloth/props; warm cloth + teal accents. |
| A04 | Oasis Palm | 方块体素风沙漠绿洲棕榈树，像素化弯曲树干，方块叶片，少量果实和布条，硬边低模，独立模型 | Chunky trunk and readable block leaves; can repeat in oasis. |
| A05 | Sunken Rune Gate | 方块体素风半埋沙中古代遗迹石门，黑色方块玄武岩柱，风化石块，青色发光像素符文，硬边低模，独立模型 | Iconic landmark; arch/gate readable from distance; cyan runes visible. |
| A06 | Rune Obelisk | 方块体素风沙漠方尖碑，像素化风蚀石面，底部半埋沙中，青色发光方块符文，硬边低模，独立模型 | Good repeatable prop; simple collision shape; strong vertical marker. |
| A07 | Sandsea Leviathan | 方块体素风沙海巨兽，红褐色方块分节甲壳身体从沙中钻出，骨色下颚，沙尘环，硬边低模，独立模型 | Boss silhouette; not horror/gore; readable mouth and segmented body. |
| A08 | Relic Chest | 方块体素风沙海遗物宝箱，像素化木箱，黄铜包角，青色发光方块核心，红布绑带，硬边低模，独立模型 | Loot object with clear reward glow; small but readable. |
| A09 | Sand Harpoon Cannon | 方块体素风沙舟鱼叉炮，像素化木制炮架，黑铁炮管，黄铜轮盘，红布标记，硬边低模，独立模型 | Weapon prop; usable on ships and forts; no modern gun look. |
| A10 | Caravan Sand Cart | 方块体素风商队沙车，像素化木车厢，双滑橇，小三角帆，货物箱和水桶，红色旗帜，硬边低模，独立模型 | Secondary vehicle; reads as trader/transport; not a normal wheeled car. |

## Approval Rule

Approve A01-A10 before gameplay production starts. The current Hunyuan candidate set is visible one-by-one in `/asset-viewer.html?asset=A01` through `/asset-viewer.html?asset=A10`; local backups stay available with `&source=local`. A Hunyuan model only passes if it looks built from cuboids rather than smoothed clay or toy plastic.
