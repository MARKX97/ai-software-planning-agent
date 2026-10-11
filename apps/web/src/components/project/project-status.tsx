import { Badge, statusVariant } from '@/components/ui/badge';

const statusLabels: Record<string, string> = {
  active: '正在推进',
  completed: '已经收好',
  failed: '需要回看',
  pending: '等着开始',
  running: '正在处理',
  success: '完成了',
  timeout: '等得有点久',
  rate_limited: '先缓一缓',
};

const stageLabels: Record<string, string> = {
  init: '准备开始',
  requirement_analysis: '先把想法说清楚',
  requirement_clarification: '补几个关键细节',
  multi_model_analysis: '换个角度看看',
  requirement_synthesis: '收成一份共识',
  feasibility_analysis: '看看能不能做',
  risk_analysis: '提前找找坑',
  mvp_compression: '先收住范围',
  platform_recommendation: '挑条合适的路',
  planning_generation: '整理成开工计划',
  completed: '已经收好',
  failed: '需要回看',
};

const stageDescriptions: Record<string, string> = {
  requirement_analysis: '从初始想法中梳理用户、问题、范围和待确认事项。',
  requirement_clarification: '围绕尚未确定的事项发起需求澄清对话。',
  multi_model_analysis: '让三个模型从不同角度检查需求的共识、分歧和未知项。',
  requirement_synthesis: '合并分析结果和已确认信息，形成统一需求结论。',
  feasibility_analysis: '评估技术可行性、依赖、团队投入和交付周期。',
  risk_analysis: '识别技术、成本、安全与合规风险，并给出应对措施。',
  mvp_compression: '划定首版必须做与延后做的范围。',
  platform_recommendation: '比较实现平台和技术栈，说明推荐理由与取舍。',
  planning_generation: '根据已确认的结论生成一份开工所需文档。',
};

export function ProjectStatus({ status }: { status: string }) {
  return <Badge variant={statusVariant(status)}>{statusLabels[status] ?? status}</Badge>;
}

export function StageName({ stage }: { stage: string }) {
  return <span>{stageLabels[stage] ?? stage}</span>;
}

export function stageName(stage: string): string {
  return stageLabels[stage] ?? stage;
}

export function stageDescription(stage: string): string {
  return stageDescriptions[stage] ?? `执行“${stageName(stage)}”阶段的模型任务。`;
}

export function statusName(status: string): string {
  return statusLabels[status] ?? status;
}
