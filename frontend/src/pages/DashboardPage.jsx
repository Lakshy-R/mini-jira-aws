import { useEffect, useState, useCallback } from 'react';
import { tasksService, createTask } from '../services/tasks.service';
import { usersService } from '../services/users.service';
import { useTasksStore } from '../store/tasks.store';
import { useAuthStore } from '../store/auth.store';
import KanbanBoard from '../components/kanban/KanbanBoard';
import TaskForm from '../components/tasks/TaskForm';
import TaskDetailModal from '../components/tasks/TaskDetailModal';
import { toast } from '../store/toast.store';

function KanbanSkeleton() {
  return (
    <div className="grid grid-cols-4 gap-4 animate-pulse">
      {[0, 1, 2, 3].map((col) => (
        <div key={col} className="bg-gray-100 rounded-xl p-4 min-h-[400px]">
          <div className="h-5 w-24 bg-gray-200 rounded mb-4" />
          {[0, 1, 2].map((card) => (
            <div key={card} className="bg-white rounded-xl p-3 mb-3 space-y-2">
              <div className="h-4 bg-gray-100 rounded w-3/4" />
              <div className="h-3 bg-gray-100 rounded w-full" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { tasks, setTasks } = useTasksStore();
  const { user } = useAuthStore();
  const isManager = user?.role === 'manager';

  const [selectedTask, setSelectedTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [teamFilter, setTeamFilter] = useState('');
  const [teams, setTeams] = useState([]);

  const loadTasks = useCallback(async () => {
    try {
      const result = await tasksService.getTasks();
      // API now returns { items, lastKey }
      const items = result?.items ?? result ?? [];
      setTasks(items);
    } catch (err) {
      toast.error(err.displayMessage || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [setTasks]);

  useEffect(() => {
    loadTasks();
    if (isManager) {
      usersService.getTeams().then(setTeams).catch(() => {});
    }
  }, [loadTasks, isManager]);

  const handleCreateTask = async (taskData, imageFile) => {
    await createTask(taskData, imageFile);
    await loadTasks();
  };

  const handleTaskUpdated = (updatedTask) => {
    setTasks(tasks.map((t) => (t.taskId === updatedTask.taskId ? updatedTask : t)));
  };

  const handleTaskDeleted = (taskId) => {
    setTasks(tasks.filter((t) => t.taskId !== taskId));
    setSelectedTask(null);
    toast.success('Task deleted');
  };

  const visibleTasks = teamFilter
    ? tasks.filter((t) => t.teamId === teamFilter)
    : tasks;

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Board</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {isManager
              ? `${tasks.length} task${tasks.length !== 1 ? 's' : ''} across all teams`
              : `${tasks.length} task${tasks.length !== 1 ? 's' : ''} for your team`}
          </p>
        </div>

        {/* Manager team filter */}
        {isManager && teams.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-500 shrink-0">Filter by team</label>
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All teams</option>
              {teams.map((t) => (
                <option key={t.teamId} value={t.teamId}>{t.name}</option>
              ))}
            </select>
            {teamFilter && (
              <button
                onClick={() => setTeamFilter('')}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* Task creation — managers only */}
      {isManager && (
        <TaskForm onTaskCreated={handleCreateTask} />
      )}

      {/* Board */}
      {loading ? (
        <KanbanSkeleton />
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="text-5xl mb-4">📋</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-1">No tasks yet</h3>
          <p className="text-sm text-gray-400">
            {isManager ? 'Create your first task using the button above.' : 'Your manager hasn\'t assigned any tasks yet.'}
          </p>
        </div>
      ) : (
        <KanbanBoard
          tasks={visibleTasks}
          reloadTasks={loadTasks}
          onTaskClick={setSelectedTask}
        />
      )}

      {/* Task detail modal */}
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
