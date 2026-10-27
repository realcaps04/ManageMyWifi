/**
 * Vercel serverless entry — hosts the Express API at /api/*
 * so the web app can call /api/v1 without a separate server.
 */
import { createApp } from "../apps/api/src/app";

const app = createApp();

export default app;
