import { mockArtifact } from './mock-artifact.js';
import { mockCheckpointDiscussion } from './mock-discussion.js';

const requirementPoint = {
  id: 'REQ-1',
  title: '按真实约束推荐晚餐',
  description: '根据人数、预算、忌口和可用时间，给出三种可以马上执行的方案。',
  priority: 'P0',
  category: 'functional',
  user_story: '作为忙碌的上班族，我想快速得到靠谱的晚餐选择，不再反复纠结。',
};

const demoResponses: Array<[string, (provider: string, prompt: string) => unknown]> = [
  [
    'RequirementAnalysisResult schema',
    (_provider, prompt) => ({
      project_summary: '一个帮助忙碌上班族快速决定今晚吃什么的晚餐助手。',
      target_users: ['工作日没有精力做决定的上班族', '需要同时照顾预算和忌口的家庭'],
      core_problems: ['晚餐决策耗时', '推荐不考虑真实限制', '做饭和外出就餐的信息分散'],
      requirement_points: [
        requirementPoint,
        {
          ...requirementPoint,
          id: 'REQ-2',
          title: '解释为什么推荐',
          description: '每个方案都说明预计时间、花费和适合它的理由。',
          priority: 'P1',
          category: 'ux',
        },
      ],
      assumptions: ['首版服务一个城市', '首版不直接下单或支付'],
      clarification_questions: mockRequirementQuestions(prompt),
    }),
  ],
  [
    'MultiModelAnalysisResult schema',
    (provider) => ({
      model_name: provider,
      requirement_points: [requirementPoint],
      strengths: ['场景高频，价值容易验证', '用户输入和结果都比较明确'],
      weaknesses: ['附近餐饮信息可能不够新鲜'],
      unknowns: ['用户是否愿意每次填写完整约束'],
      recommendation: '先做无需登录的网页 MVP，用收藏和反馈验证推荐质量。',
    }),
  ],
  [
    'SynthesizedRequirement schema',
    () => ({
      project_name: '今晚吃什么',
      executive_summary: '用最少输入，为忙碌用户提供三种可执行、可解释的晚餐方案。',
      user_personas: ['下班后只想尽快吃上饭的城市上班族', '要兼顾家人忌口和预算的决策者'],
      functional_requirements: [requirementPoint],
      non_functional_requirements: [
        {
          ...requirementPoint,
          id: 'NFR-1',
          title: '快速得到结果',
          description: '提交条件后 3 秒内展示首屏方案。',
          category: 'non_functional',
        },
      ],
      conflicts_resolved: [
        {
          topic: '首版是否接入外卖平台',
          positions: ['接入后方案更完整', '接入会显著增加成本和不稳定性'],
          resolution: 'MVP 先提供搜索入口，不做下单集成。',
        },
      ],
      scope_boundary: '首版只负责收集约束、生成并解释晚餐方案，不处理支付、配送和商户后台。',
    }),
  ],
  [
    'FeasibilityAssessment schema',
    () => ({
      technical_feasibility: 'high',
      technical_risks: ['第三方地点数据可能过期', '开放式推荐需要稳定的兜底规则'],
      resource_estimation: '1 名全栈开发者配合 1 名产品设计，可完成首版。',
      timeline_estimation: '4 周完成可测试的 MVP。',
      dependencies: ['地图地点搜索 API', '天气 API（可选）'],
      alternative_approaches: ['首版完全使用人工维护的餐食模板，验证后再接第三方数据'],
    }),
  ],
  [
    'RiskAnalysisResult schema',
    () => ({
      risks: [
        {
          id: 'RISK-1',
          category: 'technical',
          description: '推荐的餐厅可能已经关门或价格变化。',
          probability: 'medium',
          impact: 'high',
          mitigation: '展示数据更新时间，并提供一键反馈入口。',
          contingency: '数据不可用时退回到可在家完成的菜谱方案。',
        },
      ],
      overall_risk_level: 'medium',
      critical_risks: ['RISK-1'],
    }),
  ],
  [
    'MVPPlan schema',
    () => ({
      mvp_scope: [requirementPoint],
      deferred_scope: [
        {
          ...requirementPoint,
          id: 'REQ-3',
          title: '用户账号与长期偏好',
          description: '登录后保存跨设备的长期饮食偏好。',
          priority: 'P3',
          category: 'functional',
        },
      ],
      mvp_goal: '验证用户是否愿意用不到一分钟的信息换取一个可执行的晚餐决定。',
      success_metrics: ['一周内完成 50 次真实推荐', '方案点击率达到 40%', '30% 用户提交结果反馈'],
      timeline: '4 周',
      milestones: [
        '第 1 周完成交互原型',
        '第 2 周完成推荐规则',
        '第 3 周接入地点数据',
        '第 4 周邀请测试用户',
      ],
    }),
  ],
  [
    'PlatformRecommendation schema',
    () => ({
      recommended_platform: 'web',
      tech_stack: {
        frontend: 'Next.js',
        backend: 'NestJS',
        database: 'PostgreSQL + Prisma',
      },
      rationale: '无需安装，适合通过链接快速验证；现有技术栈可以直接复用。',
      alternatives: ['微信小程序', 'React Native 应用'],
      trade_offs: 'Web 上线最快，但系统级通知和原生定位体验弱于移动应用。',
    }),
  ],
];

/** Return deterministic, coherent content for local end-to-end demos. */
export function mockContent(provider: string, prompt: string): string {
  if (prompt.includes('Artifact type to generate:')) return mockArtifact(prompt);
  if (prompt.includes('WORKFLOW_CHECKPOINT_DISCUSSION')) return mockCheckpointDiscussion(prompt);
  if (prompt.includes('WORKFLOW_REQUIREMENT_CLARIFICATION')) return mockClarification(prompt);
  const match = demoResponses.find(([marker]) => prompt.includes(marker));
  return JSON.stringify(match ? match[1](provider, prompt) : { mock: true, provider });
}

function mockRequirementQuestions(prompt: string): unknown[] {
  const replies = prompt.match(/^user:/gm)?.length ?? 0;
  if (replies >= 2) return [];
  if (replies === 1) {
    return [
      {
        question: '首版上线后，你最想用哪个数字判断它有没有帮到用户？',
        context: '明确成功标准，才能决定首版需要记录哪些反馈。',
        category: 'business',
      },
    ];
  }
  return [
    {
      question: '首版主要服务哪个城市？',
      context: '地点数据和可用服务会因城市而不同。',
      category: 'scope',
    },
    {
      question: '用户更看重省时间、控制预算还是吃得健康？',
      context: '这会决定推荐排序和首页默认项。',
      category: 'user',
    },
  ];
}

function mockClarification(prompt: string): string {
  const replyCount = Number(prompt.match(/Clarification replies received:\s*(\d+)/)?.[1] ?? 0);
  const firstRound = replyCount === 0;
  const secondRound = replyCount === 1;
  if (firstRound) {
    return '先补两件事：首版主要服务哪个城市？用户更看重省时间、控制预算，还是吃得健康？';
  }
  if (secondRound) return '还有最后一个问题：首版上线后，你最想用哪个数字判断它有没有帮到用户？';
  return '现在已经足够清楚了。你可以再检查一遍需求范围，确认后我们继续往下走。';
}
