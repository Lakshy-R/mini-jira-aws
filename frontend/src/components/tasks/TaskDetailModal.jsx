import { useState, useEffect } from "react";
import CommentThread from "./CommentThread";
import { tasksService, updateTaskImage } from "../../services/tasks.service";
import { useAuthStore } from "../../store/auth.store";
import api from "../../services/api";

const STATUSES = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];

const STATUS_LABELS = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  DONE: "Done",
};

const STATUS_COLORS = {
  TODO: "bg-gray-100 text-gray-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  IN_REVIEW: "bg-amber-100 text-amber-700",
  DONE: "bg-green-100 text-green-700",
};

const PRIORITY_COLORS = {
  HIGH: "bg-red-100 text-red-700",
  MEDIUM: "bg-amber-100 text-amber-700",
  LOW: "bg-green-100 text-green-700",
};

/**
 * TaskDetailModal
 * Props:
 *   task       object   — full task from DynamoDB
 *   onClose    fn       — close the modal
 *   onUpdated  fn(task) — called after status or image is updated
 */
export default function TaskDetailModal({ task, onClose, onUpdated }) {
  const { user } = useAuthStore();
  const [currentTask, setCurrentTask] = useState(task);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [presignedImageUrl, setPresignedImageUrl] = useState(currentTask.presignedUrl || null);

  const isManager = user?.role === "manager";
  const userId = user?.sub || user?.userId;
  const isAssignee = userId === currentTask.assigneeId;
  const canChangeStatus = isManager || isAssignee;

  // Fetch presigned URL when modal opens or task image changes
  useEffect(() => {
    if (!currentTask.presignedUrl && currentTask.imageUrl) {
      api.get(`/tasks/${currentTask.taskId}/image-url`)
        .then(res => setPresignedImageUrl(res.data.url))
        .catch(() => setPresignedImageUrl(currentTask.imageUrl)); // fallback
    } else if (currentTask.presignedUrl) {
      setPresignedImageUrl(currentTask.presignedUrl);
    }
  }, [currentTask.imageUrl, currentTask.taskId, currentTask.presignedUrl]);

  const handleStatusChange = async (newStatus) => {
    if (newStatus === currentTask.status) return;
    setStatusUpdating(true);
    try {
      const updated = await tasksService.updateStatus(currentTask.taskId, newStatus);
      const newTask = { ...currentTask, status: newStatus, ...updated };
      setCurrentTask(newTask);
      onUpdated?.(newTask);
    } catch (err) {
      console.error("Status update failed:", err);
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
      const newTask = { ...currentTask, imageUrl: result.imageUrl };
      setCurrentTask(newTask);
      onUpdated?.(newTask);
    } catch (err) {
      console.error("Image update failed:", err);
    } finally {
      setImageUploading(false);
    }
  };

  // Close on backdrop click
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-6 border-b border-gray-100">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-medium text-gray-900 leading-snug">
              {currentTask.title}
            </h2>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[currentTask.priority]}`}>
                {currentTask.priority}
              </span>
              {currentTask.deadline && (
                <span className="text-xs text-gray-400">
                  Due {new Date(currentTask.deadline).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors shrink-0 mt-0.5"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6">
          {/* Image */}
          {(currentTask.imageUrl || currentTask.thumbnailUrl) && (
            <div className="relative rounded-xl overflow-hidden bg-gray-50 group">
              <img
                src={presignedImageUrl || currentTask.thumbnailUrl}
                alt="Task attachment"
                className="w-full max-h-56 object-cover"
              />
              {/* Replace image overlay */}
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
              <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                Description
              </h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {currentTask.description}
              </p>
            </div>
          )}

          {/* Status selector */}
          <div>
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
              Status
            </h3>
            <div className="flex gap-2 flex-wrap">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => canChangeStatus && handleStatusChange(s)}
                  disabled={!canChangeStatus || statusUpdating}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-all
                    ${currentTask.status === s
                      ? STATUS_COLORS[s] + " border-transparent ring-2 ring-offset-1 ring-blue-400"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                    }
                    ${!canChangeStatus ? "cursor-not-allowed opacity-60" : "cursor-pointer"}
                  `}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
            {!canChangeStatus && (
              <p className="text-xs text-gray-400 mt-1">
                Only the assignee or a manager can change the status.
              </p>
            )}
          </div>

          {/* Comments */}
          <div>
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
              Comments
            </h3>
            <CommentThread taskId={currentTask.taskId} />
          </div>
        </div>
      </div>
    </div>
  );
}
