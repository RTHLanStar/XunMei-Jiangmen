# 侨乡来信 · 江门

66 秒、1920×1080、24 fps。九张独立 AI 艺术照片组成十个镜头，使用原生 1672×941 素材，输出画布为 1080P，不把源素材称为原生 1080P。素材是文化意象，不是指定地点的实拍纪录。

信笺开场在 4.5 秒内进入碉楼全景，以全景/细节交替串起碉楼窗饰、骑楼檐下、西江水岸、陈皮手艺。各镜头缓慢平移或推拉，使用 0.65 秒叠化；真实水面、人物动作没有被声称为实拍动态。淡入淡出采用 HyperFrames 官方基本交叠包络实现，registry 的整页 dissolve showcase 不适合本片简单照片交叠。

章节题签仅停留 3.2 秒；旁白分为 25 条短字幕。结尾回到空白信纸，上叠可编辑中文与 RTHLanStar 署名，最后画面保留。

声音只加载 final-mix.wav 一轨，包含原先确认的六段男声、原配乐和本地程序生成的轻微纸张/檐雨/缓水/晒篮声。所有时码来源于 captions.json；音频来源、指标和生成过程见 audio-report.json、build-audio.py。

build-video.py 生成 index.html、scenes.json、meta.json。字体采用本机 Microsoft YaHei / SimSun；需要安装相应字体后渲染。gsap.min.js 是冻结的 3.14.2 本地依赖。HyperFrames 固定 0.8.155。
