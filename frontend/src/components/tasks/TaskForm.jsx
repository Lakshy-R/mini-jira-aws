import { useState } from 'react';
import { tasksService } from '../../services/tasks.service';

export default function TaskForm({ onTaskCreated }) {
    const [form, setForm] = useState({
        title: '',
        description: '',
        priority: 'MEDIUM',
        teamId: 'frontend',
        assigneeId: 'sara',
    });

    const handleChange = e => {
        setForm({
            ...form,
            [e.target.name]: e.target.value,
        });
    };

    const handleSubmit = async e => {
        e.preventDefault();

        try {
            await tasksService.createTask(form);

            setForm({
                title: '',
                description: '',
                priority: 'MEDIUM',
                teamId: 'frontend',
                assigneeId: 'sara',
            });

            onTaskCreated();
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="border p-4 rounded-xl shadow mb-6 space-y-4"
        >
            <h2 className="text-xl font-bold">
                Create Task
            </h2>

            <input
                type="text"
                name="title"
                placeholder="Title"
                value={form.title}
                onChange={handleChange}
                className="border p-2 w-full rounded"
            />

            <textarea
                name="description"
                placeholder="Description"
                value={form.description}
                onChange={handleChange}
                className="border p-2 w-full rounded"
            />

            <select
                name="priority"
                value={form.priority}
                onChange={handleChange}
                className="border p-2 w-full rounded"
            >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
            </select>

            <button
                type="submit"
                className="bg-black text-white px-4 py-2 rounded"
            >
                Create Task
            </button>
        </form>
    );
}