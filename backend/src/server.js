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
const validStatuses = new Set(["active", "completed"]);
const validSortBy = new Set(["createdat", "duedate", "priority"]);
const validSortOrder = new Set(["asc", "desc"]);

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

function sortGoals(items, query) {
  const sortBy = typeof query.sortBy === "string" ? query.sortBy.trim().toLowerCase() : "createdat";
  const order = typeof query.order === "string" ? query.order.trim().toLowerCase() : "desc";
  const direction = order === "asc" ? 1 : -1;
  const priorityRank = { low: 1, medium: 2, high: 3 };

  const sorted = [...items];
  sorted.sort((a, b) => {
    let left = 0;
    let right = 0;

    if (sortBy === "priority") {
      left = priorityRank[a.priority] || 0;
      right = priorityRank[b.priority] || 0;
    } else if (sortBy === "duedate") {
      left = a.dueDate ? Date.parse(a.dueDate) : Number.POSITIVE_INFINITY;
      right = b.dueDate ? Date.parse(b.dueDate) : Number.POSITIVE_INFINITY;
    } else {
      left = Date.parse(a.createdAt);
      right = Date.parse(b.createdAt);
    }

    if (left === right) {
      return 0;
    }
    return left > right ? direction : -direction;
  });

  return sorted;
}

function paginateGoals(items, query) {
  const requestedPage = Number.parseInt(query.page, 10);
  const requestedPageSize = Number.parseInt(query.pageSize, 10);
  const pageSize = Number.isFinite(requestedPageSize) && requestedPageSize > 0 ? requestedPageSize : 10;
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, totalPages) : 1;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  return {
    items: items.slice(start, end),
    meta: {
      page,
      pageSize,
      totalItems,
      totalPages,
    },
  };
}

function validateListQuery(query) {
  if (query.status !== undefined) {
    const status = String(query.status).trim().toLowerCase();
    if (!validStatuses.has(status)) {
      return "status must be active or completed.";
    }
  }

  if (query.priority !== undefined) {
    const priority = String(query.priority).trim().toLowerCase();
    if (!validPriorities.has(priority)) {
      return "priority must be low, medium, or high.";
    }
  }

  if (query.sortBy !== undefined) {
    const sortBy = String(query.sortBy).trim().toLowerCase();
    if (!validSortBy.has(sortBy)) {
      return "sortBy must be createdAt, dueDate, or priority.";
    }
  }

  if (query.order !== undefined) {
    const order = String(query.order).trim().toLowerCase();
    if (!validSortOrder.has(order)) {
      return "order must be asc or desc.";
    }
  }

  if (query.page !== undefined) {
    const page = Number.parseInt(query.page, 10);
    if (!Number.isFinite(page) || page < 1) {
      return "page must be a positive integer.";
    }
  }

  if (query.pageSize !== undefined) {
    const pageSize = Number.parseInt(query.pageSize, 10);
    if (!Number.isFinite(pageSize) || pageSize < 1 || pageSize > 50) {
      return "pageSize must be between 1 and 50.";
    }
  }

  return null;
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
  const queryError = validateListQuery(req.query);
  if (queryError) {
    return res.status(400).json({ error: queryError });
  }

  const filtered = filterGoals(goals, req.query);
  const sorted = sortGoals(filtered, req.query);
  const { items, meta } = paginateGoals(sorted, req.query);
  return res.json({ items, meta });
});

app.get("/api/goals/stats", (req, res) => {
  const queryError = validateListQuery(req.query);
  if (queryError) {
    return res.status(400).json({ error: queryError });
  }

  const filtered = filterGoals(goals, req.query);
  const items = sortGoals(filtered, req.query);
  const total = items.length;
  const completed = items.filter((goal) => goal.completed).length;
  const active = total - completed;
  const byPriority = {
    low: items.filter((goal) => goal.priority === "low").length,
    medium: items.filter((goal) => goal.priority === "medium").length,
    high: items.filter((goal) => goal.priority === "high").length,
  };

  return res.json({
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

app.patch("/api/goals/actions/complete-all", async (req, res) => {
  let updated = 0;
  for (const goal of goals) {
    if (!goal.completed) {
      goal.completed = true;
      updated += 1;
    }
  }
  await saveGoals();
  return res.json({ updated });
});

app.delete("/api/goals/actions/clear-completed", async (req, res) => {
  const before = goals.length;
  const remaining = goals.filter((goal) => !goal.completed);
  goals.splice(0, goals.length, ...remaining);
  const deleted = before - goals.length;
  await saveGoals();
  return res.json({ deleted });
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
