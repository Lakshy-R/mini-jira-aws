import { useDraggable } from '@dnd-kit/core';
import {
    Box,
    Card,
    CardContent,
    CardMedia,
    Chip,
    Stack,
    Typography,
} from '@mui/material';

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
        <Card
            ref={setNodeRef}
            style={style}
            sx={{
                boxShadow: isDragging ? 8 : 2,
                cursor: isDragging ? 'grabbing' : 'default',
            }}
        >
            <Box
                {...listeners}
                {...attributes}
                title="Drag to move"
                sx={{
                    px: 2,
                    pt: 1.5,
                    pb: 0.5,
                    cursor: 'grab',
                    color: 'text.disabled',
                    fontSize: 12,
                }}
            >
                drag
            </Box>

            <Box onClick={() => !isDragging && onClick?.()} sx={{ cursor: 'pointer' }}>
                {thumbnailUrl && (
                    <CardMedia
                        component="img"
                        height="140"
                        image={thumbnailUrl}
                        alt={task.title}
                        sx={{ objectFit: 'cover' }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                    />
                )}
                <CardContent>
                    <Stack spacing={1}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="subtitle1" fontWeight={700} color="text.primary">
                                {task.title}
                            </Typography>
                            <Chip label={task.priority} size="small" />
                        </Stack>

                        {task.description && (
                            <Typography variant="body2" color="text.secondary" noWrap>
                                {task.description}
                            </Typography>
                        )}

                        <Typography variant="caption" color="text.secondary">
                            Assignee: {task.assigneeId}
                        </Typography>
                    </Stack>
                </CardContent>
            </Box>
        </Card>
    );
}
