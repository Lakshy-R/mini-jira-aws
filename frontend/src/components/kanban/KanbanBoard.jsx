import {
    DndContext,
    closestCenter,
} from '@dnd-kit/core';
import { Grid } from '@mui/material';

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
    onTaskClick,
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
            <Grid container spacing={2}>
                {STATUSES.map(status => (
                    <Grid item xs={12} md={3} key={status}>
                        <KanbanColumn
                            status={status}
                            title={status.replace('_', ' ')}
                            tasks={tasks.filter(
                                t => t.status === status
                            )}
                            onTaskClick={onTaskClick}
                        />
                    </Grid>
                ))}
            </Grid>
        </DndContext>
    );
}