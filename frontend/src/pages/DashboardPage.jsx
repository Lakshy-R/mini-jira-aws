import { useEffect } from 'react';

import { tasksService } from '../services/tasks.service';

import { useTasksStore } from '../store/tasks.store';

import KanbanBoard from '../components/kanban/KanbanBoard';

import TaskForm from '../components/tasks/TaskForm';

export default function DashboardPage() {
    const { tasks, setTasks } =
        useTasksStore();

    useEffect(() => {
        loadTasks();
    }, []);

    const handleCreateTask = async (taskData) => {
        try {
            await tasksService.createTask(taskData);

            await loadTasks();
        } catch (err) {
            console.error(err);
        }
    };

    const loadTasks = async () => {
        try {
            const data =
                await tasksService.getTasks();

            setTasks(data);
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold mb-6">
                Mini Jira Dashboard
            </h1>

            <TaskForm onTaskCreated={handleCreateTask} />

            <KanbanBoard tasks={tasks} reloadTasks={loadTasks} />
        </div>
    );
}