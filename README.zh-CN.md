<p align="center">
  <img src="./assets/cyberstage-mark.svg" width="88" alt="CyberStage 标志" />
</p>

<h1 align="center">CyberStage</h1>

<p align="center"><strong>不发动攻击，只导演攻防。</strong></p>

<p align="center">
  面向影视、教学、演示、直播和视觉叙事的网络攻防场景模拟器。
</p>

<p align="center">
  <a href="https://zszbyzsz.github.io/CyberStage/"><strong>打开在线演示</strong></a>
  ·
  <a href="./README.md">English</a>
  ·
  <a href="./docs/scenario-format.md">编写新场景</a>
  ·
  <a href="./docs/scene-catalogue.md">场景目录</a>
</p>

![CyberStage 界面预览](./assets/preview.svg)

> [!IMPORTANT]
> CyberStage 是**纯展示型模拟器**，不是渗透测试工具或真实靶场。它不会扫描网络、发送数据包、执行系统命令或连接真实目标；内置地址全部来自文档专用保留网段。

## 首版已经具备什么

- **九套完整剧情**：除三套原创世界外，新增密码审计、服务器后台控制权争夺、勒索事件恢复、钓鱼会话劫持、流量洪峰和软件供应链篡改；详见[场景目录](./docs/scene-catalogue.md)。
- **可导演时间轴**：播放、暂停、拖动、循环以及 `0.5×`–`2×` 倍速。
- **动态攻防拓扑**：信号沿 SVG 链路移动，节点随事件进入观察、告警、隔离和恢复状态。
- **影视展示模式**：Broadcast Mode 会隐藏非必要面板，适合全屏录制、投屏或作为影视屏幕素材。
- **本地合成音效**：浏览器实时生成提示音，不加载远程音频。
- **节点检查器、实时指标、事件列表和仿真终端**。
- **本地 JSON 场景导入**：文件只在浏览器中读取，不会上传。
- **零运行时依赖**：原生 JavaScript、CSS 与 SVG，无需安装第三方包即可运行。

## 本地运行

Node.js 22 只用于启动轻量静态服务器和执行测试：

```bash
git clone https://github.com/zszbyzsz/CyberStage.git
cd CyberStage
npm start
```

不需要执行 `npm install`。

```bash
npm test       # 时间轴、状态归约和安全测试
npm run guard  # 语法、CSP、场景和能力边界检查
npm run build  # 生成静态 dist/ 目录
npm run check  # 执行全部检查
```

## 操作方式

| 按键 | 功能 |
| --- | --- |
| `Space` | 播放或暂停 |
| `←` / `→` | 前后移动五秒 |
| `R` | 重置场景 |
| `B` | 切换 Broadcast Mode |
| `F` | 切换全屏 |
| `1`–`9` | 快速切换场景 |

拓扑节点和事件列表也都可以点击；点击事件可直接定位到对应时间。

## 场景系统

CyberStage 采用事件溯源式 JSON 场景。每一个事件都可以改变：

- 威胁、可信度、负载和隔离进度；
- 节点及链路状态；
- 画面字幕与终端输出；
- 一条可视化的信号流。

从 [`examples/minimal-scene.json`](./examples/minimal-scene.json) 开始，参考[场景格式说明](./docs/scenario-format.md)和 [`schema/scenario.schema.json`](./schema/scenario.schema.json)。

## 安全边界

CyberStage 不是依赖“使用者自觉”来保持安全，而是在结构上限制能力：

1. 页面 CSP 明确设置 `connect-src 'none'`；
2. CI 会阻止在运行时代码中加入常见网络传输 API；
3. 导入的 JSON 必须先经过场景校验；
4. IPv4 地址只能使用三个文档专用网段；
5. 所有自定义文本在进入 HTML/SVG 前都会转义；
6. 项目不包含命令执行、原生桥接、后端服务或远程资源依赖。

详见[安全模型](./docs/safety-model.md)。

## 下一阶段

v0.1.0 是一个可以真实运行和演示的交互原型。下一阶段的核心是 **Scene Composer**：拖拽式节点编排、事件轨道、属性编辑器、撤销/重做、本地导出，以及可以共享的主题与场景包。

完整计划见[路线图](./docs/roadmap.md)。欢迎阅读 [`CONTRIBUTING.md`](./CONTRIBUTING.md) 参与项目。

## 许可证

项目采用 [MIT License](./LICENSE)。所有组织、地址、日志和事件均为虚构，不指向任何真实系统或真实事故。
