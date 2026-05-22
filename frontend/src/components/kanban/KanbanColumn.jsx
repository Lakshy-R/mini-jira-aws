import { useDroppable } from '@dnd-kit/core';
import { cn } from '../../lib/utils';
import TaskCard from './TaskCard';
import { KanbanColumnSkeleton } from '../ui/skeleton';

const STATUS_CONFIG = {
  TODO: {
    label: 'To Do',
    dot: 'bg-slate-400',
    glow: '',
    border: 'border-t-slate-600',
    header: 'text-slate-400',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    dot: 'bg-blue-400',
    glow: 'shadow-[0_0_8px_rgba(96,165,250,0.4)]',
    border: 'border-t-blue-500',
    header: 'text-blue-400',
  },
  IN_REVIEW: {
    label: 'In Review',
    dot: 'bg-amber-400',
    glow: 'shadow-[0_0_8px_rgba(251,191,36,0.4)]',
    border: 'border-t-amber-500',
    header: 'text-amber-400',
  },
  DONE: {
    label: 'Done',
    dot: 'bg-emerald-400',
    glow: 'shadow-[0_0_8px_rgba(52,211,153,0.4)]',
    border: 'border-t-emerald-500',
    header: 'text-emerald-400',
  },
};

function EmptyColumn({ label }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center rounded-xl border-2 border-dashed border-white/[0.06] mt-2">
      <div className="w-8 h-8 rounded-full bg-white/[0.04] flex items-center justify-center mb-2">
        <span className="text-muted-foreground text-lg leading-none">·</span>
      </div>
      <p className="text-xs text-muted-foreground">No {label.toLowerCase()} tasks</p>
    </div>
  );
}

export default function KanbanColumn({ status, tasks, onTaskClick, loading = false }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const config = STATUS_CONFIG[status];

  return (
    <div className="flex flex-col min-w-0">
      {/* Column header */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className={cn('w-2 h-2 rounded-full shrink-0', config.dot, config.glow)} />
        <span className={cn('text-xs font-semibold uppercase tracking-wider', config.header)}>
          {config.label}
        </span>
        <span className="ml-auto text-xs font-medium text-muted-foreground bg-white/[0.06] px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
          {tasks.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 rounded-xl border-2 border-t-4 p-2 min-h-[400px] transition-all duration-150',
          config.border,
          isOver
            ? 'border-primary/30 bg-primary/[0.04]'
            : 'border-white/[0.05] bg-white/[0.02]'
        )}
      >
        {loading ? (
          <KanbanColumnSkeleton />
        ) : tasks.length === 0 ? (
          <EmptyColumn label={config.label} />
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => (
              <TaskCard
                key={task.taskId}
                task={task}
                onClick={() => onTaskClick(task)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
