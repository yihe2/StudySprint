import { useEffect, useState } from "react";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

function App() {
  const [health, setHealth] = useState("checking");
  const [goals, setGoals] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, completed: 0, byPriority: { low: 0, medium: 0, high: 0 } });
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [error, setError] = useState("");

  function toQueryString() {
    const params = new URLSearchParams();
    if (filterStatus !== "all") {
      params.set("status", filterStatus);
    }
    if (filterPriority !== "all") {
      params.set("priority", filterPriority);
    }
    if (query.trim()) {
      params.set("q", query.trim());
    }
    params.set("sortBy", sortBy);
    params.set("order", sortOrder);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }

  async function loadGoals(filters = "") {
    const response = await fetch(`${API_BASE}/api/goals${filters}`);
    const data = await response.json();
    setGoals(data.items ?? []);
  }

  async function loadStats(filters = "") {
    const response = await fetch(`${API_BASE}/api/goals/stats${filters}`);
    const data = await response.json();
    setStats(data);
  }

  async function reloadData(filters = toQueryString()) {
    await Promise.all([loadGoals(filters), loadStats(filters)]);
  }

  useEffect(() => {
    async function init() {
      try {
        const response = await fetch(`${API_BASE}/api/health`);
        if (!response.ok) {
          throw new Error("Health check failed.");
        }
        setHealth("online");
        await reloadData("");
      } catch (e) {
        setHealth("offline");
        setError("Backend is not reachable.");
      }
    }

    init();
  }, []);

  useEffect(() => {
    if (health !== "online") {
      return;
    }

    reloadData().catch(() => {
      setError("Failed to load goals.");
    });
  }, [filterStatus, filterPriority, query, sortBy, sortOrder]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError("Please enter a goal title.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: cleanTitle,
          priority,
          dueDate: dueDate || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to add goal.");
      }

      await reloadData();
      setTitle("");
      setPriority("medium");
      setDueDate("");
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  function formatDueDate(value) {
    if (!value) {
      return "No due date";
    }
    return value;
  }

  async function handleToggleGoal(id) {
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/goals/${id}/toggle`, {
        method: "PATCH",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to toggle goal.");
      }
      await reloadData();
    } catch (toggleError) {
      setError(toggleError.message);
    }
  }

  async function handleDeleteGoal(id) {
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/goals/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        let message = "Failed to delete goal.";
        try {
          const data = await response.json();
          message = data.error || message;
        } catch {
          // Keep default message if response has no JSON body.
        }
        throw new Error(message);
      }
      await reloadData();
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  async function handleCompleteAll() {
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/goals/actions/complete-all`, {
        method: "PATCH",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to complete all goals.");
      }
      await reloadData();
    } catch (bulkError) {
      setError(bulkError.message);
    }
  }

  async function handleClearCompleted() {
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/goals/actions/clear-completed`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to clear completed goals.");
      }
      await reloadData();
    } catch (bulkError) {
      setError(bulkError.message);
    }
  }

  return (
    <main className="app">
      <header>
        <h1>StudySprint</h1>
        <p className="status">
          API status: <strong>{health}</strong>
        </p>
      </header>

      <section className="card">
        <h2>Overview</h2>
        <p className="stats">
          Total: <strong>{stats.total}</strong> | Active: <strong>{stats.active}</strong> | Completed: <strong>{stats.completed}</strong>
        </p>
        <div className="bulk-actions">
          <button type="button" onClick={handleCompleteAll}>
            Complete All Active
          </button>
          <button type="button" className="danger" onClick={handleClearCompleted}>
            Clear Completed
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Add Goal</h2>
        <form onSubmit={handleSubmit} className="goal-form">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Read chapter 2 for 45 minutes"
          />
          <select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <button type="submit">Add</button>
        </form>
        {error ? <p className="error">{error}</p> : null}
      </section>

      <section className="card">
        <h2>Goals</h2>
        <div className="filters">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="active">Active only</option>
            <option value="completed">Completed only</option>
          </select>
          <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
            <option value="all">All priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search goals"
          />
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="createdAt">Sort: Created time</option>
            <option value="dueDate">Sort: Due date</option>
            <option value="priority">Sort: Priority</option>
          </select>
          <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
            <option value="desc">Order: Desc</option>
            <option value="asc">Order: Asc</option>
          </select>
        </div>
        {goals.length === 0 ? (
          <p className="muted">No goals yet.</p>
        ) : (
          <ul className="goal-list">
            {goals.map((goal) => (
              <li key={goal.id} className="goal-item">
                <div className="goal-content">
                  <span className={goal.completed ? "goal-title done" : "goal-title"}>{goal.title}</span>
                  <p className="goal-meta">
                    <span className={`pill ${goal.priority || "medium"}`}>{goal.priority || "medium"}</span>
                    <span>{formatDueDate(goal.dueDate)}</span>
                  </p>
                </div>
                <div className="goal-actions">
                  <button type="button" onClick={() => handleToggleGoal(goal.id)}>
                    {goal.completed ? "Undo" : "Done"}
                  </button>
                  <button type="button" className="danger" onClick={() => handleDeleteGoal(goal.id)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

export default App;
