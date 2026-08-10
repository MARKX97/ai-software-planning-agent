import { Card, CardBody } from '@/components/ui/card';

export function DashboardGuide() {
  return (
    <aside className="grid h-fit gap-3">
      <Card className="border-slate-950 bg-slate-950 text-white">
        <CardBody>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">从这里开始</p>
          <h2 className="mt-2 text-xl font-black">先把事情想明白</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            我们会先听你说，再把关键问题问清楚；能做什么、先做什么、有哪些坑，都会整理成一份能继续往下走的计划。
          </p>
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <h2 className="text-sm font-bold text-slate-950">先说人话就好</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            项目不必从一份完整的需求文档开始。告诉我们谁遇到了什么麻烦，剩下的细节可以在路上慢慢补齐。
          </p>
        </CardBody>
      </Card>
    </aside>
  );
}
