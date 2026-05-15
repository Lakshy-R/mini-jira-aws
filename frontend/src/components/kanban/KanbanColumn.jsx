export default function KanbanColumn({
    title,
    tasks,
}) {
    return (
        <div className="bg-gray-100 rounded-xl p-4 min-h-[500px]">
            <h2 className="font-bold text-lg mb-4">
                {title}
            </h2>

            <div className="space-y-3">
                {tasks.map((task) => (
                    <div
                        key={task.taskId}
                        className="bg-white p-3 rounded-lg shadow"
                    >
                        <h3 className="font-semibold">
                            {task.title}
                        </h3>

                        <p className="text-sm text-gray-500">
                            {task.description}
                        </p>

                        <div className="mt-2 text-xs">
                            Priority: {task.priority}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}