import { useState, useEffect } from 'react';
import { Plus, Upload, X } from 'lucide-react';
import { usersService } from '../../services/users.service';
import { projectsService } from '../../services/projects.service';
import { toast } from '../../store/toast.store';
import { Button } from '../ui/button';
import { Input, Textarea, Select, FormField } from '../ui/input';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
} from '../ui/dialog';
import { cn } from '../../lib/utils';

const PRIORITIES = [
  {
    value: 'LOW',
    label: 'Low',
    activeClass: 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.2)]',
    inactiveClass: 'border-white/[0.08] text-muted-foreground hover:border-emerald-500/30 hover:text-emerald-300',
  },
  {
    value: 'MEDIUM',
    label: 'Medium',
    activeClass: 'border-amber-500/50 bg-amber-500/15 text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.2)]',
    inactiveClass: 'border-white/[0.08] text-muted-foreground hover:border-amber-500/30 hover:text-amber-300',
  },
  {
    value: 'HIGH',
    label: 'High',
    activeClass: 'border-red-500/50 bg-red-500/15 text-red-300 shadow-[0_0_12px_rgba(239,68,68,0.2)]',
    inactiveClass: 'border-white/[0.08] text-muted-foreground hover:border-red-500/30 hover:text-red-300',
  },
];

const initialForm = {
  title: '', description: '', priority: 'MEDIUM',
  teamId: '', assigneeId: '', projectId: '', deadline: '',
};

export default function TaskForm({ onTaskCreated }) {
  const [open, setOpen]           = useState(false);
  const [form, setForm]           = useState(initialForm);
  const [imageFile, setImageFile] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [teams, setTeams]         = useState([]);
  const [projects, setProjects]   = useState([]);
  const [loading, setLoading]     = useState(false);

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

  const teamEmployees = form.teamId
    ? employees.filter((e) => e.teamId === form.teamId)
    : employees;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'teamId') {
        const stillValid = employees.some(
          (emp) => emp.userId === prev.assigneeId && emp.teamId === value
        );
        if (!stillValid) next.assigneeId = '';
      }
      return next;
    });
  };

  const handleClose = () => {
    setOpen(false);
    setForm(initialForm);
    setImageFile(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (!form.teamId)        { toast.error('Please select a team'); return; }
    if (!form.assigneeId)    { toast.error('Please select an assignee'); return; }

    setLoading(true);
    try {
      await onTaskCreated(form, imageFile);
      handleClose();
      toast.success('Task created');
    } catch (err) {
      toast.error(err.displayMessage || 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus size={15} />
          New Task
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto" onClose={handleClose}>
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">

            <FormField label="Title" required>
              <Input
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="What needs to be done?"
                autoFocus
              />
            </FormField>

            <FormField label="Description">
              <Textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Add more details…"
                rows={3}
              />
            </FormField>

            {/* Priority selector */}
            <FormField label="Priority">
              <div className="flex gap-2">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, priority: p.value }))}
                    className={cn(
                      'flex-1 text-xs font-semibold py-2 rounded-lg border transition-all duration-150',
                      form.priority === p.value ? p.activeClass : p.inactiveClass
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Deadline">
                <Input
                  type="date"
                  name="deadline"
                  value={form.deadline}
                  onChange={handleChange}
                  min={new Date().toISOString().split('T')[0]}
                />
              </FormField>

              <FormField label="Project">
                <Select
                  name="projectId"
                  value={form.projectId}
                  onChange={handleChange}
                >
                  <option value="">No project</option>
                  {projects.map((p) => (
                    <option key={p.projectId} value={p.projectId}>{p.name}</option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Team" required>
                <Select
                  name="teamId"
                  value={form.teamId}
                  onChange={handleChange}
                >
                  <option value="">Select team…</option>
                  {teams.map((t) => (
                    <option key={t.teamId} value={t.teamId}>{t.name}</option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Assignee" required>
                <Select
                  name="assigneeId"
                  value={form.assigneeId}
                  onChange={handleChange}
                  disabled={!form.teamId}
                >
                  <option value="">{form.teamId ? 'Select person…' : 'Pick a team first'}</option>
                  {teamEmployees.map((e) => (
                    <option key={e.userId} value={e.userId}>
                      {e.email?.split('@')[0] || e.name || e.email}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>

            {/* Image upload */}
            <FormField label="Attachment">
              <label className={cn(
                'flex items-center gap-3 w-full border-2 border-dashed rounded-xl px-4 py-3 cursor-pointer transition-all group',
                imageFile
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-white/[0.08] hover:border-primary/40 hover:bg-primary/5'
              )}>
                <Upload size={15} className={cn(
                  'shrink-0 transition-colors',
                  imageFile ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'
                )} />
                <span className={cn(
                  'text-sm truncate transition-colors flex-1',
                  imageFile ? 'text-foreground font-medium' : 'text-muted-foreground group-hover:text-foreground'
                )}>
                  {imageFile ? imageFile.name : 'Upload image (optional)'}
                </span>
                {imageFile && (
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setImageFile(null); }}
                    className="ml-auto text-muted-foreground hover:text-red-400 transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
            </FormField>

          </DialogBody>

          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating…' : 'Create Task'}
            </Button>
            <Button type="button" variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
