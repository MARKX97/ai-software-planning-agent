import { useMutation, useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Button, ButtonLink } from '@/components/ui/button';
import { exportPrd, getExport, getExportDownload } from '@/features/artifacts/api';

interface ArtifactExportState {
  actions: ReactNode;
  error: Error | null;
  message: string | null;
  retry: () => void;
  status: string | null;
}

export function useArtifactExport(projectId: string): ArtifactExportState {
  const [exportId, setExportId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () => exportPrd(projectId),
    onSuccess: (task) => {
      setExportId(task.id);
      setMessage('正在把 PRD 打包好，请稍等一会儿。');
    },
  });
  const task = useQuery({
    enabled: Boolean(exportId),
    queryKey: ['export', projectId, exportId],
    queryFn: () => getExport(projectId, exportId ?? ''),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'pending' || status === 'processing' ? 2000 : false;
    },
  });
  const download = useMutation({
    mutationFn: () => getExportDownload(projectId, exportId ?? '', task.data?.download_url ?? ''),
    onSuccess: (blob) => {
      saveExport(blob);
      setMessage('文件已经准备好了，可以下载。');
    },
  });
  function retry() {
    setMessage(null);
    setExportId(null);
    create.mutate();
  }
  return {
    actions: (
      <ArtifactExportActions
        create={create}
        download={download}
        onCreate={retry}
        projectId={projectId}
        ready={task.data?.status === 'completed'}
      />
    ),
    error: create.error ?? task.error ?? download.error ?? null,
    message,
    retry,
    status: task.data?.status ?? (create.isPending ? 'creating' : null),
  };
}

function saveExport(blob: Blob) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'planning-export.md';
  link.click();
  window.URL.revokeObjectURL(url);
}

function ArtifactExportActions({
  create,
  download,
  onCreate,
  projectId,
  ready,
}: {
  create: { isPending: boolean };
  download: { isPending: boolean; mutate: () => void };
  onCreate: () => void;
  projectId: string;
  ready: boolean;
}) {
  return (
    <>
      <Button disabled={create.isPending} onClick={onCreate} variant="secondary">
        {create.isPending ? '正在打包' : '打包成 PRD'}
      </Button>
      {ready ? (
        <Button disabled={download.isPending} onClick={() => download.mutate()} variant="secondary">
          {download.isPending ? '正在准备下载' : '下载文件'}
        </Button>
      ) : null}
      <ButtonLink href={`/projects/${projectId}/usage`} variant="quiet">
        看看这次花了多少
      </ButtonLink>
    </>
  );
}
