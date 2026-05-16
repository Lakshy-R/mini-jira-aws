import { useEffect, useState } from 'react';
import { tasksService, createTask } from '../services/tasks.service';
import { useTasksStore } from '../store/tasks.store';
import KanbanBoard from '../components/kanban/KanbanBoard';
import TaskForm from '../components/tasks/TaskForm';
import TaskDetailModal from '../components/tasks/TaskDetailModal';

export default function DashboardPage() {
    const { tasks, setTasks } = useTasksStore();
    const [selectedTask, setSelectedTask] = useState(null);

    useEffect(() => {
        loadTasks();
    }, []);

    const handleCreateTask = async (taskData, imageFile) => {
        try {
            await createTask(taskData, imageFile);
            await loadTasks();
        } catch (err) {
            console.error(err);
        }
    };

    const loadTasks = async () => {
        try {
            const data = await tasksService.getTasks();
            setTasks(data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleTaskUpdated = (updatedTask) => {
        setTasks(tasks.map(t => t.taskId === updatedTask.taskId ? updatedTask : t));
    };

    return (
        <div>
            <h1 className="text-3xl font-bold mb-6 text-gray-900">
                Kanban Board
            </h1>

            <TaskForm onTaskCreated={handleCreateTask} />

            <KanbanBoard 
                tasks={tasks} 
                reloadTasks={loadTasks} 
                onTaskClick={(task) => setSelectedTask(task)} 
            />

            {selectedTask && (
                <TaskDetailModal
                    task={selectedTask}
                    onClose={() => setSelectedTask(null)}
                    onUpdated={handleTaskUpdated}
                />
            )}
        </div>
    );
}