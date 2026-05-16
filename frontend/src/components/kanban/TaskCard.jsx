import { useState } from "react";
import { useDraggable } from '@dnd-kit/core';

const PRIORITY_COLORS = {
  HIGH: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  MEDIUM: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  LOW: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

export default function TaskCard({ task, onClick }) {
  const [imgError, setImgError] = useState(false);

  const { attributes, listeners, setNodeRef, transform } =
        useDraggable({
            id: task.taskId,
        });

  const style = transform
        ? {
            transform: `translate(${transform.x}px, ${transform.y}px)`,
        }
        : undefined;

  const thumbnailUrl = task.thumbnailUrl || task.imageUrl;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 cursor-grab hover:shadow-md hover:border-blue-200 dark:hover:border-blue-700 transition-all select-none"
    >
      {/* Thumbnail */}
      {thumbnailUrl && !imgError && (
        <img
          src={thumbnailUrl}
          alt={`Attachment for ${task.title}`}
          onError={() => setImgError(true)}
          className="w-full h-28 object-cover rounded-lg mb-3 pointer-events-none"
          loading="lazy"
        />
      )}

      {/* Title */}
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-snug mb-2">
        {task.title}
      </p>

      {/* Description preview */}
      {task.description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">
          {task.description}
        </p>
      )}

      {/* Footer row: priority + deadline */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.LOW
          }`}
        >
          {task.priority}
        </span>

        {task.deadline && (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {new Date(task.deadline).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
}
