import { useDraggable } from '@dnd-kit/core';

export default function TaskCard({ task }) {
    const { attributes, listeners, setNodeRef, transform } =
        useDraggable({
            id: task.taskId,
        });

    const style = transform
        ? {
            transform: `translate(${transform.x}px, ${transform.y}px)`,
        }
        : undefined;

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className="bg-white rounded-xl shadow p-4 border cursor-grab"
        >
            <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg">
                    {task.title}
                </h3>

                <span className="text-xs bg-gray-200 px-2 py-1 rounded">
                    {task.priority}
                </span>
            </div>

            <p className="text-sm text-gray-600 mt-2">
                {task.description}
            </p>

            <div className="mt-4 text-xs text-gray-500">
                Assignee: {task.assigneeId}
            </div>
        </div>
    );
}