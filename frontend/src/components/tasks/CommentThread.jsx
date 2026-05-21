import { useState, useEffect, useRef } from 'react';
import { Send, Trash2 } from 'lucide-react';
import { tasksService } from '../../services/tasks.service';
import { useAuthStore } from '../../store/auth.store';
import { Avatar } from '../ui/avatar';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { formatRelativeTime, cn } from '../../lib/utils';

export default function CommentThread({ taskId }) {
  const { user } = useAuthStore();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    tasksService.getComments(taskId)
      .then(setComments)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [taskId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    setError('');
    setPosting(true);
    try {
      const newComment = await tasksService.postComment(taskId, content.trim());
      setComments((prev) => [...prev, newComment]);
      setContent('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to post comment.');
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (commentId) => {
    try {
      await tasksService.deleteComment(taskId, commentId);
      setComments((prev) => prev.filter((c) => c.commentId !== commentId));
    } catch {
      /* silent */
    }
  };

  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSubmit(e);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[0, 1].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="w-7 h-7 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Comment list */}
      <div className="flex flex-col gap-3 max-h-64 overflow-y-auto pr-1">
        {comments.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-sm text-muted-foreground">No comments yet. Start the conversation.</p>
          </div>
        ) : (
          comments.map((comment) => (
            <CommentItem
              key={comment.commentId}
              comment={comment}
              currentUserId={user?.sub || user?.userId}
              isManager={user?.role === 'manager'}
              onDelete={handleDelete}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Divider */}
      <div className="border-t border-white/[0.06]" />

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-3">
        <Avatar name={user?.email || 'You'} size="sm" className="shrink-0 mt-1" />
        <div className="flex-1 space-y-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write a comment… (⌘↵ to send)"
            rows={3}
            className={cn(
              'w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5',
              'text-sm text-foreground placeholder:text-muted-foreground resize-none',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/50',
              'transition-all duration-200'
            )}
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={posting || !content.trim()}
              className="gap-1.5"
            >
              <Send size={13} />
              {posting ? 'Posting…' : 'Comment'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

function CommentItem({ comment, currentUserId, isManager, onDelete }) {
  const canDelete = isManager || comment.authorId === currentUserId;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const authorDisplay = comment.authorName || comment.authorEmail?.split('@')[0] || 'User';

  return (
    <div className="flex gap-3 group">
      <Avatar name={authorDisplay} size="sm" className="shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2 mb-1.5">
          <span className="text-xs font-semibold text-foreground capitalize">{authorDisplay}</span>
          <span className="text-[10px] text-muted-foreground shrink-0">{formatRelativeTime(comment.createdAt)}</span>
        </div>
        <div className="glass rounded-xl px-3 py-2 border border-white/[0.06]">
          <p className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed">{comment.content}</p>
        </div>
        {canDelete && (
          <div className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
            {confirmDelete ? (
              <span className="text-xs text-muted-foreground">
                Delete?{' '}
                <button
                  onClick={() => onDelete(comment.commentId)}
                  className="text-red-400 hover:underline font-medium"
                >
                  Yes
                </button>
                {' · '}
                <button onClick={() => setConfirmDelete(false)} className="hover:underline text-muted-foreground hover:text-foreground">
                  Cancel
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-400 transition-colors"
              >
                <Trash2 size={11} />
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
