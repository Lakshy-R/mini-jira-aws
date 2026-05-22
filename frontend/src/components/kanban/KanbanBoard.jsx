import { DndContext, closestCenter, DragOverlay, pointerWithin } from '@dnd-kit/core';
import { useState } from 'react';
import KanbanColumn from './KanbanColumn';
import TaskCard from './TaskCard';
import { tasksService } from '../../services/tasks.service';
import { toast } from '../../store/toast.store';

const STATUSES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];

export default function KanbanBoard({ tasks, reloadTasks, onTaskClick, loading = false }) {
  const [activeTask, setActiveTask] = useState(null);

  const handleDragStart = ({ active }) => {
    const task = tasks.find((t) => t.taskId === active.id);
    setActiveTask(task || null);
  };

  const handleDragEnd = async ({ active, over }) => {
    setActiveTask(null);
    if (!over) return;

    const taskId = active.id;
    const newStatus = over.id;
    const task = tasks.find((t) => t.taskId === taskId);

    if (!task || task.status === newStatus) return;
    if (!STATUSES.includes(newStatus)) return;

    try {
      await tasksService.updateStatus(taskId, newStatus);
      await reloadTasks();
    } catch (err) {
      toast.error(err.displayMessage || 'Failed to move task');
    }
  };

  return (
    <DndContext
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={tasks.filter((t) => t.status === status)}
            onTaskClick={onTaskClick}
            loading={loading}
          />
        ))}
      </div>

      {/* Drag overlay */}
      <DragOverlay dropAnimation={{ duration: 150, easing: 'ease-out' }}>
        {activeTask ? (
          <div className="rotate-2 scale-[1.03] opacity-95">
            <TaskCard task={activeTask} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
