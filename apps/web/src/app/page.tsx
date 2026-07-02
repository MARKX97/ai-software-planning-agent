import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">AI Software Planning Agent</h1>
        <p className="text-muted-foreground">将模糊的软件想法收敛为可执行的软件项目方案。</p>
      </header>

      <section className="flex flex-col gap-3 rounded-lg border border-black/10 p-6 dark:border-white/10">
        <p className="text-sm">
          当前阶段: <span className="font-medium">Phase 1 — Skeleton</span>
        </p>
        <p className="text-sm text-muted-foreground">
          Web UI 已就绪。完整页面将在 Phase 10 实现。
        </p>
        <Link
          href="/projects"
          className="inline-flex w-fit items-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
        >
          进入项目列表
        </Link>
      </section>
    </main>
  );
}
