import TaskCard from './TaskCard';

export default function KanbanColumn({
    title,
    tasks,
}) {
    return (
        <div className="bg-gray-100 rounded-xl p-4 min-h-[500px]">
            <h2 className="font-bold text-lg mb-4">
                {title}
            </h2>

            <div className="space-y-4">
                {tasks.map(task => (
                    <TaskCard
                        key={task.taskId}
                        task={task}
                    />
                ))}
            </div>
        </div>
    );
}