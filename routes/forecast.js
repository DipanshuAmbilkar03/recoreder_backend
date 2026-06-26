import { Router } from "express";
import { getForecast } from "../controllers/forecastController.js";

const router = Router();

// GET /api/forecast/:station_id?days=30|60|90
router.get("/:station_id", getForecast);

export default router;
