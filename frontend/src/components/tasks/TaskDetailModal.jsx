import { useState, useEffect } from "react";
import CommentThread from "./CommentThread";
import { tasksService, updateTaskImage } from "../../services/tasks.service";
import { useAuthStore } from "../../store/auth.store";
import { toast } from "../../store/toast.store";
import api from "../../services/api";

const STATUSES = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];

const STATUS_LABELS = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  DONE: "Done",
};

const STATUS_COLORS = {
  TODO: "bg-gray-100 text-gray-700 border-gray-200",
  IN_PROGRESS: "bg-blue-100 text-blue-700 border-blue-200",
  IN_REVIEW: "bg-amber-100 text-amber-700 border-amber-200",
  DONE: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const PRIORITY_COLORS = {
  HIGH: "bg-red-100 text-red-700",
  MEDIUM: "bg-amber-100 text-amber-700",
  LOW: "bg-green-100 text-green-700",
};

function isOverdue(deadline, status) {
  if (!deadline || status === "DONE") return false;
  return new Date(deadline) < new Date();
}

export default function TaskDetailModal({ task, onClose, onUpdated, onDeleted }) {
  const { user } = useAuthStore();
  const [currentTask, setCurrentTask] = useState(task);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [presignedImageUrl, setPresignedImageUrl] = useState(task.presignedUrl || null);

  const isManager = user?.role === "manager";
  const userId = user?.sub;
  const isAssignee = userId === currentTask.assigneeId;
  const canChangeStatus = isManager || isAssignee;
  const overdue = isOverdue(currentTask.deadline, currentTask.status);

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
      toast.success(`Status updated to ${STATUS_LABELS[newStatus]}`);
    } catch (err) {
      toast.error(err.displayMessage || "Failed to update status");
    } finally {
      setStatusUpdating(false);
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
      toast.success("Image updated successfully");
    } catch (err) {
      toast.error(err.displayMessage || "Failed to update image");
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
      toast.error(err.displayMessage || "Failed to delete task");
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-6 pb-4 border-b border-gray-100">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {currentTask.priority && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${PRIORITY_COLORS[currentTask.priority]}`}>
                  {currentTask.priority}
                </span>
              )}
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${STATUS_COLORS[currentTask.status]}`}>
                {STATUS_LABELS[currentTask.status]}
              </span>
              {overdue && (
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-red-100 text-red-600 border border-red-200">
                  ⚠ Overdue
                </span>
              )}
            </div>
            <h2 className="text-lg font-semibold text-gray-900 leading-snug">
              {currentTask.title}
            </h2>
            {currentTask.deadline && (
              <p className="text-xs text-gray-400 mt-1">
                Due {new Date(currentTask.deadline).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors shrink-0 text-xl leading-none"
            aria-label="Close"
          >✕</button>
        </div>

        <div className="p-6 flex flex-col gap-5 flex-1">

          {/* Image */}
          {(presignedImageUrl || currentTask.imageUrl) && (
            <div className="relative rounded-xl overflow-hidden bg-gray-50 group">
              {presignedImageUrl ? (
                <img
                  src={presignedImageUrl}
                  alt="Task attachment"
                  className="w-full max-h-56 object-cover"
                />
              ) : (
                <div className="w-full h-32 flex items-center justify-center text-gray-300 text-sm">Loading image…</div>
              )}
              <label className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors cursor-pointer">
                <span className="text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 px-3 py-1.5 rounded-lg">
                  {imageUploading ? "Uploading…" : "Replace image"}
                </span>
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
          {currentTask.description && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Description</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{currentTask.description}</p>
            </div>
          )}

          {/* Meta row */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">Team</span>
              <span className="text-gray-700">{currentTask.teamId || '—'}</span>
            </div>
            <div>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">Assignee</span>
              <span className="text-gray-700 truncate block">{currentTask.assigneeId || '—'}</span>
            </div>
          </div>

          {/* Status selector */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Status</h3>
            <div className="flex gap-2 flex-wrap">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => canChangeStatus && handleStatusChange(s)}
                  disabled={!canChangeStatus || statusUpdating}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-all ${
                    currentTask.status === s
                      ? STATUS_COLORS[s] + " ring-2 ring-offset-1 ring-current"
                      : "border-gray-200 text-gray-500 hover:border-gray-300 bg-white"
                  } ${!canChangeStatus ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
            {!canChangeStatus && (
              <p className="text-xs text-gray-400 mt-1.5">Only the assignee or a manager can change status.</p>
            )}
          </div>

          {/* Comments */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Comments</h3>
            <CommentThread taskId={currentTask.taskId} />
          </div>

          {/* Danger zone — manager only */}
          {isManager && (
            <div className="border-t border-red-100 pt-4 mt-2">
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="text-sm text-red-500 hover:text-red-700 font-medium transition-colors"
                >
                  Delete task
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <p className="text-sm text-red-600 font-medium">This cannot be undone.</p>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="text-sm bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {deleting ? "Deleting…" : "Yes, delete"}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
