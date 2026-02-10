import { useEffect, useState } from "react";
import "./App.css";

const API_BASE = "http://localhost:3001";

function App() {
  const [health, setHealth] = useState("checking");
  const [goals, setGoals] = useState([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");

  async function loadGoals() {
    const response = await fetch(`${API_BASE}/api/goals`);
    const data = await response.json();
    setGoals(data.items ?? []);
  }

  useEffect(() => {
    async function init() {
      try {
        const response = await fetch(`${API_BASE}/api/health`);
        if (!response.ok) {
          throw new Error("Health check failed.");
        }
        setHealth("online");
        await loadGoals();
      } catch (e) {
        setHealth("offline");
        setError("Backend is not reachable on http://localhost:3001.");
      }
    }

    init();
  }, []);

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
        body: JSON.stringify({ title: cleanTitle }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to add goal.");
      }

      setGoals((prev) => [...prev, data.item]);
      setTitle("");
    } catch (submitError) {
      setError(submitError.message);
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
        <h2>Add Goal</h2>
        <form onSubmit={handleSubmit} className="goal-form">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Read chapter 2 for 45 minutes"
          />
          <button type="submit">Add</button>
        </form>
        {error ? <p className="error">{error}</p> : null}
      </section>

      <section className="card">
        <h2>Goals</h2>
        {goals.length === 0 ? (
          <p className="muted">No goals yet.</p>
        ) : (
          <ul className="goal-list">
            {goals.map((goal) => (
              <li key={goal.id}>{goal.title}</li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

export default App;
