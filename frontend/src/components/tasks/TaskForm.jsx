import { useState, useEffect } from 'react';
import { usersService } from '../../services/users.service';
import { projectsService } from '../../services/projects.service';
import { toast } from '../../store/toast.store';

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'];

const PRIORITY_COLORS = {
  LOW: 'bg-green-50 text-green-700 border-green-200',
  MEDIUM: 'bg-amber-50 text-amber-700 border-amber-200',
  HIGH: 'bg-red-50 text-red-700 border-red-200',
};

const initialForm = {
  title: '',
  description: '',
  priority: 'MEDIUM',
  teamId: '',
  assigneeId: '',
  projectId: '',
  deadline: '',
};

export default function TaskForm({ onTaskCreated }) {
  const [form, setForm] = useState(initialForm);
  const [imageFile, setImageFile] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [teams, setTeams] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      usersService.getEmployees().catch(() => []),
      usersService.getTeams().catch(() => []),
      projectsService.getProjects().catch(() => []),
    ]).then(([emps, tms, projs]) => {
      setEmployees(emps);
      setTeams(tms);
      setProjects(projs);
    });
  }, [open]);

  // Filter employees when team changes
  const teamEmployees = form.teamId
    ? employees.filter((e) => e.teamId === form.teamId)
    : employees;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      // Reset assignee if team changes and current assignee isn't on new team
      if (name === 'teamId') {
        const stillValid = employees.some(
          (e) => e.userId === prev.assigneeId && e.teamId === value
        );
        if (!stillValid) next.assigneeId = '';
      }
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (!form.teamId) { toast.error('Please select a team'); return; }
    if (!form.assigneeId) { toast.error('Please select an assignee'); return; }

    setLoading(true);
    try {
      await onTaskCreated(form, imageFile);
      setForm(initialForm);
      setImageFile(null);
      setOpen(false);
      toast.success('Task created successfully');
    } catch (err) {
      toast.error(err.displayMessage || 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  const labelCls = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1';
  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition placeholder-gray-400 bg-white';

  return (
    <div className="mb-6">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Task
        </button>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-lg">
          {/* Form header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Create New Task</h2>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >✕</button>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Title */}
              <div className="sm:col-span-2">
                <label className={labelCls}>Title *</label>
                <input
                  type="text"
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  placeholder="What needs to be done?"
                  className={inputCls}
                  required
                />
              </div>

              {/* Description */}
              <div className="sm:col-span-2">
                <label className={labelCls}>Description</label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Add more details…"
                  rows={3}
                  className={`${inputCls} resize-none`}
                />
              </div>

              {/* Priority */}
              <div>
                <label className={labelCls}>Priority</label>
                <div className="flex gap-2">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, priority: p }))}
                      className={`flex-1 text-xs font-semibold py-2 rounded-lg border transition-all ${
                        form.priority === p
                          ? PRIORITY_COLORS[p] + ' ring-2 ring-offset-1 ring-current'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-white'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Deadline */}
              <div>
                <label className={labelCls}>Deadline</label>
                <input
                  type="date"
                  name="deadline"
                  value={form.deadline}
                  onChange={handleChange}
                  min={new Date().toISOString().split('T')[0]}
                  className={inputCls}
                />
              </div>

              {/* Team */}
              <div>
                <label className={labelCls}>Team *</label>
                <select
                  name="teamId"
                  value={form.teamId}
                  onChange={handleChange}
                  className={inputCls}
                  required
                >
                  <option value="">Select team…</option>
                  {teams.map((t) => (
                    <option key={t.teamId} value={t.teamId}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* Assignee */}
              <div>
                <label className={labelCls}>Assignee *</label>
                <select
                  name="assigneeId"
                  value={form.assigneeId}
                  onChange={handleChange}
                  className={inputCls}
                  required
                  disabled={!form.teamId}
                >
                  <option value="">{form.teamId ? 'Select assignee…' : 'Select a team first'}</option>
                  {teamEmployees.map((e) => (
                    <option key={e.userId} value={e.userId}>
                      {e.email || e.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Project */}
              <div>
                <label className={labelCls}>Project</label>
                <select
                  name="projectId"
                  value={form.projectId}
                  onChange={handleChange}
                  className={inputCls}
                >
                  <option value="">No project</option>
                  {projects.map((p) => (
                    <option key={p.projectId} value={p.projectId}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Image upload */}
              <div>
                <label className={labelCls}>Image attachment</label>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="task-image-upload"
                  />
                  <label
                    htmlFor="task-image-upload"
                    className="flex items-center gap-2 w-full border border-dashed border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-600 cursor-pointer transition-colors"
                  >
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    <span className="truncate">
                      {imageFile ? imageFile.name : 'Upload image (optional)'}
                    </span>
                  </label>
                </div>
              </div>

            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
              >
                {loading ? 'Creating…' : 'Create Task'}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
