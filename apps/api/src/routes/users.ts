import { Router } from "express";
import { createUserSchema, updateUserSchema } from "@wifi-control/validation";
import { memoryStore } from "../db/memory-store";
import { requireUser } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { randomUUID } from "crypto";

export const usersRouter = Router();

usersRouter.use(requireUser);

usersRouter.get("/", (_req, res) => {
  res.json({ data: [...memoryStore.users.values()] });
});

usersRouter.post("/", validateBody(createUserSchema), (req, res) => {
  const id = randomUUID();
  const now = new Date().toISOString();
  const user = {
    id,
    network_id: memoryStore.network.id,
    full_name: req.body.full_name,
    email: req.body.email ?? null,
    phone: req.body.phone ?? null,
    description: req.body.description ?? null,
    status: "active" as const,
    created_at: now,
    updated_at: now,
  };
  memoryStore.users.set(id, user);
  res.status(201).json(user);
});

usersRouter.patch("/:id", validateBody(updateUserSchema), (req, res) => {
  const user = memoryStore.users.get(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  Object.assign(user, req.body, { updated_at: new Date().toISOString() });
  res.json(user);
});

usersRouter.delete("/:id", (req, res) => {
  if (!memoryStore.users.has(req.params.id)) {
    return res.status(404).json({ error: "User not found" });
  }
  memoryStore.users.delete(req.params.id);
  res.status(204).send();
});
