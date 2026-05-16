import { useEffect, useState } from 'react';
import { projectsService } from '../services/projects.service';

export default function ProjectsPage() {
    const [projects, setProjects] = useState([]);

    const [form, setForm] = useState({
        name: '',
        description: '',
        teamId: '',
    });

    useEffect(() => {
        loadProjects();
    }, []);

    const loadProjects = async () => {
        try {
            const data =
                await projectsService.getProjects();

            setProjects(data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();

        try {
            await projectsService.createProject(form);

            setForm({
                name: '',
                description: '',
                teamId: '',
            });

            loadProjects();
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold mb-6">
                Projects
            </h1>

            {/* CREATE FORM */}
            <form
                onSubmit={handleCreate}
                className="space-y-4 mb-8"
            >
                <input
                    type="text"
                    placeholder="Project Name"
                    value={form.name}
                    onChange={(e) =>
                        setForm({
                            ...form,
                            name: e.target.value,
                        })
                    }
                    className="border p-2 w-full"
                />

                <textarea
                    placeholder="Description"
                    value={form.description}
                    onChange={(e) =>
                        setForm({
                            ...form,
                            description: e.target.value,
                        })
                    }
                    className="border p-2 w-full"
                />

                <input
                    type="text"
                    placeholder="Team ID"
                    value={form.teamId}
                    onChange={(e) =>
                        setForm({
                            ...form,
                            teamId: e.target.value,
                        })
                    }
                    className="border p-2 w-full"
                />

                <button
                    className="bg-black text-white px-4 py-2 rounded"
                >
                    Create Project
                </button>
            </form>

            {/* PROJECT LIST */}
            <div className="space-y-4">
                {projects.map((project) => (
                    <div
                        key={project.projectId}
                        className="border rounded-xl p-4 shadow"
                    >
                        <h2 className="font-bold text-xl">
                            {project.name}
                        </h2>

                        <p>{project.description}</p>

                        <div className="text-sm mt-2">
                            Team: {project.teamId}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}