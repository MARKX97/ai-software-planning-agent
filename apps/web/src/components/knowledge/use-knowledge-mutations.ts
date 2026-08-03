'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  deleteKnowledgeSource,
  importKnowledgeRepository,
  reindexKnowledgeSource,
  uploadKnowledgeSource,
} from '@/features/knowledge/api';

export function useKnowledgeMutations(projectId: string) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['knowledge-sources', projectId] });
  const finish = async (nextMessage: string) => {
    setMessage(nextMessage);
    await refresh();
  };
  const upload = useMutation({
    mutationFn: (file: File) => uploadKnowledgeSource(projectId, file),
    onSuccess: () => finish('项目资料已完成索引，可以用于后续规划。'),
  });
  const reindex = useMutation({
    mutationFn: (sourceId: string) => reindexKnowledgeSource(projectId, sourceId),
    onSuccess: () => finish('项目资料已重新索引。'),
  });
  const repository = useMutation({
    mutationFn: (url: string) => importKnowledgeRepository(projectId, url),
    onSuccess: () => finish('公开仓库已完成索引，可以用于后续规划。'),
  });
  const remove = useMutation({
    mutationFn: (sourceId: string) => deleteKnowledgeSource(projectId, sourceId),
    onSuccess: () => finish('项目资料已删除；已有产物中的引用快照仍会保留。'),
  });
  return {
    busyId: reindex.isPending ? reindex.variables : remove.isPending ? remove.variables : undefined,
    error: upload.error ?? repository.error ?? reindex.error ?? remove.error,
    message,
    reindex,
    remove,
    repository,
    upload,
  };
}
