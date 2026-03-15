import { Router } from "express";
import {
    getOverviewStats,
    getWaterLevelTrends,
    getDistrictComparison,
    getAquiferDistribution,
    getStatusDistribution,
    getDepthLevelCorrelation,
    getSeasonalTrends,
    getDistrictInsights,
} from "../controllers/analyticsController.js";

const router = Router();

// GET /api/analytics/overview  — key metrics (total stations, avg level, etc.)
router.get("/overview", getOverviewStats);

// GET /api/analytics/trends?station_id=...&period=daily|monthly|yearly
router.get("/trends", getWaterLevelTrends);

// GET /api/analytics/districts — avg water level per district for comparison charts
router.get("/districts", getDistrictComparison);

router.get("/aquifers", getAquiferDistribution);
router.get("/status-distribution", getStatusDistribution);
router.get("/depth-correlation", getDepthLevelCorrelation);
router.get("/seasonal-trends", getSeasonalTrends);
router.get("/district-insights", getDistrictInsights);

export default router;
