import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksService, createTask } from '../services/tasks.service';
import { toast } from '../store/toast.store';

export const TASKS_KEY = ['tasks'];

export function useTasks() {
  return useQuery({
    queryKey: TASKS_KEY,
    queryFn: async () => {
      const result = await tasksService.getTasks();
      return result?.items ?? result ?? [];
    },
    staleTime: 30_000,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskData, imageFile }) => createTask(taskData, imageFile),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TASKS_KEY });
      toast.success('Task created');
    },
    onError: (err) => {
      toast.error(err.displayMessage || 'Failed to create task');
    },
  });
}

export function useUpdateTaskStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, status }) => tasksService.updateStatus(taskId, status),
    onMutate: async ({ taskId, status }) => {
      await qc.cancelQueries({ queryKey: TASKS_KEY });
      const previous = qc.getQueryData(TASKS_KEY);
      qc.setQueryData(TASKS_KEY, (old = []) =>
        old.map((t) => (t.taskId === taskId ? { ...t, status } : t))
      );
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      qc.setQueryData(TASKS_KEY, ctx?.previous);
      toast.error(err.displayMessage || 'Failed to update status');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: TASKS_KEY });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId) => tasksService.deleteTask(taskId),
    onSuccess: (_, taskId) => {
      qc.setQueryData(TASKS_KEY, (old = []) => old.filter((t) => t.taskId !== taskId));
      toast.success('Task deleted');
    },
    onError: (err) => {
      toast.error(err.displayMessage || 'Failed to delete task');
    },
  });
}
