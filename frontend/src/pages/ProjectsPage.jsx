import { useEffect, useState } from 'react';
import { projectsService } from '../services/projects.service';
import { usersService } from '../services/users.service';
import { useAuthStore } from '../store/auth.store';
import { toast } from '../store/toast.store';

const initialForm = { name: '', description: '', teamId: '' };

function ProjectCard({ project, isManager, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
            <h2 className="font-semibold text-gray-900 text-base truncate">{project.name}</h2>
          </div>
          {project.description && (
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{project.description}</p>
          )}
          <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
              {project.teamId}
            </span>
            {project.createdAt && (
              <span>Created {new Date(project.createdAt).toLocaleDateString()}</span>
            )}
          </div>
        </div>

        {isManager && (
          <div className="shrink-0">
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-gray-300 hover:text-red-400 transition-colors p-1 rounded"
                aria-label="Delete project"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onDelete(project.projectId)}
                  className="text-xs text-red-500 hover:text-red-700 font-medium"
                >Yes</button>
                <span className="text-gray-300">·</span>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >No</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const { user } = useAuthStore();
  const isManager = user?.role === 'manager';

  const [projects, setProjects] = useState([]);
  const [teams, setTeams] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadProjects();
    if (isManager) {
      usersService.getTeams().then(setTeams).catch(() => {});
    }
  }, [isManager]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await projectsService.getProjects();
      setProjects(data);
    } catch (err) {
      toast.error(err.displayMessage || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Project name is required'); return; }
    if (!form.teamId) { toast.error('Please select a team'); return; }
    setCreating(true);
    try {
      await projectsService.createProject(form);
      setForm(initialForm);
      setShowForm(false);
      toast.success('Project created');
      await loadProjects();
    } catch (err) {
      toast.error(err.displayMessage || 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (projectId) => {
    try {
      await projectsService.deleteProject(projectId);
      setProjects((p) => p.filter((proj) => proj.projectId !== projectId));
      toast.success('Project deleted');
    } catch (err) {
      toast.error(err.displayMessage || 'Failed to delete project');
    }
  };

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition placeholder-gray-400';
  const labelCls = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1';

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Projects</h1>
          <p className="text-sm text-gray-400 mt-0.5">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        {isManager && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Project
          </button>
        )}
      </div>

      {/* Create form */}
      {isManager && showForm && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-lg mb-6">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">New Project</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
          <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
            <div>
              <label className={labelCls}>Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Project name"
                className={inputCls}
                required
              />
            </div>
            <div>
              <label className={labelCls}>Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What is this project about?"
                rows={3}
                className={`${inputCls} resize-none`}
              />
            </div>
            <div>
              <label className={labelCls}>Team *</label>
              <select
                value={form.teamId}
                onChange={(e) => setForm({ ...form, teamId: e.target.value })}
                className={inputCls}
                required
              >
                <option value="">Select team…</option>
                {teams.map((t) => (
                  <option key={t.teamId} value={t.teamId}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
              <button
                type="submit"
                disabled={creating}
                className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
              >
                {creating ? 'Creating…' : 'Create Project'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Project list */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 h-32">
              <div className="h-4 w-1/2 bg-gray-100 rounded mb-3" />
              <div className="h-3 w-full bg-gray-100 rounded mb-2" />
              <div className="h-3 w-2/3 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="text-5xl mb-4">📁</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-1">No projects yet</h3>
          <p className="text-sm text-gray-400">
            {isManager ? 'Create your first project above.' : 'Your manager hasn\'t created any projects for your team yet.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.projectId}
              project={project}
              isManager={isManager}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
