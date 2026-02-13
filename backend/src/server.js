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
  res.json({ items: goals });
});

app.post("/api/goals", async (req, res) => {
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";

  if (!title) {
    return res.status(400).json({ error: "Title is required." });
  }

  const goal = {
    id: nextGoalId++,
    title,
    completed: false,
    createdAt: new Date().toISOString(),
  };

  goals.push(goal);
  await saveGoals();
  return res.status(201).json({ item: goal });
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
