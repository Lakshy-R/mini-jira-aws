import { useState } from 'react';

export default function TaskForm({ onTaskCreated }) {
    const [form, setForm] = useState({
        title: '',
        description: '',
        priority: 'MEDIUM',
        teamId: '',
        assigneeId: '',
    });

    const handleChange = (e) => {
        setForm({
            ...form,
            [e.target.name]: e.target.value,
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        await onTaskCreated(form);

        setForm({
            title: '',
            description: '',
            priority: 'MEDIUM',
            teamId: '',
            assigneeId: '',
        });
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="bg-white p-4 rounded-xl shadow mb-6 space-y-4"
        >
            <h2 className="text-xl font-bold">
                Create Task
            </h2>

            <input
                type="text"
                name="title"
                placeholder="Task title"
                value={form.title}
                onChange={handleChange}
                className="border p-2 rounded w-full"
            />

            <textarea
                name="description"
                placeholder="Description"
                value={form.description}
                onChange={handleChange}
                className="border p-2 rounded w-full"
            />

            <select
                name="priority"
                value={form.priority}
                onChange={handleChange}
                className="border p-2 rounded w-full"
            >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
            </select>

            <input
                type="text"
                name="teamId"
                placeholder="Team ID"
                value={form.teamId}
                onChange={handleChange}
                className="border p-2 rounded w-full"
            />

            <input
                type="text"
                name="assigneeId"
                placeholder="Assignee ID"
                value={form.assigneeId}
                onChange={handleChange}
                className="border p-2 rounded w-full"
            />

            <button
                type="submit"
                className="bg-black text-white px-4 py-2 rounded"
            >
                Create Task
            </button>
        </form>
    );
}