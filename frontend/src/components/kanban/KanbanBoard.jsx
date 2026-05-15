import KanbanColumn from './KanbanColumn';

const STATUSES = [
    'TODO',
    'IN_PROGRESS',
    'IN_REVIEW',
    'DONE',
];

export default function KanbanBoard({
    tasks,
}) {
    return (
        <div className="grid grid-cols-4 gap-4">
            {STATUSES.map((status) => (
                <KanbanColumn
                    key={status}
                    title={status.replace('_', ' ')}
                    tasks={tasks.filter(
                        (t) => t.status === status
                    )}
                />
            ))}
        </div>
    );
}