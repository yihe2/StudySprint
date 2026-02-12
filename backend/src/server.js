import express from "express";

const app = express();
const port = process.env.PORT || 3001;
const goals = [];
let nextGoalId = 1;

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

app.post("/api/goals", (req, res) => {
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
  res.status(201).json({ item: goal });
});

app.patch("/api/goals/:id/toggle", (req, res) => {
  const id = Number(req.params.id);
  const goal = goals.find((item) => item.id === id);

  if (!goal) {
    return res.status(404).json({ error: "Goal not found." });
  }

  goal.completed = !goal.completed;
  return res.json({ item: goal });
});

app.delete("/api/goals/:id", (req, res) => {
  const id = Number(req.params.id);
  const index = goals.findIndex((item) => item.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "Goal not found." });
  }

  goals.splice(index, 1);
  return res.status(204).send();
});

app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
