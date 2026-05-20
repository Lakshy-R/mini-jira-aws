import { useDroppable } from '@dnd-kit/core';
import { Paper, Stack, Typography } from '@mui/material';
import TaskCard from './TaskCard';

export default function KanbanColumn({
    title,
    status,
    tasks,
    onTaskClick,
}) {
    const { setNodeRef } = useDroppable({
        id: status,
    });

    return (
        <Paper
            ref={setNodeRef}
            sx={{
                p: 2,
                minHeight: 520,
                bgcolor: 'grey.100',
            }}
            elevation={0}
        >
            <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
                {title}
            </Typography>

            <Stack spacing={2}>
                {tasks.map(task => (
                    <TaskCard
                        key={task.taskId}
                        task={task}
                        onClick={() => onTaskClick(task)}
                    />
                ))}
            </Stack>
        </Paper>
    );
}