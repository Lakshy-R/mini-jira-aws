import { useEffect, useState } from 'react';
import { tasksService } from '../services/tasks.service';

export default function KanbanPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const data = await tasksService.getTasks();
      setTasks(data);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await tasksService.updateStatus(taskId, newStatus);
      fetchTasks(); // Refresh list
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  if (loading) return <div>Loading tasks...</div>;

  const statuses = ['TODO', 'IN_PROGRESS', 'DONE'];

  return (
    <div style={{ padding: 20 }}>
      <h2>Kanban Board</h2>
      <div style={{ display: 'flex', gap: 20 }}>
        {statuses.map((status) => (
          <div key={status} style={{ flex: 1, background: '#f4f4f4', padding: 10, borderRadius: 8 }}>
            <h3>{status}</h3>
            {tasks
              .filter((t) => t.status === status)
              .map((task) => (
                <div key={task.taskId} style={{ background: 'white', padding: 10, marginBottom: 10, borderRadius: 4, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                  <h4>{task.title}</h4>
                  <p>{task.description}</p>
                  <select 
                    value={task.status} 
                    onChange={(e) => handleStatusChange(task.taskId, e.target.value)}
                  >
                    {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
