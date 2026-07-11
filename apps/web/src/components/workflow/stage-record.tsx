import type { WorkflowStateResponse } from '@/types/api';

const labels: Record<string, string> = {
  project_summary: '项目概况',
  target_users: '主要用户',
  core_problems: '要解决的问题',
  requirement_points: '需求要点',
  assumptions: '当前假设',
  clarification_questions: '当时追问的问题',
  model_name: '参与模型',
  strengths: '值得保留',
  weaknesses: '还不够稳',
  unknowns: '尚未确定',
  recommendation: '建议',
  project_name: '项目名称',
  executive_summary: '结论摘要',
  user_personas: '用户画像',
  functional_requirements: '功能需求',
  non_functional_requirements: '非功能需求',
  conflicts_resolved: '已经解决的分歧',
  scope_boundary: '范围边界',
  technical_feasibility: '技术可行性',
  technical_risks: '技术风险',
  resource_estimation: '人员估算',
  timeline_estimation: '时间估算',
  dependencies: '外部依赖',
  alternative_approaches: '备选方案',
  risks: '风险清单',
  overall_risk_level: '整体风险',
  critical_risks: '关键风险',
  mvp_scope: '首版要做',
  deferred_scope: '以后再做',
  mvp_goal: '首版目标',
  success_metrics: '怎么判断有效',
  timeline: '预计周期',
  milestones: '里程碑',
  recommended_platform: '推荐平台',
  tech_stack: '技术栈',
  rationale: '为什么这样选',
  alternatives: '其他选择',
  trade_offs: '需要接受的取舍',
  generated: '已经生成',
  failed: '未生成',
  title: '名称',
  description: '说明',
  priority: '优先级',
  category: '类别',
  user_story: '用户故事',
  mitigation: '降低风险',
  contingency: '兜底方案',
  probability: '发生概率',
  impact: '影响程度',
  provider: '参与模型',
  type: '内容类型',
  topic: '讨论主题',
  positions: '不同看法',
  resolution: '最后决定',
  needs_more_clarification: '是否还要补充',
};

export function StageRecord({ state }: { state?: WorkflowStateResponse }) {
  if (!state) return <p className="text-sm text-slate-500">这一步还没开始。</p>;
  if (state.error_message) {
    return <p className="text-sm text-red-700">{state.error_message}</p>;
  }
  if (!state.data_json || Object.keys(state.data_json).length === 0) {
    return <p className="text-sm text-slate-500">这一步没有留下额外记录。</p>;
  }
  return <RecordValue value={state.data_json} />;
}

function RecordValue({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-slate-500">暂无</span>;
  }
  if (typeof value === 'boolean') return <span>{value ? '是' : '否'}</span>;
  if (typeof value !== 'object')
    return <span className="whitespace-pre-wrap">{String(value)}</span>;
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-slate-500">暂无</span>;
    return (
      <ul className="grid gap-2">
        {value.map((item, index) => (
          <li className="rounded-md bg-white px-3 py-2" key={index}>
            <RecordValue value={item} />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <dl className="grid gap-3">
      {Object.entries(value).map(([key, item]) => (
        <div className="grid gap-1" key={key}>
          <dt className="text-xs font-bold text-slate-500">{labels[key] ?? key}</dt>
          <dd className="text-sm leading-6 text-slate-700">
            <RecordValue value={item} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
