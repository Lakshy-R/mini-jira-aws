import { useState } from 'react';
import { Plus, Trash2, FolderKanban, Calendar, Users, Sparkles } from 'lucide-react';
import { useProjects, useCreateProject, useDeleteProject } from '../hooks/useProjects';
import { usersService } from '../services/users.service';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth.store';
import { toast } from '../store/toast.store';
import { Button } from '../components/ui/button';
import { Input, Textarea, Select, FormField } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader,
  DialogBody, DialogFooter, DialogTitle,
} from '../components/ui/dialog';
import { cn } from '../lib/utils';

function ProjectCard({ project, isManager, onDelete, teamName }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className={cn(
      'group relative bg-card border border-white/[0.06] rounded-2xl p-5',
      'hover:border-white/[0.12] hover:shadow-[0_4px_24px_rgba(0,0,0,0.4)]',
      'transition-all duration-200 animate-fade-in overflow-hidden'
    )}>
      {/* Hover glow accent */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
          <FolderKanban size={18} className="text-primary" />
        </div>

        {isManager && !confirmDelete && (
          <button
            onClick={() => setConfirmDelete(true)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
            aria-label="Delete project"
          >
            <Trash2 size={14} />
          </button>
        )}

        {confirmDelete && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">Delete?</span>
            <button
              onClick={() => onDelete(project.projectId)}
              className="text-red-400 hover:underline font-semibold"
            >
              Yes
            </button>
            <span className="text-white/20">·</span>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              No
            </button>
          </div>
        )}
      </div>

      <h2 className="font-semibold text-foreground text-base mb-1 line-clamp-1">{project.name}</h2>

      {project.description && (
        <p className="text-sm text-muted-foreground line-clamp-2 mb-4 leading-relaxed">{project.description}</p>
      )}

      <div className="flex items-center flex-wrap gap-2 mt-auto">
        {teamName && (
          <Badge variant="secondary" className="gap-1">
            <Users size={10} />
            {teamName}
          </Badge>
        )}
        {project.createdAt && (
          <Badge variant="secondary" className="gap-1">
            <Calendar size={10} />
            {new Date(project.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </Badge>
        )}
      </div>
    </div>
  );
}

const initialForm = { name: '', description: '', teamId: '' };

function CreateProjectDialog({ onCreated }) {
  const [open, setOpen]       = useState(false);
  const [form, setForm]       = useState(initialForm);
  const [loading, setLoading] = useState(false);

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => usersService.getTeams(),
    staleTime: 300_000,
  });

  const handleClose = () => { setOpen(false); setForm(initialForm); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Project name is required'); return; }
    if (!form.teamId)      { toast.error('Please select a team'); return; }
    setLoading(true);
    try {
      await onCreated(form);
      handleClose();
    } catch {
      /* error toasted by hook */
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus size={15} />
          New Project
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md" onClose={handleClose}>
        <DialogHeader>
          <DialogTitle>Create Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
            <FormField label="Name" required>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Project name"
                autoFocus
              />
            </FormField>
            <FormField label="Description">
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What is this project about?"
                rows={3}
              />
            </FormField>
            <FormField label="Team" required>
              <Select
                value={form.teamId}
                onChange={(e) => setForm({ ...form, teamId: e.target.value })}
              >
                <option value="">Select team…</option>
                {teams.map((t) => (
                  <option key={t.teamId} value={t.teamId}>{t.name}</option>
                ))}
              </Select>
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating…' : 'Create Project'}
            </Button>
            <Button type="button" variant="ghost" onClick={handleClose}>Cancel</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ProjectsPage() {
  const { user } = useAuthStore();
  const isManager = user?.role === 'manager';

  const { data: projects = [], isLoading } = useProjects();
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => usersService.getTeams(),
    enabled: isManager,
    staleTime: 300_000,
  });

  const teamNameMap = Object.fromEntries(teams.map((t) => [t.teamId, t.name]));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {projects.length} project{projects.length !== 1 ? 's' : ''}
          </p>
        </div>
        {isManager && (
          <CreateProjectDialog onCreated={(form) => createProject.mutateAsync(form)} />
        )}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-card border border-white/[0.06] rounded-2xl p-5 space-y-3">
              <Skeleton className="w-10 h-10 rounded-xl" />
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center animate-fade-in">
          <div className="relative w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-5 ring-1 ring-primary/20">
            <FolderKanban size={32} className="text-primary/60" />
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
              <Sparkles size={10} className="text-primary" />
            </div>
          </div>
          <h3 className="text-base font-semibold text-foreground mb-2">No projects yet</h3>
          <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
            {isManager
              ? 'Create your first project to organize team work.'
              : "Your manager hasn't created any projects for your team yet."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.projectId}
              project={project}
              isManager={isManager}
              teamName={teamNameMap[project.teamId]}
              onDelete={(id) => deleteProject.mutate(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
