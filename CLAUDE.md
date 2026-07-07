# Claude Code Entry

本项目的通用 agent 规则以 `AGENTS.md` 为唯一来源。

Claude Code 启动后必须先读取并遵守：

- `AGENTS.md`

Claude 专用配置和 skills 保留在：

- `.claude/settings.json`
- `.claude/skills/`

规则维护原则：

- 通用项目规范只更新 `AGENTS.md`。
- `CLAUDE.md` 只作为 Claude Code 自动识别入口。
- 不要把 `.claude/settings.local.json` 当作团队规范；它属于个人本机授权/状态。
