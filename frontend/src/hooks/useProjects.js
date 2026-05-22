import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsService } from '../services/projects.service';
import { toast } from '../store/toast.store';

export const PROJECTS_KEY = ['projects'];

export function useProjects() {
  return useQuery({
    queryKey: PROJECTS_KEY,
    queryFn: () => projectsService.getProjects(),
    staleTime: 60_000,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => projectsService.createProject(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROJECTS_KEY });
      toast.success('Project created');
    },
    onError: (err) => {
      toast.error(err.displayMessage || 'Failed to create project');
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId) => projectsService.deleteProject(projectId),
    onSuccess: (_, projectId) => {
      qc.setQueryData(PROJECTS_KEY, (old = []) =>
        old.filter((p) => p.projectId !== projectId)
      );
      toast.success('Project deleted');
    },
    onError: (err) => {
      toast.error(err.displayMessage || 'Failed to delete project');
    },
  });
}
