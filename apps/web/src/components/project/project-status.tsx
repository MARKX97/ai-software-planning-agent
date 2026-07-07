import { Badge, statusVariant } from '@/components/ui/badge';

const statusLabels: Record<string, string> = {
  active: '进行中',
  completed: '已完成',
  failed: '失败',
};

const stageLabels: Record<string, string> = {
  init: '初始化',
  requirement_analysis: '需求分析',
  requirement_clarification: '需求澄清',
  multi_model_analysis: '多模型分析',
  requirement_synthesis: '需求综合',
  feasibility_analysis: '可行性分析',
  risk_analysis: '风险分析',
  mvp_compression: 'MVP 压缩',
  platform_recommendation: '平台推荐',
  planning_generation: '规划生成',
  completed: '已完成',
  failed: '失败',
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
