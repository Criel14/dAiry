---
name: dairy-journal-writer
description: 为本地日记工作区编写、整理或更新日记。用户说要写日记、远程发送日记正文、创建 Markdown 日记、生成一句话总结、标签、心情值、选择天气地点，或维护工作区 .dairy 候选库时使用本技能。
---

# dAiry 日记写入

> dAiry 是一款结合了 AI 的日记应用，你不需要关心，不要误认为这个是对 "diary" 单词的误拼写。

把用户口述或远程发送的正文写入 dAiry 工作区，并维护天气、地点、标签候选库。读写文本一律使用 UTF-8；脚本读取 JSON 兼容 UTF-8 BOM。

## 工作区配置

目录：

```text
<WORKSPACE> = D:\Document\My-Diary
<SKILL_DIR> = 当前 SKILL.md 所在目录
```

工作区结构：

```text
<WORKSPACE>
├─ journal
│  └─ YYYY
│     └─ MM
│        └─ YYYY-MM-DD.md
└─ .dairy
   ├─ weather.json
   ├─ locations.json
   ├─ tags.json
   └─ remote-drafts
      └─ YYYY-MM-DD-YYYYMMDD-HHMMSS.json
```

其中：

- `journal` 下是日记文件，按"年-月"组织目录。
- `.dairy` 是工作区的配置目录，主要包括三种候选词的维护，与日记的格式有关。
  - `weather` 维护天气候选词
  - `locations` 维护地点候选词
  - `tags` 维护标签候选词

脚本入口：

```powershell
python "<SKILL_DIR>\scripts\diary_tool.py"
```

所有命令里的 `<WORKSPACE>` 都替换为上面配置的工作区根目录；不要省略 `--workspace`，避免误用脚本内置默认值。

## 日记编写流程

1. 确认日期：需要确认用户写入的是哪一天的日记，用户说“今天”用当前本地日期；日期不明确时只问一个简短问题，最终需要用户确认。
2. 读取候选和目标状态：

```powershell
python "<SKILL_DIR>\scripts\diary_tool.py" options --workspace "<WORKSPACE>" --date YYYY-MM-DD
```

3. 若用户没给天气、地点，列出所有天气和地点的候选词让用户选择，允许新增。
4. 收集正文：保留原文、语气、段落，只清理首尾空白；除非用户要求，不润色正文。
5. 生成 `summary` / `tags` / `mood`，并展示日期、天气、地点、心情、总结、标签、新增候选给用户确认。
6. 目标日记已存在时必须说明：默认停止；用户明确说追加用 `append`，明确说覆盖用 `overwrite`。
7. 用户明确确认后，生成 payload 草稿并写入最终 Markdown。
8. 写入成功后只回复最终路径和元数据；正文很长时不要重复整篇正文。

不要在默认流程中执行 `preview`；它只用于调试、迁移或排查格式问题。

## 自动整理规则

先判断正文主语言，再生成结果：

- 中文为主时，`summary` 和新增 `tags` 用中文。
- 英文为主时，`summary` 和新增 `tags` 用英文。
- 中英混合时，按信息量、句子占比、叙述主体更明显的语言输出。
- `summary` 必须只使用一种主语言；标签也尽量保持单一语言风格。

`summary`：

- 必须是一句话，不写标题，不分点，不加引号。
- 平实、克制、贴近日记归档，不夸张，不鸡汤，不评论用户。
- 中文约 20 到 40 个汉字；英文约 12 到 24 个单词。
- 概括当天最主要的事件、状态或推进，不堆砌细节。
- 重点明确时保留最核心的 1 到 2 个信息点；内容零散时提炼共同主线。

`tags`：

- 生成 3 到 8 个，优先复用 `<WORKSPACE>\.dairy\tags.json` 中语义准确、语言风格一致的已有标签。
- 只有已有标签明显不足时才新增；已有标签语言不一致时不要强行复用。
- 优先概括主题、事件、状态、场景、任务、关系、地点、情绪、阶段性问题、长期项目名等可检索信息。
- 简洁、稳定、可复用，尽量是词语或短语。
- 避免近义重复、一次性口头表达、空泛标签，例如“生活”“记录”“想法”“日记”。
- 不要把总结句拆成标签，也不要机械抽取正文中的每个名词。
- 英文标签优先使用自然、简洁的 lowercase 词或短语，专有名词除外。

`mood`：

