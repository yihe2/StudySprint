import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";

const app = express();
const port = process.env.PORT || 3001;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, "..", "data");
const dataFile = path.join(dataDir, "goals.json");
const goals = [];
let nextGoalId = 1;
const validPriorities = new Set(["low", "medium", "high"]);

function parsePriority(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return validPriorities.has(normalized) ? normalized : null;
}

function parseDueDate(value) {
  if (value == null || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    return null;
  }
  const clean = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(clean) ? clean : null;
}

function filterGoals(items, query) {
  const status = typeof query.status === "string" ? query.status.trim().toLowerCase() : "";
  const priority = typeof query.priority === "string" ? query.priority.trim().toLowerCase() : "";
  const q = typeof query.q === "string" ? query.q.trim().toLowerCase() : "";

  return items.filter((goal) => {
    if (status === "active" && goal.completed) {
      return false;
    }
    if (status === "completed" && !goal.completed) {
      return false;
    }
    if (priority && priority !== "all" && goal.priority !== priority) {
      return false;
    }
    if (q && !goal.title.toLowerCase().includes(q)) {
      return false;
    }
    return true;
  });
}

async function loadGoals() {
  try {
    const raw = await fs.readFile(dataFile, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      goals.splice(0, goals.length, ...parsed);
      const maxId = goals.reduce((max, goal) => Math.max(max, Number(goal.id) || 0), 0);
      nextGoalId = maxId + 1;
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Failed to load goals data:", error);
      return;
    }
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(dataFile, "[]\n", "utf8");
  }
}

async function saveGoals() {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(dataFile, `${JSON.stringify(goals, null, 2)}\n`, "utf8");
}

app.use(express.json());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "studysprint-api", time: new Date().toISOString() });
});

app.get("/api/goals", (req, res) => {
  const items = filterGoals(goals, req.query);
  res.json({ items });
});

app.get("/api/goals/stats", (req, res) => {
  const items = filterGoals(goals, req.query);
  const total = items.length;
  const completed = items.filter((goal) => goal.completed).length;
  const active = total - completed;
  const byPriority = {
    low: items.filter((goal) => goal.priority === "low").length,
    medium: items.filter((goal) => goal.priority === "medium").length,
    high: items.filter((goal) => goal.priority === "high").length,
  };

  res.json({
    total,
    active,
    completed,
    byPriority,
  });
});

app.post("/api/goals", async (req, res) => {
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  const priority = parsePriority(req.body?.priority) || "medium";
  const dueDate = parseDueDate(req.body?.dueDate);

  if (!title) {
    return res.status(400).json({ error: "Title is required." });
  }

  if (req.body?.priority && !parsePriority(req.body.priority)) {
    return res.status(400).json({ error: "Priority must be low, medium, or high." });
  }

  if (req.body?.dueDate && !dueDate) {
    return res.status(400).json({ error: "dueDate must use YYYY-MM-DD format." });
  }

  const goal = {
    id: nextGoalId++,
    title,
    priority,
    dueDate,
    completed: false,
    createdAt: new Date().toISOString(),
  };

  goals.push(goal);
  await saveGoals();
  return res.status(201).json({ item: goal });
});

app.patch("/api/goals/:id", async (req, res) => {
  const id = Number(req.params.id);
  const goal = goals.find((item) => item.id === id);

  if (!goal) {
    return res.status(404).json({ error: "Goal not found." });
  }

  const title = req.body?.title;
  const priority = req.body?.priority;
  const dueDate = req.body?.dueDate;

  if (title !== undefined) {
    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ error: "Title must be a non-empty string." });
    }
    goal.title = title.trim();
  }

  if (priority !== undefined) {
    const parsed = parsePriority(priority);
    if (!parsed) {
      return res.status(400).json({ error: "Priority must be low, medium, or high." });
    }
    goal.priority = parsed;
  }

  if (dueDate !== undefined) {
    const parsed = parseDueDate(dueDate);
    if (dueDate !== null && !parsed) {
      return res.status(400).json({ error: "dueDate must use YYYY-MM-DD format." });
    }
    goal.dueDate = parsed;
  }

  await saveGoals();
  return res.json({ item: goal });
});

app.patch("/api/goals/:id/toggle", async (req, res) => {
  const id = Number(req.params.id);
  const goal = goals.find((item) => item.id === id);

  if (!goal) {
    return res.status(404).json({ error: "Goal not found." });
  }

  goal.completed = !goal.completed;
  await saveGoals();
  return res.json({ item: goal });
});

app.delete("/api/goals/:id", async (req, res) => {
  const id = Number(req.params.id);
  const index = goals.findIndex((item) => item.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "Goal not found." });
  }

  goals.splice(index, 1);
  await saveGoals();
  return res.status(204).send();
});

await loadGoals();
app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
