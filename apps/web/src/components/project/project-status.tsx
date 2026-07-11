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

export function ProjectStatus({ status }: { status: string }) {
  return <Badge variant={statusVariant(status)}>{statusLabels[status] ?? status}</Badge>;
}

export function StageName({ stage }: { stage: string }) {
  return <span>{stageLabels[stage] ?? stage}</span>;
}

export function stageName(stage: string): string {
  return stageLabels[stage] ?? stage;
}

export function statusName(status: string): string {
  return statusLabels[status] ?? status;
}
