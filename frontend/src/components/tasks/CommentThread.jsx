import { useState, useEffect, useRef } from "react";
import { tasksService } from "../../services/tasks.service";
import { useAuthStore } from "../../store/auth.store";

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
      <div className="flex flex-col gap-3 animate-pulse">
        {[1, 2].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-200 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-24 bg-gray-200 rounded" />
              <div className="h-3 w-full bg-gray-200 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Comment list */}
      <div className="flex flex-col gap-4 max-h-80 overflow-y-auto pr-1">
        {comments.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">
            No comments yet. Be the first to comment.
          </p>
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
      </div>

      {/* Divider */}
      <div className="border-t border-gray-100" />

      {/* Input form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <div className="flex gap-3">
          {/* Current user avatar */}
          <Avatar name={user?.name || user?.email || "You"} size="sm" />

          <div className="flex-1 flex flex-col gap-2">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add a comment… (⌘+Enter to send)"
              rows={3}
              className="w-full rounded-lg border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />

            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={posting || !content.trim()}
                className="bg-black text-white px-4 py-2 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {posting ? "Posting…" : "Comment"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

function CommentItem({ comment, currentUserId, isManager, onDelete }) {
  const canDelete = isManager || comment.authorId === currentUserId;
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="flex gap-3 group">
      <Avatar name={comment.authorName} size="sm" />

      <div className="flex-1 min-w-0">
        {/* Header row */}
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <span className="text-sm font-medium text-gray-900 truncate">
            {comment.authorName}
          </span>
          <span className="text-xs text-gray-400 shrink-0">
            {formatTime(comment.createdAt)}
          </span>
        </div>

        {/* Content */}
        <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
          {comment.content}
        </p>

        {/* Delete */}
        {canDelete && (
          <div className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {confirmDelete ? (
              <span className="text-xs text-gray-500">
                Delete?{" "}
                <button
                  onClick={() => onDelete(comment.commentId)}
                  className="text-red-500 hover:text-red-600 font-medium"
                >
                  Yes
                </button>
                {" · "}
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="hover:underline"
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Avatar({ name = "?", size = "sm" }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const colors = [
    "bg-blue-100 text-blue-700",
    "bg-purple-100 text-purple-700",
    "bg-teal-100 text-teal-700",
    "bg-amber-100 text-amber-700",
  ];
  const color = colors[name.charCodeAt(0) % colors.length];

  const sizeClass = size === "sm" ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm";

  return (
    <div
      className={`${sizeClass} ${color} rounded-full flex items-center justify-center font-medium shrink-0`}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
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
