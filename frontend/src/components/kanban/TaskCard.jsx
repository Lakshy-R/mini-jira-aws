import { useDraggable } from '@dnd-kit/core';

export default function TaskCard({ task, onClick }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } =
        useDraggable({
            id: task.taskId,
        });

    const style = transform
        ? {
            transform: `translate(${transform.x}px, ${transform.y}px)`,
            zIndex: 50,
            opacity: 0.9,
        }
        : undefined;

    const thumbnailUrl = task.presignedUrl;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="bg-white rounded-xl shadow border hover:shadow-md transition-shadow"
        >
            {/* Drag handle — only this area triggers drag */}
            <div
                {...listeners}
                {...attributes}
                className="px-4 pt-3 pb-1 cursor-grab active:cursor-grabbing flex items-center gap-1.5"
                title="Drag to move"
            >
                <svg className="w-3.5 h-3.5 text-gray-300 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <circle cx="7" cy="5" r="1.5"/>
                    <circle cx="13" cy="5" r="1.5"/>
                    <circle cx="7" cy="10" r="1.5"/>
                    <circle cx="13" cy="10" r="1.5"/>
                    <circle cx="7" cy="15" r="1.5"/>
                    <circle cx="13" cy="15" r="1.5"/>
                </svg>
                <span className="text-xs text-gray-300">drag</span>
            </div>

            {/* Clickable card body — opens modal */}
            <div
                onClick={() => !isDragging && onClick?.()}
                className="px-4 pb-4 cursor-pointer"
            >
                {thumbnailUrl && (
                    <img
                        src={thumbnailUrl}
                        alt={task.title}
                        className="w-full h-32 object-cover rounded-lg mb-3 pointer-events-none"
                        onError={(e) => { e.target.style.display = 'none'; }}
                    />
                )}

                <div className="flex items-center justify-between">
                    <h3 className="font-bold text-base text-gray-900">
                        {task.title}
                    </h3>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded font-medium shrink-0 ml-2">
                        {task.priority}
                    </span>
                </div>

                {task.description && (
                    <p className="text-sm text-gray-500 mt-1.5 line-clamp-2">
                        {task.description}
                    </p>
                )}

                <div className="mt-3 text-xs text-gray-400">
                    Assignee: {task.assigneeId}
                </div>
            </div>
        </div>
    );
}
