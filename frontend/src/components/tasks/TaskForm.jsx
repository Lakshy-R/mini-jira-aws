import { useState, useRef } from "react";
import { createTask, updateTaskImage } from "../../services/tasks.service";

const STATUSES = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * TaskForm — create a new task OR replace the image on an existing one.
 *
 * Props:
 *   mode        "create" | "edit"          (default "create")
 *   task        existing task object       (required in "edit" mode)
 *   teams       [{ teamId, name }]         for the team selector
 *   employees   [{ userId, name, teamId }] for the assignee selector
 *   onSuccess   () => void
 *   onCancel    () => void
 */
export default function TaskForm({
  mode = "create",
  task = null,
  teams = [],
  employees = [],
  onSuccess,
  onCancel,
}) {
  const [form, setForm] = useState({
    title: task?.title || "",
    description: task?.description || "",
    priority: task?.priority || "MEDIUM",
    status: task?.status || "TODO",
    deadline: task?.deadline || "",
    teamId: task?.teamId || "",
    assigneeId: task?.assigneeId || "",
    projectId: task?.projectId || "",
  });

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(task?.imageUrl || null);
  const [imageError, setImageError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const filteredEmployees = form.teamId
    ? employees.filter((e) => e.teamId === form.teamId)
    : employees;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
      // Reset assignee when team changes
      ...(name === "teamId" ? { assigneeId: "" } : {}),
    }));
  };

  const handleImageChange = (e) => {
    setImageError("");
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type)) {
      setImageError("Only JPEG, PNG, GIF, or WebP images are allowed.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setImageError("Image must be smaller than 5 MB.");
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(task?.imageUrl || null);
    setImageError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "create") {
        await createTask(form, imageFile);
      } else {
        // In edit mode this form only handles image replacement
        if (imageFile) {
          await updateTaskImage(task.taskId, imageFile);
        }
      }
      onSuccess?.();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {mode === "create" && (
        <>
          {/* Title */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="Task title"
              className="input"
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Description
            </label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={3}
              placeholder="What needs to be done?"
              className="input resize-none"
            />
          </div>

          {/* Priority + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Priority</label>
              <select name="priority" value={form.priority} onChange={handleChange} className="input">
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
              <select name="status" value={form.status} onChange={handleChange} className="input">
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s.replace("_", " ")}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Deadline */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Deadline</label>
            <input
              type="date"
              name="deadline"
              value={form.deadline}
              onChange={handleChange}
              className="input"
            />
          </div>

          {/* Team */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Team</label>
            <select name="teamId" value={form.teamId} onChange={handleChange} className="input">
              <option value="">Select a team</option>
              {teams.map((t) => (
                <option key={t.teamId} value={t.teamId}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Assignee */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Assignee</label>
            <select name="assigneeId" value={form.assigneeId} onChange={handleChange} className="input">
              <option value="">Select an employee</option>
              {filteredEmployees.map((emp) => (
                <option key={emp.userId} value={emp.userId}>{emp.name}</option>
              ))}
            </select>
          </div>

          {/* Project ID */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Project ID</label>
            <input
              type="text"
              name="projectId"
              value={form.projectId}
              onChange={handleChange}
              placeholder="Project ID"
              className="input"
            />
          </div>
        </>
      )}

      {/* Image upload — shown in both create and edit modes */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {mode === "edit" ? "Replace Image" : "Attach Image"}{" "}
          <span className="text-gray-400 font-normal">(optional, max 5 MB)</span>
        </label>

        {/* Preview */}
        {imagePreview && (
          <div className="relative w-full rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <img
              src={imagePreview}
              alt="Task attachment preview"
              className="w-full max-h-52 object-cover"
            />
            <button
              type="button"
              onClick={clearImage}
              className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-7 h-7 flex items-center justify-center hover:bg-black/70 transition-colors"
              aria-label="Remove image"
            >
              ✕
            </button>
            {mode === "edit" && task?.imageUrl && imagePreview !== task.imageUrl && (
              <span className="absolute bottom-2 left-2 bg-blue-600 text-white text-xs px-2 py-1 rounded">
                New image selected
              </span>
            )}
          </div>
        )}

        {/* Drop zone / file picker */}
        {!imagePreview && (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
          >
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Click to upload or drag and drop
            </p>
            <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
              PNG, JPG, GIF, WebP up to 5MB
            </p>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleImageChange}
          className="hidden"
        />

        {imageError && (
          <p className="text-red-500 text-xs">{imageError}</p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
          <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="btn btn-secondary"
          >
            Cancel
          </button>
        )}
        <button type="submit" disabled={loading} className="btn btn-primary">
          {loading
            ? mode === "create"
              ? "Creating…"
              : "Saving…"
            : mode === "create"
            ? "Create Task"
            : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
