import { useDraggable } from '@dnd-kit/core';

const PRIORITY_BADGE = {
  HIGH: 'bg-red-50 text-red-600 border-red-200',
  MEDIUM: 'bg-amber-50 text-amber-600 border-amber-200',
  LOW: 'bg-green-50 text-green-600 border-green-200',
};

const isOverdue = (deadline, status) => {
  if (!deadline || status === 'DONE') return false;
  return new Date(deadline) < new Date();
};

const formatDeadline = (deadline) => {
  if (!deadline) return null;
  const d = new Date(deadline);
  const now = new Date();
  const diffDays = Math.ceil((d - now) / 86400000);
  if (diffDays < 0) return { label: `${Math.abs(diffDays)}d overdue`, overdue: true };
  if (diffDays === 0) return { label: 'Due today', overdue: false, today: true };
  if (diffDays <= 3) return { label: `Due in ${diffDays}d`, overdue: false, soon: true };
  return { label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), overdue: false };
};

export default function TaskCard({ task, onClick }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.taskId,
  });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 50, opacity: 0.85 }
    : undefined;

  const overdue = isOverdue(task.deadline, task.status);
  const deadlineInfo = formatDeadline(task.deadline);
  const thumbnail = task.presignedUrl;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white rounded-xl shadow-sm border transition-shadow hover:shadow-md ${
        overdue ? 'border-red-200 ring-1 ring-red-100' : 'border-gray-100'
      }`}
    >
      {/* Drag handle */}
      <div
        {...listeners}
        {...attributes}
        className="px-3 pt-2.5 pb-1 cursor-grab active:cursor-grabbing flex items-center gap-1 select-none"
        title="Drag to move"
      >
        <svg className="w-3 h-3 text-gray-300" fill="currentColor" viewBox="0 0 16 16">
          <circle cx="5" cy="4" r="1.3"/><circle cx="11" cy="4" r="1.3"/>
          <circle cx="5" cy="8" r="1.3"/><circle cx="11" cy="8" r="1.3"/>
          <circle cx="5" cy="12" r="1.3"/><circle cx="11" cy="12" r="1.3"/>
        </svg>
      </div>

      {/* Card body — clickable */}
      <div
        onClick={() => !isDragging && onClick?.()}
        className="px-3 pb-3 cursor-pointer"
      >
        {/* Thumbnail */}
        {thumbnail && (
          <img
            src={thumbnail}
            alt={task.title}
            className="w-full h-28 object-cover rounded-lg mb-2.5 pointer-events-none"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        )}

        {/* Title + priority */}
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <h3 className="font-semibold text-sm text-gray-900 leading-snug line-clamp-2 flex-1">
            {task.title}
          </h3>
          {task.priority && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${PRIORITY_BADGE[task.priority]}`}>
              {task.priority[0]}
            </span>
          )}
        </div>

        {/* Description */}
        {task.description && (
          <p className="text-xs text-gray-400 line-clamp-2 mb-2 leading-relaxed">
            {task.description}
          </p>
        )}

        {/* Footer meta */}
        <div className="flex items-center justify-between gap-2 mt-2">
          {/* Assignee avatar */}
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-[9px] font-bold flex items-center justify-center uppercase">
              {(task.assigneeEmail || task.assigneeId || '?').charAt(0)}
            </div>
            <span className="text-[10px] text-gray-400 truncate max-w-[80px]">
              {task.assigneeEmail || task.assigneeId?.slice(0, 8) + '…'}
            </span>
          </div>

          {/* Deadline chip */}
          {deadlineInfo && (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
              deadlineInfo.overdue
                ? 'bg-red-50 text-red-600'
                : deadlineInfo.today
                ? 'bg-amber-50 text-amber-600'
                : deadlineInfo.soon
                ? 'bg-orange-50 text-orange-500'
                : 'bg-gray-50 text-gray-400'
            }`}>
              {deadlineInfo.label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
