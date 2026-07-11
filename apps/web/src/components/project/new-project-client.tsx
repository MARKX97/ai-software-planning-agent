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
      description="哪怕现在只有一句话也没关系。先把你想做的事说出来，后面我们会一点点把它变得具体。"
      eyebrow="从一个点子开始"
      title="说说你想做什么"
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
                <Label htmlFor="project-name">给这个想法起个名字</Label>
                <Input
                  aria-describedby="project-name-error"
                  aria-invalid={Boolean(form.formState.errors.name)}
                  id="project-name"
                  maxLength={200}
                  placeholder="例如：帮独立开发者把需求想清楚"
                  {...form.register('name')}
                />
                <FieldError id="project-name-error">
                  {form.formState.errors.name?.message}
                </FieldError>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="original-idea">先随便说说</Label>
                <Textarea
                  aria-describedby="original-idea-error original-idea-help"
                  aria-invalid={Boolean(form.formState.errors.original_idea)}
                  id="original-idea"
                  maxLength={10000}
                  placeholder="你想做什么？谁会用？现在最让你拿不准的地方又是什么？"
                  {...form.register('original_idea')}
                />
                <p className="text-xs leading-5 text-slate-500" id="original-idea-help">
                  想到哪写到哪就行。用户、场景、已有约束都很有用；漏掉的部分，我们之后再一起补。
                </p>
                <FieldError id="original-idea-error">
                  {form.formState.errors.original_idea?.message}
                </FieldError>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button disabled={mutation.isPending} type="submit">
                  {mutation.isPending ? '正在放进去' : '把它放进项目里'}
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
            <h2 className="text-base font-bold text-amber-950">写得不完整也没关系</h2>
            <p className="mt-2 text-sm leading-6 text-amber-900">
              这里不是考试。一个真实的困惑、一点已知的限制，往往比一段漂亮的空话更有用。我们会把缺口挑出来，陪你补上。
            </p>
          </CardBody>
        </Card>
      </div>
    </PageFrame>
  );
}
