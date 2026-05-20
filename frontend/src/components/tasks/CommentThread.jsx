import { useState, useEffect, useRef } from "react";
import { tasksService } from "../../services/tasks.service";
import { useAuthStore } from "../../store/auth.store";
import {
  Avatar,
  Box,
  Button,
  Divider,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

/**
 * CommentThread
 * Props:
 *   taskId   string   — the task whose comments to show
 */
export default function CommentThread({ taskId }) {
  const { user } = useAuthStore();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const bottomRef = useRef(null);

  const fetchComments = async () => {
    try {
      const data = await tasksService.getComments(taskId);
      setComments(data);
    } catch (err) {
      console.error("Failed to load comments:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [taskId]);

  // Scroll to bottom when new comments arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    setError("");
    setPosting(true);
    try {
      const newComment = await tasksService.postComment(taskId, content.trim());
      setComments((prev) => [...prev, newComment]);
      setContent("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to post comment.");
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (commentId) => {
    try {
      await tasksService.deleteComment(taskId, commentId);
      setComments((prev) => prev.filter((c) => c.commentId !== commentId));
    } catch (err) {
      console.error("Failed to delete comment:", err);
    }
  };

  const handleKeyDown = (e) => {
    // Cmd/Ctrl + Enter submits
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      handleSubmit(e);
    }
  };

  if (loading) {
    return (
      <Stack spacing={2}>
        {[1, 2].map((i) => (
          <Stack direction="row" spacing={2} key={i} alignItems="center">
            <Skeleton variant="circular" width={32} height={32} />
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width={120} />
              <Skeleton variant="text" />
            </Box>
          </Stack>
        ))}
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      <Stack spacing={2} sx={{ maxHeight: 320, overflowY: 'auto', pr: 1 }}>
        {comments.length === 0 ? (
          <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
            No comments yet. Be the first to comment.
          </Typography>
        ) : (
          comments.map((comment) => (
            <CommentItem
              key={comment.commentId}
              comment={comment}
              currentUserId={user?.sub || user?.userId}
              isManager={user?.role === "manager"}
              onDelete={handleDelete}
            />
          ))
        )}
        <div ref={bottomRef} />
      </Stack>

      <Divider />

      <Box component="form" onSubmit={handleSubmit}>
        <Stack direction="row" spacing={2} alignItems="flex-start">
          <Avatar sx={{ width: 32, height: 32 }}>
            {initialsFromName(user?.name || user?.email || "You")}
          </Avatar>

          <Stack spacing={1} sx={{ flex: 1 }}>
            <TextField
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add a comment… (Ctrl+Enter to send)"
              multiline
              rows={3}
              size="small"
            />

            {error && (
              <Typography variant="caption" color="error">
                {error}
              </Typography>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                type="submit"
                variant="contained"
                size="small"
                disabled={posting || !content.trim()}
              >
                {posting ? "Posting…" : "Comment"}
              </Button>
            </Box>
          </Stack>
        </Stack>
      </Box>
    </Stack>
  );
}

function CommentItem({ comment, currentUserId, isManager, onDelete }) {
  const canDelete = isManager || comment.authorId === currentUserId;
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <Stack direction="row" spacing={2} alignItems="flex-start">
      <Avatar sx={{ width: 32, height: 32 }}>
        {initialsFromName(comment.authorName)}
      </Avatar>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="baseline">
          <Typography variant="subtitle2" noWrap>
            {comment.authorName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formatTime(comment.createdAt)}
          </Typography>
        </Stack>

        <Typography variant="body2" color="text.primary" sx={{ whiteSpace: 'pre-wrap' }}>
          {comment.content}
        </Typography>

        {canDelete && (
          <Box sx={{ mt: 0.5 }}>
            {confirmDelete ? (
              <Typography variant="caption" color="text.secondary">
                Delete?{' '}
                <Button size="small" color="error" onClick={() => onDelete(comment.commentId)}>
                  Yes
                </Button>
                <Button size="small" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
              </Typography>
            ) : (
              <Button size="small" color="error" onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            )}
          </Box>
        )}
      </Box>
    </Stack>
  );
}

function initialsFromName(name = "?") {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatTime(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
