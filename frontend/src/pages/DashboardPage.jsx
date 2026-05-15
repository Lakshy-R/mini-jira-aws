import { useEffect } from 'react';

import { tasksService } from '../services/tasks.service';

import { useTasksStore } from '../store/tasks.store';

import KanbanBoard from '../components/kanban/KanbanBoard';

export default function DashboardPage() {
    const { tasks, setTasks } =
        useTasksStore();

    useEffect(() => {
        loadTasks();
    }, []);

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

            <KanbanBoard tasks={tasks} />
        </div>
    );
}