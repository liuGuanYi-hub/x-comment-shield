# 🔍 GitHub X/Twitter 阅读优化方案调研报告

> 调研日期：2026-08-17 ｜ 目的：为「推特百宝箱」补充优化阅读的方法

## 一、代表性项目总览

| 项目 | 类型 | 核心思路 | Star/热度 |
|------|------|----------|-----------|
| [CleanX](https://github.com/theesfeld/CleanX) | 用户脚本+扩展 | 按**账号创建国家/地区/语言**过滤推文 | 88★ |
| [userscript-clean-twitter](https://github.com/antfu/userscript-clean-twitter)（antfu） | 用户脚本 | 隐藏蓝V、广告、趋势、推荐关注等，回归纯粹时间线 | 知名 |
| [X Reading Enhancer](https://greasyfork.org/scripts/584167) | 用户脚本 | 隐藏左右栏/广告、控制媒体展示、**快捷键**、可拖面板 | — |
| [TweetFilter AI](https://greasyfork.org/scripts/532459) | 用户脚本 | **AI 评分 1-10**，按质量阈值过滤低质内容 | — |
| [CleanYourTwitter](https://github.com/Swipe650/CleanYourTwitter) | uBlock 过滤列表 | 移除推广推文、你可能喜欢、谁去关注、正在发生 | — |
| [Twitter-Filter](https://github.co.uk/Connor9994/Twitter-Filter) | 用户脚本 | 关键词/emoji 过滤 + 移除"谁去关注"区块 | — |
| [X净化器](https://greasyfork.icu/scripts/578529) | 用户脚本 | 黑名单实时清场、符号穿透、空壳号扫描 | — |

## 二、可借鉴的优化方法分类

### 1. 广告 / 干扰内容清理
- **推广推文识别**：检测 `Promoted / Sponsored / 推荐 / 广告 / 推广` 等标记隐藏整条推文
  （你的脚本目前按关键词过滤，可补充**广告标记检测**：检查推文内"Promoted"等徽标）
- **区块移除**：`你可能喜欢`、`谁去关注`、`正在发生`、`搜索发现`、`查看更多推文`等区块直接隐藏
- **蓝V认证隐藏**：antfu 方案核心——隐藏 BlueVerified 认证徽标及认证推广内容

### 2. 布局与界面增强（你已有部分）
| 方法 | 说明 | 你的脚本状态 |
|------|------|--------------|
| 隐藏左侧导航 | 折叠侧栏 | ✅ 已实现 |
| 隐藏右侧趋势栏 | 折叠侧栏 | ✅ 已实现 |
| 主内容居中/加宽 | 视觉优化 | ✅ 已实现 |
| 可拖悬浮面板 | 操作便利 | ✅ 已实现 |
| **快捷键开关**（如 A=隐藏广告、L=左栏、M=媒体、R=右栏） | X Reading Enhancer 特色 | ❌ 可新增 |
| **面板位置记忆**（GM_setValue 持久化） | 下次打开恢复位置 | ❌ 计划 P0 |

### 3. 阅读舒适度
- **自动展开长推文**：自动点击 `[data-testid="tweet-text-show-more-link"]`（"展开"按钮），用 IntersectionObserver 在滚动到附近时自动展开
- **媒体默认隐藏/展开**：一键切换图片/视频/动图默认展示状态（视频可改为"点击才加载"）
- **回到顶部 / 老板键**：悬浮面板加"回顶"按钮；老板键=一键切换页面到无害界面（如搜索页），防被发现摸鱼
- **自动滚动阅读**（可选）：匀速自动滚屏（部分人觉得好用，注意与"不自动滚动"冲突，建议做成开关）

### 4. 智能过滤（进阶）
- **AI 内容评分**（TweetFilter AI 思路）：接入 OpenRouter API 让 LLM 给推文打分 1-10，低于阈值自动隐藏。成本高、需 API Key，属于可选增强
- **账号信誉过滤**（CleanX 思路）：按账号注册国家/地区、创建时间、粉丝数过滤（判断机器人/营销号）
- **符号穿透过滤**（X净化器）：关键词跨字符匹配（如"抽 奖"识别为"抽奖"），应对规避

## 三、对「推特百宝箱」的落地建议

### 优先级 P0（强烈建议，成本低收益高）
1. **广告标记检测**：检测 `Promoted/Sponsored/推荐/广告/推广` 徽标 → 隐藏整条推文（补充到 Blocker）
2. **面板位置记忆**：拖动后 GM_setValue 保存，下次恢复（开发计划里已有）
3. **快捷键开关**：A/L/M/R 四键快速切换广告/左栏/媒体/右栏（X Reading Enhancer 已验证的交互）

### 优先级 P1（推荐）
4. **干扰区块移除**：隐藏"谁去关注""你可能喜欢""正在发生"（选择器+MutationObserver）
5. **自动展开长推文**：IntersectionObserver 监听 show-more 链接自动点击
6. **配置导入导出**：关键词/黑名单 JSON 备份（开发计划 P2 已有）

### 优先级 P2（可选）
7. 老板键、回顶按钮、自动滚动（做成开关，默认关）
8. AI 评分过滤、账号信誉过滤（需 API/更复杂）

## 四、参考选择器速查

```js
// 广告徽标
'[data-testid="tweet"] [data-testid="tweet-community-note"]' // 社区备注
// 推荐关注区块
'[data-testid="sidebarColumn"] [data-testid="UserCell"]'
// 展开按钮
'[data-testid="tweet-text-show-more-link"]'
// 趋势/正在发生
'[data-testid="trend"]'
// 推广标记（部分版本）
'article[data-testid="tweet"]:has(span:is([dir]), [data-testid="socialContext"])'
```

> ⚠️ X 前端频繁改版，以上选择器基于调研时点，实际需在页面 F12 验证。

## 五、结论

你的「推特百宝箱」在**评论清理 + 侧栏折叠**上已经覆盖了大部分基础需求。当前最大的增量价值在于：
1. **广告识别**（目前只有关键词过滤，缺广告徽标检测）
2. **快捷键 + 位置记忆**（交互体验补齐）
3. **干扰区块移除**（时间线更干净）

这三项加上，基本就能达到 GitHub 主流 X 清理脚本的完整水平。
