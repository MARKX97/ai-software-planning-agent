import { useRef, useState, type FormEvent, type RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';

export function KnowledgeUploadCard({
  busy,
  onImportRepository,
  onUpload,
}: {
  busy: boolean;
  onImportRepository: (url: string) => Promise<unknown>;
  onUpload: (file: File) => Promise<unknown>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return setError('请先选择一个 Markdown、TXT 或 PDF 文件。');
    setError(null);
    try {
      await onUpload(file);
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
    } catch {
      // Mutation state owns the user-facing request error.
    }
  }

  return (
    <Card className="border-cyan-200 bg-cyan-50/60">
      <CardHeader>
        <h2 className="text-lg font-bold text-slate-950">加入一份资料</h2>
      </CardHeader>
      <CardBody>
        <form className="flex flex-col gap-4 sm:flex-row sm:items-end" onSubmit={handleSubmit}>
          <KnowledgeFileField error={error} inputRef={inputRef} onChange={setFile} />
          <Button disabled={busy} type="submit">
            {busy ? '正在索引' : '上传并索引'}
          </Button>
        </form>
        <RepositoryImportForm busy={busy} onImport={onImportRepository} onError={setError} />
      </CardBody>
    </Card>
  );
}

function RepositoryImportForm({
  busy,
  onImport,
  onError,
}: {
  busy: boolean;
  onImport: (url: string) => Promise<unknown>;
  onError: (error: string | null) => void;
}) {
  const [url, setUrl] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/?$/.test(url))
      return onError('请输入公开 GitHub 仓库地址。');
    onError(null);
    try {
      await onImport(url);
      setUrl('');
    } catch {
      // Mutation state owns the user-facing request error.
    }
  }
  return (
    <form className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end" onSubmit={submit}>
      <div className="flex-1">
        <label
          className="block text-sm font-semibold text-slate-900"
          htmlFor="knowledge-repository"
        >
          公开 GitHub 仓库
        </label>
        <input
          className="mt-2 block min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          id="knowledge-repository"
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://github.com/owner/repository"
          type="url"
          value={url}
        />
      </div>
      <Button disabled={busy} type="submit" variant="secondary">
        {busy ? '正在索引' : '导入仓库'}
      </Button>
    </form>
  );
}

function KnowledgeFileField({
  error,
  inputRef,
  onChange,
}: {
  error: string | null;
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (file: File | null) => void;
}) {
  return (
    <div className="flex-1">
      <label className="block text-sm font-semibold text-slate-900" htmlFor="knowledge-file">
        Markdown、TXT 或 PDF 文件
      </label>
      <input
        accept=".md,.txt,.pdf,text/markdown,text/plain,application/pdf"
        aria-describedby="knowledge-file-help"
        className="mt-2 block min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-950 file:px-3 file:py-1.5 file:font-semibold file:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        id="knowledge-file"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        ref={inputRef}
        type="file"
      />
      <p className="mt-2 text-xs text-slate-600" id="knowledge-file-help">
        单个文件最大 20 MiB。重复内容不会重复创建。
      </p>
      {error ? (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
