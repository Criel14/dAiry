<p align="center">
	<img src="docs/images/logo.png" alt="dAiry" width="160">
</p>


# 简介

`dAiry` 是一个面向日常写作场景的桌面应用。它以本地 Markdown 为核心，提供轻量写作、AI 辅助整理，以及月报、年报、自定义区间总结等能力，适合每天结束时写下几十个字快速总结。

> [!tip]
>
> 代码均由 codex 编写，可以认为是一个 vibe coding 小玩具；
>
> 应用无后端，所有操作均在本地实现，AI 功能的使用需要在应用内配置 API KEY；
>
> 应用不提供云同步功能，可自行使用 git 或坚果云等方式云同步。

# 功能

- 🗂️ 本地工作区管理，日记按日期保存为 Markdown 文件
- 📝 支持今日写作、历史浏览、月历切换、Markdown 预览
- 🏷️ 支持天气、地点、心情、总结、标签等 frontmatter 信息维护
- ✨ 支持 AI 自动整理正文，生成总结、标签与心情建议
- 📊 支持月报、年报与自定义区间报告
- 🔥 支持字数热力图、情绪趋势、标签词云等可视化摘要
- 🖼️ 支持将报告导出为 PNG

# 预览

![日记编写](docs/images/日记编写.png)

![年度报告](docs/images/年度报告.png)

![年度报告_深色](docs/images/年度报告_深色.png)

# 下载

请到[发布页面](https://github.com/Criel14/dAiry/releases)下载对应的安装包

# 开发与构建

```bash
npm install
npm run dev
npm run build
```

# 开源协议

本项目采用 MIT License，详见 [LICENSE](https://github.com/Criel14/dAiry/blob/main/LICENSE) 文件
