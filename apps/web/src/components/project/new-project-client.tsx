'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { PageFrame } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { FieldError, Input, Label, Textarea } from '@/components/ui/form';
import { createProject } from '@/features/projects/api';
import { getUserErrorMessage } from '@/lib/api-client';

export const newProjectSchema = z.object({
  name: z.string().trim().min(1, '请输入项目名称。').max(200, '项目名称不能超过 200 个字符。'),
  original_idea: z
    .string()
    .trim()
    .min(1, '请输入原始想法。')
    .max(10000, '原始想法不能超过 10000 个字符。'),
});

type NewProjectFormValues = z.infer<typeof newProjectSchema>;

export function NewProjectClient() {
  const router = useRouter();
  const form = useForm<NewProjectFormValues>({
    resolver: zodResolver(newProjectSchema),
    defaultValues: { name: '', original_idea: '' },
  });
  const mutation = useMutation({
    mutationFn: createProject,
    onSuccess: (project) => {
      router.push(`/projects/${project.id}`);
    },
  });

  const formError = mutation.error
    ? getUserErrorMessage(mutation.error, '项目创建失败，请稍后重试。')
    : null;

  return (
    <PageFrame
      description="把一句模糊的产品想法交给 Agent。后续工作流会用澄清问题和多模型分析把它转成可交付的软件规划。"
      eyebrow="Project Intake"
      title="新建规划项目"
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,720px)_1fr]">
        <Card>
          <CardBody>
            <form
              className="grid gap-5"
              onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            >
              {formError ? (
                <p
                  className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
                  role="alert"
                >
                  {formError}
                </p>
              ) : null}
              <div className="grid gap-2">
                <Label htmlFor="project-name">项目名称</Label>
                <Input
                  aria-describedby="project-name-error"
                  aria-invalid={Boolean(form.formState.errors.name)}
                  id="project-name"
                  maxLength={200}
                  placeholder="例如：面向独立开发者的需求规划 Agent"
                  {...form.register('name')}
                />
                <FieldError id="project-name-error">
                  {form.formState.errors.name?.message}
                </FieldError>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="original-idea">原始想法</Label>
                <Textarea
                  aria-describedby="original-idea-error original-idea-help"
                  aria-invalid={Boolean(form.formState.errors.original_idea)}
                  id="original-idea"
                  maxLength={10000}
                  placeholder="描述你想做什么、目标用户是谁、你现在最不确定的问题是什么。"
                  {...form.register('original_idea')}
                />
                <p className="text-xs leading-5 text-slate-500" id="original-idea-help">
                  建议包含目标用户、核心场景、预期产物和已知约束；不需要一次写完所有细节。
                </p>
                <FieldError id="original-idea-error">
                  {form.formState.errors.original_idea?.message}
                </FieldError>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button disabled={mutation.isPending} type="submit">
                  {mutation.isPending ? '创建中' : '创建项目'}
                </Button>
                {formError ? (
                  <Button
                    disabled={mutation.isPending}
                    onClick={form.handleSubmit((values) => mutation.mutate(values))}
                    variant="secondary"
                  >
                    重试
                  </Button>
                ) : null}
              </div>
              <p className="sr-only" role="status">
                {mutation.isPending ? '正在创建项目' : ''}
              </p>
            </form>
          </CardBody>
        </Card>
        <Card className="h-fit border-amber-200 bg-amber-50">
          <CardBody>
            <h2 className="text-base font-bold text-amber-950">输入质量会影响后续产物</h2>
            <p className="mt-2 text-sm leading-6 text-amber-900">
              这个 Agent
              的意义不是替你写一个漂亮摘要，而是帮你暴露缺口、提出澄清问题、生成工程团队能接着执行的规格文档。
            </p>
          </CardBody>
        </Card>
      </div>
    </PageFrame>
  );
}
