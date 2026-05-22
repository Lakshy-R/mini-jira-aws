import { useState, useEffect } from 'react';
import { X, Calendar, Users, Tag, Trash2, ImagePlus, AlertTriangle, Pencil, Check } from 'lucide-react';
import { tasksService, updateTaskImage } from '../../services/tasks.service';
import { usersService } from '../../services/users.service';
import { useAuthStore } from '../../store/auth.store';
import { toast } from '../../store/toast.store';
import { cn, formatDeadline } from '../../lib/utils';
import { Avatar } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input, Textarea, Select } from '../ui/input';
import CommentThread from './CommentThread';
import api from '../../services/api';

const STATUSES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];

const STATUS_CONFIG = {
  TODO:        { label: 'To Do',       variant: 'secondary',    active: 'border-slate-500/50 bg-slate-500/10 text-slate-300',    hover: 'hover:border-slate-500/40 hover:text-slate-300' },
  IN_PROGRESS: { label: 'In Progress', variant: 'info',         active: 'border-blue-500/50 bg-blue-500/10 text-blue-300',       hover: 'hover:border-blue-500/40 hover:text-blue-300' },
  IN_REVIEW:   { label: 'In Review',   variant: 'warning',      active: 'border-amber-500/50 bg-amber-500/10 text-amber-300',    hover: 'hover:border-amber-500/40 hover:text-amber-300' },
  DONE:        { label: 'Done',        variant: 'success',      active: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300', hover: 'hover:border-emerald-500/40 hover:text-emerald-300' },
};

const PRIORITY_CONFIG = {
  HIGH:   { label: 'High',   variant: 'destructive' },
  MEDIUM: { label: 'Medium', variant: 'warning' },
  LOW:    { label: 'Low',    variant: 'success' },
};

function isOverdue(deadline, status) {
  if (!deadline || status === 'DONE') return false;
  return new Date(deadline) < new Date();
}

function EditForm({ task, onSave, onCancel }) {
  const [form, setForm] = useState({
    title:      task.title || '',
    description: task.description || '',
    priority:   task.priority || 'MEDIUM',
    assigneeId: task.assigneeId || '',
    deadline:   task.deadline ? task.deadline.split('T')[0] : '',
  });
  const [employees, setEmployees] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    usersService.getEmployees().then(setEmployees).catch(() => []);
  }, []);

  const teamEmployees = task.teamId
    ? employees.filter((e) => e.teamId === task.teamId)
    : employees;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    try {
      await onSave({
        title:       form.title.trim(),
        description: form.description.trim(),
        priority:    form.priority,
        assigneeId:  form.assigneeId || undefined,
        deadline:    form.deadline || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 animate-slide-down">
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Title</label>
        <Input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</label>
        <Textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Priority</label>
          <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Deadline</label>
          <Input
            type="date"
            value={form.deadline}
            onChange={(e) => setForm({ ...form, deadline: e.target.value })}
          />
        </div>
      </div>

      {teamEmployees.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Assignee</label>
          <Select value={form.assigneeId} onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}>
            <option value="">Unassigned</option>
            {teamEmployees.map((emp) => (
              <option key={emp.userId} value={emp.userId}>{emp.name || emp.email}</option>
            ))}
          </Select>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button type="submit" size="sm" disabled={saving}>
          <Check size={13} className="mr-1" />
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export default function TaskDetailModal({ task, onClose, onUpdated, onDeleted }) {
  const { user } = useAuthStore();
  const [currentTask, setCurrentTask] = useState(task);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [presignedImageUrl, setPresignedImageUrl] = useState(task.presignedUrl || null);

  const isManager = user?.role === 'manager';
  const isAssignee = user?.sub === currentTask.assigneeId;
  const canChangeStatus = isManager || isAssignee;
  const overdue = isOverdue(currentTask.deadline, currentTask.status);
  const deadline = formatDeadline(currentTask.deadline);

  const assigneeDisplay = currentTask.assigneeEmail
    ? currentTask.assigneeEmail.split('@')[0]
    : currentTask.assigneeName || currentTask.assigneeId?.slice(0, 12) || '—';

  useEffect(() => {
    if (!currentTask.presignedUrl && currentTask.imageUrl) {
      api.get(`/tasks/${currentTask.taskId}/image-url`)
        .then((res) => setPresignedImageUrl(res.data.url))
        .catch(() => setPresignedImageUrl(null));
    } else {
      setPresignedImageUrl(currentTask.presignedUrl || null);
    }
  }, [currentTask.imageUrl, currentTask.taskId, currentTask.presignedUrl]);

  const handleStatusChange = async (newStatus) => {
    if (newStatus === currentTask.status || statusUpdating) return;
    setStatusUpdating(true);
    try {
      const updated = await tasksService.updateStatus(currentTask.taskId, newStatus);
      const newTask = { ...currentTask, status: newStatus, ...updated };
      setCurrentTask(newTask);
      onUpdated?.(newTask);
      toast.success(`Status → ${STATUS_CONFIG[newStatus].label}`);
    } catch (err) {
      toast.error(err.displayMessage || 'Failed to update status');
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleEditSave = async (fields) => {
    try {
      const updated = await tasksService.updateTask(currentTask.taskId, fields);
      const newTask = { ...currentTask, ...fields, ...updated };
      setCurrentTask(newTask);
      onUpdated?.(newTask);
      setEditing(false);
      toast.success('Task updated');
    } catch (err) {
      toast.error(err.displayMessage || 'Failed to update task');
    }
  };

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    try {
      const result = await updateTaskImage(currentTask.taskId, file);
      const newTask = { ...currentTask, imageUrl: result.imageUrl, presignedUrl: null };
      setCurrentTask(newTask);
      onUpdated?.(newTask);
      toast.success('Image updated');
    } catch (err) {
      toast.error(err.displayMessage || 'Failed to update image');
    } finally {
      setImageUploading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await tasksService.deleteTask(currentTask.taskId);
      onDeleted?.(currentTask.taskId);
    } catch (err) {
      toast.error(err.displayMessage || 'Failed to delete task');
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-end bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="h-full w-full max-w-xl bg-[#0f1629]/95 backdrop-blur-xl border-l border-white/[0.06] shadow-[-20px_0_60px_rgba(0,0,0,0.5)] flex flex-col animate-slide-in-right overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-[#0f1629]/95 backdrop-blur-xl z-10 px-6 py-4 border-b border-white/[0.06] flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center flex-wrap gap-1.5">
              {currentTask.priority && (
                <Badge variant={PRIORITY_CONFIG[currentTask.priority]?.variant}>
                  {PRIORITY_CONFIG[currentTask.priority]?.label || currentTask.priority}
                </Badge>
              )}
              <Badge variant={STATUS_CONFIG[currentTask.status]?.variant}>
                {STATUS_CONFIG[currentTask.status]?.label || currentTask.status}
              </Badge>
              {overdue && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle size={10} />
                  Overdue
                </Badge>
              )}
            </div>
            <h2 className="text-lg font-semibold text-foreground leading-snug">
              {currentTask.title}
            </h2>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isManager && !editing && (
              <button
                onClick={() => setEditing(true)}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors"
                aria-label="Edit task"
              >
                <Pencil size={14} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors"
              aria-label="Close panel"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 px-6 py-5 space-y-6">

          {/* Edit form — manager only */}
          {editing && (
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Edit Task</p>
              <EditForm
                task={currentTask}
                onSave={handleEditSave}
                onCancel={() => setEditing(false)}
              />
            </div>
          )}

          {/* Image */}
          {(presignedImageUrl || currentTask.imageUrl) && (
            <div className="relative rounded-xl overflow-hidden bg-white/[0.04] group">
              {presignedImageUrl ? (
                <img
                  src={presignedImageUrl}
                  alt="Task attachment"
                  className="w-full max-h-52 object-cover opacity-90"
                />
              ) : (
                <div className="w-full h-32 flex items-center justify-center text-muted-foreground text-sm">
                  Loading image…
                </div>
              )}
              <label className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/60 transition-colors cursor-pointer">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 glass-strong text-foreground text-sm font-medium px-3 py-1.5 rounded-lg">
                  <ImagePlus size={14} className="text-primary" />
                  {imageUploading ? 'Uploading…' : 'Replace image'}
                </div>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handleImageChange}
                  disabled={imageUploading}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {/* Description */}
          {!editing && currentTask.description && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Description</p>
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{currentTask.description}</p>
            </div>
          )}

          {/* Meta grid */}
          {!editing && (
            <div className="grid grid-cols-2 gap-3">
              <div className="glass rounded-xl p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <Users size={11} />
                  Assignee
                </div>
                <div className="flex items-center gap-2">
                  <Avatar name={assigneeDisplay} size="sm" />
                  <span className="text-sm text-foreground capitalize truncate">{assigneeDisplay}</span>
                </div>
              </div>

              {currentTask.deadline && (
                <div className="glass rounded-xl p-3 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <Calendar size={11} />
                    Deadline
                  </div>
                  <div className="flex items-center gap-2">
                    {deadline && (
                      <Badge
                        variant={overdue ? 'destructive' : deadline.variant === 'today' ? 'warning' : 'secondary'}
                      >
                        {new Date(currentTask.deadline).toLocaleDateString(undefined, {
                          year: 'numeric', month: 'short', day: 'numeric',
                        })}
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {currentTask.teamId && (
                <div className="glass rounded-xl p-3 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <Tag size={11} />
                    Team
                  </div>
                  <span className="text-sm text-foreground">{currentTask.teamId}</span>
                </div>
              )}
            </div>
          )}

          {/* Status selector */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Change Status</p>
            <div className="grid grid-cols-2 gap-2">
              {STATUSES.map((s) => {
                const cfg = STATUS_CONFIG[s];
                const isActive = currentTask.status === s;
                return (
                  <button
                    key={s}
                    onClick={() => canChangeStatus && handleStatusChange(s)}
                    disabled={!canChangeStatus || statusUpdating}
                    className={cn(
                      'px-3 py-2 rounded-lg text-xs font-medium border transition-all duration-150',
                      isActive
                        ? cfg.active
                        : cn('border-white/[0.06] text-muted-foreground bg-white/[0.02]', cfg.hover),
                      !canChangeStatus && 'cursor-not-allowed opacity-40'
                    )}
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>
            {!canChangeStatus && (
              <p className="text-xs text-muted-foreground mt-2">Only the assignee or a manager can change status.</p>
            )}
          </div>

          {/* Comments */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Comments</p>
            <CommentThread taskId={currentTask.taskId} />
          </div>

          {/* Danger zone */}
          {isManager && (
            <div className="border-t border-white/[0.06] pt-4">
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-red-400 transition-colors group"
                >
                  <Trash2 size={14} className="group-hover:text-red-400 transition-colors" />
                  Delete task
                </button>
              ) : (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                  <p className="text-sm font-medium text-red-400 mb-3">This action cannot be undone.</p>
                  <div className="flex items-center gap-2">
                    <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
                      {deleting ? 'Deleting…' : 'Yes, delete task'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
