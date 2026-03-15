import "dotenv/config";
import express from "express";
import cors from "cors";

// ── Route imports ──
import stationRoutes from "./routes/stations.js";
import analyticsRoutes from "./routes/analytics.js";
import alertRoutes from "./routes/alerts.js";
import syncRoutes from "./routes/sync.js";

const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ──
app.use(cors());
app.use(express.json());

// ── Health check ──
app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        service: "DWLR Monitoring API",
        timestamp: new Date().toISOString(),
    });
});

// ── API Routes ──
app.use("/api/stations", stationRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/sync", syncRoutes);

// ── 404 handler ──
app.use((req, res) => {
    res.status(404).json({ error: "Route not found" });
});

// ── Error handler ──
app.use((err, req, res, next) => {
    console.error("Server error:", err.message);
    res.status(500).json({ error: "Internal server error" });
});

// ── Start server ──
app.listen(PORT, () => {
    console.log(`✅ DWLR Backend running on http://localhost:${PORT}`);
    console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
});
