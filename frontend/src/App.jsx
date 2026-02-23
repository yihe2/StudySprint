import { useEffect, useRef, useState } from "react";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

function App() {
  const [health, setHealth] = useState("checking");
  const [goals, setGoals] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    completed: 0,
    overdue: 0,
    byPriority: { low: 0, medium: 0, high: 0 },
  });
  const [meta, setMeta] = useState({ page: 1, pageSize: 10, totalItems: 0, totalPages: 1 });
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editingGoalId, setEditingGoalId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPriority, setEditPriority] = useState("medium");
  const [editDueDate, setEditDueDate] = useState("");
  const [importMode, setImportMode] = useState("replace");
  const fileInputRef = useRef(null);
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
    params.set("includeArchived", includeArchived ? "true" : "false");
    params.set("sortBy", sortBy);
    params.set("order", sortOrder);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }

  async function loadGoals(filters = "") {
    const response = await fetch(`${API_BASE}/api/goals${filters}`);
    const data = await response.json();
    setGoals(data.items ?? []);
    const nextMeta = data.meta ?? {
      page,
      pageSize,
      totalItems: (data.items ?? []).length,
      totalPages: 1,
    };
    setMeta(nextMeta);
    setPage((current) => (current === nextMeta.page ? current : nextMeta.page));
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
  }, [filterStatus, filterPriority, includeArchived, query, sortBy, sortOrder, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [filterStatus, filterPriority, includeArchived, query, sortBy, sortOrder, pageSize]);

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

  function isOverdue(goal) {
    if (!goal.dueDate || goal.completed) {
      return false;
    }
    const today = new Date().toISOString().slice(0, 10);
    return goal.dueDate < today;
  }

  function isArchived(goal) {
    return Boolean(goal.archived);
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

  async function handleArchiveGoal(id, archived) {
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/goals/${id}/archive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update archive status.");
      }
      await reloadData();
    } catch (archiveError) {
      setError(archiveError.message);
    }
  }

  async function handleDuplicateTomorrow(id) {
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/goals/${id}/duplicate-tomorrow`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to duplicate goal.");
      }
      await reloadData();
    } catch (duplicateError) {
      setError(duplicateError.message);
    }
  }

  function startEdit(goal) {
    setEditingGoalId(goal.id);
    setEditTitle(goal.title);
    setEditPriority(goal.priority || "medium");
    setEditDueDate(goal.dueDate || "");
    setError("");
  }

  function cancelEdit() {
    setEditingGoalId(null);
    setEditTitle("");
    setEditPriority("medium");
    setEditDueDate("");
  }

  async function handleSaveEdit(id) {
    setError("");
    const cleanTitle = editTitle.trim();
    if (!cleanTitle) {
      setError("Goal title cannot be empty.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/goals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: cleanTitle,
          priority: editPriority,
          dueDate: editDueDate || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update goal.");
      }
      cancelEdit();
      await reloadData();
    } catch (editError) {
      setError(editError.message);
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

  async function handleArchiveCompleted() {
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/goals/actions/archive-completed`, {
        method: "PATCH",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to archive completed goals.");
      }
      await reloadData();
    } catch (bulkError) {
      setError(bulkError.message);
    }
  }

  async function handleExportGoals() {
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/goals/export`);
      if (!response.ok) {
        throw new Error("Failed to export goals.");
      }
      const text = await response.text();
      const blob = new Blob([text], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "studysprint-goals.json";
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(exportError.message);
    }
  }

  async function handleImportFile(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setError("");
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const items = Array.isArray(parsed?.items) ? parsed.items : Array.isArray(parsed) ? parsed : null;
      if (!items) {
        throw new Error("Import file must contain an items array.");
      }

      const response = await fetch(`${API_BASE}/api/goals/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: importMode, items }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to import goals.");
      }
      await reloadData();
    } catch (importError) {
      setError(importError.message);
    } finally {
      event.target.value = "";
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
          Total: <strong>{stats.total}</strong> | Active: <strong>{stats.active}</strong> | Completed: <strong>{stats.completed}</strong> | Overdue:{" "}
          <strong>{stats.overdue || 0}</strong>
        </p>
        <div className="bulk-actions">
          <button type="button" onClick={handleCompleteAll}>
            Complete All Active
          </button>
          <button type="button" className="danger" onClick={handleClearCompleted}>
            Clear Completed
          </button>
          <button type="button" onClick={handleArchiveCompleted}>
            Archive Completed
          </button>
          <button type="button" onClick={handleExportGoals}>
            Export JSON
          </button>
          <select value={importMode} onChange={(e) => setImportMode(e.target.value)}>
            <option value="replace">Import: Replace</option>
            <option value="merge">Import: Merge</option>
          </select>
          <button type="button" onClick={() => fileInputRef.current?.click()}>
            Import JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden-file-input"
            onChange={handleImportFile}
          />
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
            <option value="overdue">Overdue only</option>
            <option value="archived">Archived only</option>
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
          <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
            <option value={5}>5 per page</option>
            <option value={10}>10 per page</option>
            <option value={20}>20 per page</option>
          </select>
          <label className="checkbox-inline">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
            />
            Show archived
          </label>
        </div>
        {goals.length === 0 ? (
          <p className="muted">No goals yet.</p>
        ) : (
          <ul className="goal-list">
            {goals.map((goal) => (
              <li key={goal.id} className="goal-item">
                <div className="goal-content">
                  {editingGoalId === goal.id ? (
                    <div className="edit-form">
                      <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                      <select value={editPriority} onChange={(e) => setEditPriority(e.target.value)}>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                      <input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} />
                    </div>
                  ) : (
                    <>
                      <span className={goal.completed ? "goal-title done" : "goal-title"}>{goal.title}</span>
                      <p className="goal-meta">
                        <span className={`pill ${goal.priority || "medium"}`}>{goal.priority || "medium"}</span>
                        <span>{formatDueDate(goal.dueDate)}</span>
                        {isOverdue(goal) ? <span className="pill overdue">Overdue</span> : null}
                        {isArchived(goal) ? <span className="pill archived">Archived</span> : null}
                      </p>
                    </>
                  )}
                </div>
                <div className="goal-actions">
                  {editingGoalId === goal.id ? (
                    <>
                      <button type="button" onClick={() => handleSaveEdit(goal.id)}>
                        Save
                      </button>
                      <button type="button" onClick={cancelEdit}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => startEdit(goal)}>
                        Edit
                      </button>
                      <button type="button" onClick={() => handleDuplicateTomorrow(goal.id)}>
                        Tomorrow
                      </button>
                      <button type="button" onClick={() => handleArchiveGoal(goal.id, !isArchived(goal))}>
                        {isArchived(goal) ? "Unarchive" : "Archive"}
                      </button>
                      <button type="button" onClick={() => handleToggleGoal(goal.id)}>
                        {goal.completed ? "Undo" : "Done"}
                      </button>
                      <button type="button" className="danger" onClick={() => handleDeleteGoal(goal.id)}>
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="pagination">
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            Previous
          </button>
          <span className="page-label">
            Page {meta.page} of {meta.totalPages} ({meta.totalItems} items)
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
            disabled={page >= meta.totalPages}
          >
            Next
          </button>
        </div>
      </section>
    </main>
  );
}

export default App;