- 表示作者在正文中呈现出的整体情绪倾向，不表示客观事件本身的好坏。
- 优先依据明确情绪、语气、评价和整体落点判断，不要只按单个事件机械打分。
- 正负情绪并存时，看篇幅占比、反复强调部分、结尾语气和整体主线。
- 忙、累、平淡、克制不自动等于负面；顺利、完成任务也不自动等于强正面。
- 不要过度保守；清楚、持续、反复出现的情绪信号应使用更高绝对值。
- 短暂单点情绪通常对应较低绝对值；贯穿全文并影响整体落点的情绪可对应较高绝对值。
- 情绪线索很少时返回 `0`；只允许输出 `-5` 到 `5` 的整数。

心情分值：

```text
-5 强烈负面：崩溃、绝望、强痛苦，或整篇被严重负面情绪主导。
-4 很差：持续低落、明显受挫、强烈烦闷或压抑。
-3 明显负面：沮丧、烦躁、压抑、失望占主导。
-2 轻中度负面：清楚的不舒服、受挫或低气压，但不算很重。
-1 略负面：轻微不顺、疲惫、烦闷或失落，整体未被主导。
 0 平稳、中性、复杂情绪大体抵消，或缺少明确倾向。
 1 略正面：一点轻松、满意、期待或安定感。
 2 比较正面：心情不错、状态较顺、有轻到中度满足感。
 3 明显正面：开心、充实、顺畅、受鼓舞或有成就感占主导。
 4 很好：兴奋、满足、轻松或被激励的状态很强。
 5 强烈正面：少见高峰体验，整篇被强烈喜悦、振奋或满足感主导。
```

事实约束：

- 只能依据用户正文、已有标签和用户明确补充的信息整理。
- 不编造正文没有出现的重要事实、人物关系、地点、计划、情绪或结论。
- 不把推测当事实，不做价值判断、心理诊断或建议。
- 生成时不暴露分析过程。

## 写入格式

> 通过脚本写入即可，不需要自行生成日记 Mardown 文件。

日记 Markdown：

```md
---
createdAt: "2026-05-09T14:23:57.945Z"
updatedAt: "2026-05-09T14:32:06.512Z"
weather: "多云"
location: "家"
mood: 2
summary: "回老家拜妈祖生，中午饱餐一顿，下午首次上高速驾车到外婆家。"
tags:
  - "回家"
  - "家庭活动"
---
正文内容从这里开始。
```

没有标签时写 `tags: []`。frontmatter 字符串使用 JSON 风格双引号。文件位置必须是 `<WORKSPACE>\journal\YYYY\MM\YYYY-MM-DD.md`。

## 脚本命令

获取 payload 草稿路径：

```powershell
python "<SKILL_DIR>\scripts\diary_tool.py" draft-path --workspace "<WORKSPACE>" --date YYYY-MM-DD
```

payload JSON 写入脚本返回的 `.dairy\remote-drafts\...json` 路径，格式：

```json
{
  "date": "2026-05-09",
  "weather": "多云",
  "location": "家",
  "mood": 2,
  "summary": "一句话总结",
  "tags": ["回家", "家庭活动", "驾驶"],
  "body": "正文内容",
  "mode": "create"
}
```

`mode` 只能是 `create`、`append`、`overwrite`。`append` 和 `overwrite` 必须有用户明确授权。

写入日记：

```powershell
python "<SKILL_DIR>\scripts\diary_tool.py" write --workspace "<WORKSPACE>" --payload-file "<WORKSPACE>\.dairy\remote-drafts\YYYY-MM-DD-YYYYMMDD-HHMMSS.json"
```

写入成功后脚本会合并新增天气、地点、标签，并默认删除 `.dairy\remote-drafts` 内的 payload。失败时保留 payload 方便重试。调试或用户要求保留草稿时加 `--keep-payload`；需要输出完整 Markdown 时才加 `--show-content`。

单独维护候选：

```powershell
python "<SKILL_DIR>\scripts\diary_tool.py" add-library --workspace "<WORKSPACE>" --weather 晴 --location 家 --tags dAiry
```

清理旧草稿：

```powershell
python "<SKILL_DIR>\scripts\diary_tool.py" clean-drafts --workspace "<WORKSPACE>" --days 7
```

调试预览：

```powershell
python "<SKILL_DIR>\scripts\diary_tool.py" preview --workspace "<WORKSPACE>" --payload-file "<WORKSPACE>\.dairy\remote-drafts\YYYY-MM-DD-YYYYMMDD-HHMMSS.json"
```

`preview` 不写文件、不更新候选库、不删除 payload。
