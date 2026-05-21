import { useState, useCallback } from 'react';
import { LayoutGrid, Filter, X } from 'lucide-react';
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

function PageSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 animate-pulse">
      {[0, 1, 2, 3].map((col) => (
        <div key={col} className="space-y-3">
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="w-2 h-2 rounded-full" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-6 rounded-full ml-auto" />
          </div>
          <div className="rounded-xl border-2 border-t-4 border-border p-2 min-h-[400px] space-y-2">
            {[0, 1, 2].map((card) => (
              <div key={card} className="bg-card rounded-xl border border-border p-4 space-y-3">
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
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
        <LayoutGrid size={28} className="text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">No tasks yet</h3>
      <p className="text-sm text-muted-foreground max-w-xs">
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

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Board</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isManager
              ? `${tasks.length} task${tasks.length !== 1 ? 's' : ''} across all teams`
              : `${tasks.length} task${tasks.length !== 1 ? 's' : ''} in your team`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Manager team filter */}
          {isManager && teams.length > 0 && (
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-muted-foreground" />
              <Select
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className="h-8 text-xs pr-8 w-auto"
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
