import { useState, useEffect } from "react";
import CommentThread from "./CommentThread";
import { tasksService, updateTaskImage } from "../../services/tasks.service";
import { useAuthStore } from "../../store/auth.store";
import api from "../../services/api";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Typography,
} from "@mui/material";

const STATUSES = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];

const STATUS_LABELS = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  DONE: "Done",
};


/**
 * TaskDetailModal
 * Props:
 *   task       object   — full task from DynamoDB
 *   onClose    fn       — close the modal
 *   onUpdated  fn(task) — called after status or image is updated
 */
export default function TaskDetailModal({ task, onClose, onUpdated, onError }) {
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
      onError?.('Failed to update task status.');
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
      onError?.('Failed to update task image.');
    } finally {
      setImageUploading(false);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack spacing={1}>
          <Typography variant="h6" fontWeight={700}>
            {currentTask.title}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Chip label={currentTask.priority} size="small" color="secondary" />
            {currentTask.deadline && (
              <Typography variant="caption" color="text.secondary">
                Due {new Date(currentTask.deadline).toLocaleDateString()}
              </Typography>
            )}
          </Stack>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3}>
          {(currentTask.imageUrl || currentTask.thumbnailUrl) && (
            <Box sx={{ position: 'relative' }}>
              <Box
                component="img"
                src={presignedImageUrl || currentTask.thumbnailUrl}
                alt="Task attachment"
                sx={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 2 }}
              />
              <Button
                component="label"
                variant="contained"
                size="small"
                sx={{ position: 'absolute', bottom: 12, right: 12 }}
                disabled={imageUploading}
              >
                {imageUploading ? 'Uploading…' : 'Replace image'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handleImageChange}
                  disabled={imageUploading}
                  hidden
                />
              </Button>
            </Box>
          )}

          {currentTask.description && (
            <Box>
              <Typography variant="overline" color="text.secondary">
                Description
              </Typography>
              <Typography variant="body2" color="text.primary" sx={{ whiteSpace: 'pre-wrap' }}>
                {currentTask.description}
              </Typography>
            </Box>
          )}

          <Box>
            <Typography variant="overline" color="text.secondary">
              Status
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>
              {STATUSES.map((s) => (
                <Button
                  key={s}
                  onClick={() => canChangeStatus && handleStatusChange(s)}
                  disabled={!canChangeStatus || statusUpdating}
                  variant={currentTask.status === s ? 'contained' : 'outlined'}
                  size="small"
                >
                  {STATUS_LABELS[s]}
                </Button>
              ))}
            </Stack>
            {!canChangeStatus && (
              <Typography variant="caption" color="text.secondary">
                Only the assignee or a manager can change the status.
              </Typography>
            )}
          </Box>

          <Divider />

          <Box>
            <Typography variant="overline" color="text.secondary">
              Comments
            </Typography>
            <CommentThread taskId={currentTask.taskId} />
          </Box>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
