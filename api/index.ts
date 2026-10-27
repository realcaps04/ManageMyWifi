/**
 * Single Vercel serverless function for the Express API.
 * vercel.json rewrites all /api/* traffic here.
 */
import { createApp } from "../apps/api/src/app";

export default createApp();
