import { useState, useCallback } from 'react';
import { LayoutGrid, Filter, X, Sparkles } from 'lucide-react';
import { useTasks, useCreateTask } from '../hooks/useTasks';
import { usersService } from '../services/users.service';
import { useQuery } from '@tanstack/react-query';
import { useTasksStore } from '../store/tasks.store';
import { useAuthStore } from '../store/auth.store';
import KanbanBoard from '../components/kanban/KanbanBoard';
import TaskForm from '../components/tasks/TaskForm';
import TaskDetailModal from '../components/tasks/TaskDetailModal';
import { Select } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { cn } from '../lib/utils';

const STAT_CONFIG = [
  { status: 'TODO',        label: 'To Do',       color: 'text-slate-400',   bg: 'bg-slate-500/10',   ring: 'ring-slate-500/20',   dot: 'bg-slate-400' },
  { status: 'IN_PROGRESS', label: 'In Progress',  color: 'text-blue-400',    bg: 'bg-blue-500/10',    ring: 'ring-blue-500/20',    dot: 'bg-blue-400' },
  { status: 'IN_REVIEW',   label: 'In Review',    color: 'text-amber-400',   bg: 'bg-amber-500/10',   ring: 'ring-amber-500/20',   dot: 'bg-amber-400' },
  { status: 'DONE',        label: 'Done',         color: 'text-emerald-400', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/20', dot: 'bg-emerald-400' },
];

function StatChip({ label, count, color, bg, ring, dot }) {
  return (
    <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg ring-1 ring-inset', bg, ring)}>
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dot)} />
      <span className={cn('text-xs font-semibold', color)}>{count}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {[0, 1, 2, 3].map((col) => (
        <div key={col} className="space-y-3">
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="w-2 h-2 rounded-full" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-6 rounded-full ml-auto" />
          </div>
          <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-2 min-h-[400px] space-y-2">
            {[0, 1, 2].map((card) => (
              <div key={card} className="bg-card rounded-xl border border-white/[0.06] p-4 space-y-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-1/2" />
                <div className="flex justify-between pt-1">
                  <Skeleton className="h-5 w-5 rounded-full" />
                  <Skeleton className="h-4 w-16 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ isManager }) {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center animate-fade-in">
      <div className="relative w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-5 ring-1 ring-primary/20">
        <LayoutGrid size={32} className="text-primary/60" />
        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
          <Sparkles size={10} className="text-primary" />
        </div>
      </div>
      <h3 className="text-base font-semibold text-foreground mb-2">No tasks yet</h3>
      <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
        {isManager
          ? 'Create your first task to get the board started.'
          : "Your manager hasn't assigned any tasks yet. Check back soon."}
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const isManager = user?.role === 'manager';
  const { setTasks } = useTasksStore();

  const [selectedTask, setSelectedTask] = useState(null);
  const [teamFilter, setTeamFilter] = useState('');

  const { data: tasks = [], isLoading, refetch } = useTasks();
  const createTask = useCreateTask();

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => usersService.getTeams(),
    enabled: isManager,
    staleTime: 300_000,
  });

  const handleCreateTask = useCallback(async (taskData, imageFile) => {
    await createTask.mutateAsync({ taskData, imageFile });
  }, [createTask]);

  const handleTaskUpdated = useCallback((updatedTask) => {
    setSelectedTask(updatedTask);
  }, []);

  const handleTaskDeleted = useCallback((taskId) => {
    setSelectedTask(null);
  }, []);

  const visibleTasks = teamFilter
    ? tasks.filter((t) => t.teamId === teamFilter)
    : tasks;

  const stats = STAT_CONFIG.map((s) => ({
    ...s,
    count: tasks.filter((t) => t.status === s.status).length,
  }));

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Board</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isManager
              ? `${tasks.length} task${tasks.length !== 1 ? 's' : ''} across all teams`
              : `${tasks.length} task${tasks.length !== 1 ? 's' : ''} in your team`}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Manager team filter */}
          {isManager && teams.length > 0 && (
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-muted-foreground" />
              <Select
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className="h-8 text-xs pr-8 w-auto min-w-[120px]"
              >
                <option value="">All teams</option>
                {teams.map((t) => (
                  <option key={t.teamId} value={t.teamId}>{t.name}</option>
                ))}
              </Select>
              {teamFilter && (
                <button
                  onClick={() => setTeamFilter('')}
                  className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )}

          {isManager && <TaskForm onTaskCreated={handleCreateTask} />}
        </div>
      </div>

      {/* Stats bar */}
      {!isLoading && tasks.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap animate-slide-down">
          {stats.map((s) => (
            <StatChip key={s.status} {...s} />
          ))}
        </div>
      )}

      {/* Board content */}
      {isLoading ? (
        <PageSkeleton />
      ) : tasks.length === 0 ? (
        <EmptyState isManager={isManager} />
      ) : (
        <KanbanBoard
          tasks={visibleTasks}
          reloadTasks={refetch}
          onTaskClick={setSelectedTask}
        />
      )}

      {/* Task detail panel */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdated={handleTaskUpdated}
          onDeleted={handleTaskDeleted}
        />
      )}
    </div>
  );
}
