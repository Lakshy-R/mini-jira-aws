import {
    DndContext,
    closestCenter,
} from '@dnd-kit/core';

import KanbanColumn from './KanbanColumn';
import { tasksService } from '../../services/tasks.service';

const STATUSES = [
    'TODO',
    'IN_PROGRESS',
    'IN_REVIEW',
    'DONE',
];

export default function KanbanBoard({
    tasks,
    reloadTasks,
}) {
    const handleDragEnd = async ({
        active,
        over,
    }) => {
        if (!over) return;

        const taskId = active.id;
        const newStatus = over.id;

        try {
            await tasksService.updateStatus(
                taskId,
                newStatus
            );

            reloadTasks();
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <DndContext
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
        >
            <div className="grid grid-cols-4 gap-4">
                {STATUSES.map(status => (
                    <KanbanColumn
                        key={status}
                        status={status}
                        title={status.replace('_', ' ')}
                        tasks={tasks.filter(
                            t => t.status === status
                        )}
                    />
                ))}
            </div>
        </DndContext>
    );
}