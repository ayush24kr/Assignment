import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { tasksAPI } from '../services/api';
import toast from 'react-hot-toast';

const TaskDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchTask = async () => {
    try {
      const res = await tasksAPI.getById(id);
      setTask(res.data.data.task);
    } catch (err) {
      toast.error('Task not found');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTask(); }, [id]);

  // Poll while pending/running
  useEffect(() => {
    if (!task || (task.status !== 'pending' && task.status !== 'running')) return;
    const interval = setInterval(fetchTask, 3000);
    return () => clearInterval(interval);
  }, [task?.status]);

  const handleRerun = async () => {
    try {
      await tasksAPI.rerun(id);
      toast.success('Task re-queued!');
      fetchTask();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to re-run');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this task?')) return;
    try {
      await tasksAPI.delete(id);
      toast.success('Task deleted');
      navigate('/dashboard');
    } catch (err) {
      toast.error('Failed to delete task');
    }
  };

  const formatDate = (d) => new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  if (loading) return <div className="loading-center"><div className="spinner spinner-lg" /></div>;
  if (!task) return null;

  return (
    <div className="container page">
      <div className="task-detail fade-in">
        <button className="btn btn-ghost" onClick={() => navigate('/dashboard')} style={{ marginBottom: 16 }}>
          ← Back to Dashboard
        </button>

        <div className="task-detail-header">
          <h1>{task.title}</h1>
          <div className="task-meta">
            <span className={`badge badge-${task.status}`}>{task.status}</span>
            <span className="task-card-operation">{task.operation}</span>
            <span>Created {formatDate(task.createdAt)}</span>
          </div>
        </div>

        <div className="task-section">
          <h2>Input Text</h2>
          <div className="task-result">{task.inputText}</div>
        </div>

        {task.result && (
          <div className="task-section">
            <h2>Result</h2>
            <div className="task-result" style={{ borderColor: 'rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.05)' }}>
              {task.result}
            </div>
          </div>
        )}

        {task.errorMessage && (
          <div className="task-section">
            <h2>Error</h2>
            <div className="task-result" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.05)', color: 'var(--error)' }}>
              {task.errorMessage}
            </div>
          </div>
        )}

        {task.logs && task.logs.length > 0 && (
          <div className="task-section">
            <h2>Logs</h2>
            <div className="log-timeline">
              {task.logs.map((log, i) => (
                <div key={i} className={`log-entry ${log.level === 'error' ? 'log-error' : log.level === 'warn' ? 'log-warn' : ''}`}>
                  <div className="log-time">{formatDate(log.timestamp)}</div>
                  <div className="log-message">{log.message}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          {task.status === 'failed' && (
            <button className="btn btn-primary" onClick={handleRerun}>Re-run Task</button>
          )}
          <button className="btn btn-danger" onClick={handleDelete}>Delete Task</button>
        </div>
      </div>
    </div>
  );
};

export default TaskDetailPage;
