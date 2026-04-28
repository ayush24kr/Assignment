import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { tasksAPI } from '../services/api';
import toast from 'react-hot-toast';

const OPERATIONS = [
  { value: 'uppercase', label: 'Uppercase' },
  { value: 'lowercase', label: 'Lowercase' },
  { value: 'reverse', label: 'Reverse String' },
  { value: 'word_count', label: 'Word Count' },
];
const FILTERS = ['all', 'pending', 'running', 'success', 'failed'];

const DashboardPage = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', inputText: '', operation: 'uppercase' });
  const navigate = useNavigate();

  const fetchTasks = useCallback(async () => {
    try {
      const params = {};
      if (filter !== 'all') params.status = filter;
      params.limit = 50;
      const res = await tasksAPI.getAll(params);
      setTasks(res.data.data.tasks);
    } catch (err) {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // Poll for status updates every 5s
  useEffect(() => {
    const hasPending = tasks.some((t) => t.status === 'pending' || t.status === 'running');
    if (!hasPending) return;
    const interval = setInterval(fetchTasks, 5000);
    return () => clearInterval(interval);
  }, [tasks, fetchTasks]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await tasksAPI.create(form);
      toast.success('Task created and queued!');
      setShowModal(false);
      setForm({ title: '', inputText: '', operation: 'uppercase' });
      fetchTasks();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create task');
    } finally {
      setCreating(false);
    }
  };

  const stats = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === 'pending').length,
    running: tasks.filter((t) => t.status === 'running').length,
    success: tasks.filter((t) => t.status === 'success').length,
    failed: tasks.filter((t) => t.status === 'failed').length,
  };

  const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="container page">
      <div className="dashboard-header fade-in">
        <h1>Dashboard</h1>
        <button className="btn btn-primary" id="create-task-btn" onClick={() => setShowModal(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Task
        </button>
      </div>

      <div className="dashboard-stats fade-in">
        {[
          { label: 'Total', value: stats.total, color: 'var(--text-primary)' },
          { label: 'Pending', value: stats.pending, color: 'var(--warning)' },
          { label: 'Running', value: stats.running, color: 'var(--info)' },
          { label: 'Success', value: stats.success, color: 'var(--success)' },
          { label: 'Failed', value: stats.failed, color: 'var(--error)' },
        ].map((s) => (
          <div className="stat-card" key={s.label}>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="task-filters">
        {FILTERS.map((f) => (
          <button key={f} className={`filter-btn ${filter === f ? 'active' : ''}`} onClick={() => { setFilter(f); setLoading(true); }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner spinner-lg" /></div>
      ) : tasks.length === 0 ? (
        <div className="empty-state fade-in">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="13" y2="13"/></svg>
          <h3>No tasks yet</h3>
          <p>Create your first task to get started</p>
        </div>
      ) : (
        <div className="task-grid">
          {tasks.map((task, i) => (
            <div key={task._id} className="card task-card fade-in-up" style={{ animationDelay: `${i * 0.05}s` }} onClick={() => navigate(`/tasks/${task._id}`)}>
              <div className="task-card-title">
                <span>{task.title}</span>
                <span className={`badge badge-${task.status}`}>{task.status}</span>
              </div>
              <div className="task-card-text">{task.inputText}</div>
              <div className="task-card-footer">
                <span className="task-card-operation">{task.operation}</span>
                <span>{formatDate(task.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <h2>Create New Task</h2>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label" htmlFor="task-title">Title</label>
                <input id="task-title" className="form-input" type="text" placeholder="My text task" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="task-input">Input Text</label>
                <textarea id="task-input" className="form-input" placeholder="Enter the text you want to process..." value={form.inputText} onChange={(e) => setForm({ ...form, inputText: e.target.value })} required rows={4} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="task-operation">Operation</label>
                <select id="task-operation" className="form-input" value={form.operation} onChange={(e) => setForm({ ...form, operation: e.target.value })}>
                  {OPERATIONS.map((op) => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                  ))}
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? <><div className="spinner" /> Creating...</> : 'Create & Run'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
