const artifactTitles: Record<string, string> = {
  requirement_report: '需求分析报告',
  feasibility_report: '可行性分析报告',
  risk_report: '风险清单',
  mvp_plan: 'MVP 计划',
  platform_recommendation: '技术平台建议',
  project_plan: '项目推进计划',
  prd: '今晚吃什么 PRD',
  architecture: '系统架构说明',
  frontend_spec: '前端体验规格',
  backend_spec: '后端接口规格',
  ai_coding_rules: 'AI 编码约定',
};

export function mockArtifact(prompt: string): string {
  const type = prompt.match(/Artifact type to generate:\n([a-z_]+)/)?.[1] ?? 'project_plan';
  const title = artifactTitles[type] ?? '项目文档';
  return `# ${title}\n\n> 本地演示模式生成，用于体验完整流程。\n\n## 目标\n\n帮助忙碌的上班族在一分钟内决定今晚吃什么，并得到三种真正能执行的方案。\n\n## 首版范围\n\n- 收集人数、预算、忌口和可用时间\n- 给出三种带时间、花费和理由的方案\n- 支持收藏与不喜欢反馈\n- 暂不处理支付、配送和商户后台\n\n## 验收标准\n\n1. 用户不登录也能完成一次推荐。\n2. 提交条件后 3 秒内展示结果。\n3. 每种方案都说明预计时间、花费和推荐理由。\n4. 第三方数据不可用时，仍能给出可执行的家庭餐方案。`;
}
