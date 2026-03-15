import { Router } from "express";
import pool from "../database/db.js";

const router = Router();

// GET /api/alerts — list all active alerts
router.get("/", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT a.*, s.station_name, s.district, s.state
       FROM alerts a
       JOIN stations s ON a.station_id = s.station_id
       WHERE a.is_resolved = false
       ORDER BY a.created_at DESC
       LIMIT 100`
        );
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching alerts:", err.message);
        res.status(500).json({ error: "Failed to fetch alerts" });
    }
});

export default router;
