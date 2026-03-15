import { Router } from "express";
import {
    getAllStations,
    getStationById,
} from "../controllers/stationController.js";

const router = Router();

// GET /api/stations              — list all stations (with optional filters)
// GET /api/stations?state=...    — filter by state
// GET /api/stations?district=... — filter by district
router.get("/", getAllStations);

// GET /api/stations/:id          — single station detail
router.get("/:id", getStationById);

export default router;
