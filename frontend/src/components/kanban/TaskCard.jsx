import { useDraggable } from '@dnd-kit/core';
import { Calendar, GripVertical } from 'lucide-react';
import { cn, formatDeadline } from '../../lib/utils';
import { Avatar } from '../ui/avatar';
import { Badge } from '../ui/badge';

const PRIORITY_CONFIG = {
  HIGH:   { bar: 'bg-red-500',    badge: 'destructive', dot: 'text-red-500' },
  MEDIUM: { bar: 'bg-amber-400',  badge: 'warning',     dot: 'text-amber-500' },
  LOW:    { bar: 'bg-emerald-400',badge: 'success',     dot: 'text-emerald-500' },
};

const DEADLINE_VARIANT = {
  overdue: 'destructive',
  today:   'warning',
  soon:    'warning',
  normal:  'secondary',
};

export default function TaskCard({ task, onClick }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.taskId,
  });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 999 }
    : undefined;

  const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.MEDIUM;
  const deadline = formatDeadline(task.deadline);
  const assigneeDisplay = task.assigneeEmail
    ? task.assigneeEmail.split('@')[0]
    : task.assigneeName || task.assigneeId?.slice(0, 8);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative bg-card rounded-xl border border-border overflow-hidden',
        'shadow-[0_1px_3px_0_rgba(0,0,0,0.06)] hover:shadow-[0_4px_12px_0_rgba(0,0,0,0.09)]',
        'transition-all duration-150 cursor-pointer select-none',
        isDragging && 'opacity-60 rotate-1 shadow-lg scale-[1.02]'
      )}
      onClick={() => !isDragging && onClick?.()}
    >
      {/* Priority indicator bar */}
      <div className={cn('absolute left-0 top-0 bottom-0 w-[3px]', priority.bar)} />

      <div className="pl-4 pr-3 py-3">
        {/* Drag handle + priority row */}
        <div className="flex items-center gap-1.5 mb-2">
          <button
            {...listeners}
            {...attributes}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing p-0.5 rounded"
            onClick={(e) => e.stopPropagation()}
            aria-label="Drag task"
          >
            <GripVertical size={14} />
          </button>
          {task.priority && (
            <Badge variant={priority.badge} className="text-[10px] px-1.5 py-0 leading-4">
              {task.priority}
            </Badge>
          )}
        </div>

        {/* Thumbnail */}
        {task.presignedUrl && (
          <img
            src={task.presignedUrl}
            alt={task.title}
            className="w-full h-24 object-cover rounded-lg mb-2.5 pointer-events-none"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        )}

        {/* Title */}
        <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2 mb-1">
          {task.title}
        </h3>

        {/* Description */}
        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-2">
            {task.description}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 mt-2.5">
          {/* Assignee */}
          <div className="flex items-center gap-1.5 min-w-0">
            <Avatar name={assigneeDisplay || '?'} size="xs" />
            <span className="text-[10px] text-muted-foreground truncate max-w-[70px]">
              {assigneeDisplay || '—'}
            </span>
          </div>

          {/* Deadline */}
          {deadline && (
            <div className="flex items-center gap-1 shrink-0">
              <Calendar size={9} className="text-muted-foreground" />
              <Badge variant={DEADLINE_VARIANT[deadline.variant]} className="text-[10px] px-1.5 py-0 leading-4">
                {deadline.label}
              </Badge>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
