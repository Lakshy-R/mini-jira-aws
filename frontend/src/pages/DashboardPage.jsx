import { useEffect, useMemo, useState } from 'react';
import { tasksService, createTask } from '../services/tasks.service';
import { useTasksStore } from '../store/tasks.store';
import { useAuthStore } from '../store/auth.store';
import KanbanBoard from '../components/kanban/KanbanBoard';
import TaskForm from '../components/tasks/TaskForm';
import TaskDetailModal from '../components/tasks/TaskDetailModal';
import {
    Alert,
    Box,
    Container,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Snackbar,
    Stack,
    Typography,
} from '@mui/material';

export default function DashboardPage() {
    const { tasks, setTasks } = useTasksStore();
    const { user } = useAuthStore();
    const [selectedTask, setSelectedTask] = useState(null);
    const [toast, setToast] = useState(null);
    const [teamFilter, setTeamFilter] = useState('ALL');

    useEffect(() => {
        loadTasks();
    }, []);

    const handleCreateTask = async (taskData, imageFile) => {
        try {
            await createTask(taskData, imageFile);
            await loadTasks();
        } catch (err) {
            console.error(err);
            setToast({ type: 'error', message: 'Failed to create task.' });
        }
    };

    const loadTasks = async () => {
        try {
            const data = await tasksService.getTasks();
            setTasks(data);
        } catch (err) {
            console.error(err);
            setToast({ type: 'error', message: 'Failed to load tasks.' });
        }
    };

    const handleTaskUpdated = (updatedTask) => {
        setTasks(tasks.map(t => t.taskId === updatedTask.taskId ? updatedTask : t));
    };

    const filteredTasks = useMemo(() => {
        if (user?.role !== 'manager') return tasks;
        if (teamFilter === 'ALL') return tasks;
        return tasks.filter((t) => t.teamId === teamFilter);
    }, [tasks, teamFilter, user?.role]);

    const teams = useMemo(() => {
        const unique = new Set(tasks.map((t) => t.teamId).filter(Boolean));
        return Array.from(unique);
    }, [tasks]);

    return (
        <Container maxWidth="xl">
            <Stack spacing={3} sx={{ py: 4 }}>
                <Box>
                    <Typography variant="h4" fontWeight={700} color="text.primary">
                        Kanban Board
                    </Typography>
                </Box>

                {user?.role === 'manager' && teams.length > 0 && (
                    <Box sx={{ maxWidth: 280 }}>
                        <FormControl fullWidth size="small">
                            <InputLabel id="team-filter-label">Team filter</InputLabel>
                            <Select
                                labelId="team-filter-label"
                                value={teamFilter}
                                label="Team filter"
                                onChange={(e) => setTeamFilter(e.target.value)}
                            >
                                <MenuItem value="ALL">All teams</MenuItem>
                                {teams.map((team) => (
                                    <MenuItem key={team} value={team}>{team}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Box>
                )}

                <TaskForm onTaskCreated={handleCreateTask} />

                <KanbanBoard
                    tasks={filteredTasks}
                    reloadTasks={loadTasks}
                    onTaskClick={(task) => setSelectedTask(task)}
                />

                {selectedTask && (
                    <TaskDetailModal
                        task={selectedTask}
                        onClose={() => setSelectedTask(null)}
                        onUpdated={handleTaskUpdated}
                        onError={(message) => setToast({ type: 'error', message })}
                    />
                )}

                <Snackbar
                    open={Boolean(toast)}
                    autoHideDuration={3500}
                    onClose={() => setToast(null)}
                    anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                >
                    <Alert onClose={() => setToast(null)} severity={toast?.type || 'info'} variant="filled">
                        {toast?.message}
                    </Alert>
                </Snackbar>
            </Stack>
        </Container>
    );
}