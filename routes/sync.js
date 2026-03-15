import { Router } from "express";
import { fetchGroundwaterData, fetchMultipleRegions } from "../services/wrisService.js";
import { syncRecordsToDatabase } from "../services/syncService.js";

const router = Router();

/**
 * POST /api/sync
 * Fetch data from WRIS API and sync to database.
 *
 * Body (optional):
 *  { stateName, districtName, startdate, enddate, size }
 *
 * Example: POST /api/sync
 *  { "stateName": "Maharashtra", "startdate": "2026-02-01", "enddate": "2026-02-28" }
 */
router.post("/", async (req, res) => {
    try {
        const { stateName, districtName, startdate, enddate, size } = req.body;

        console.log("🔄 Data sync triggered:", { stateName, districtName, startdate, enddate });

        // Fetch from WRIS API
        const records = await fetchGroundwaterData({
            stateName,
            districtName,
            startdate,
            enddate,
            size: size || 500,
        });

        // Insert into database
        const result = await syncRecordsToDatabase(records);

        res.json({
            status: "ok",
            message: "Data sync completed",
            ...result,
            recordsFetched: records.length,
        });
    } catch (err) {
        console.error("Sync error:", err.message);
        res.status(500).json({ error: "Data sync failed", message: err.message });
    }
});

/**
 * POST /api/sync/bulk
 * Sync data for multiple major states at once.
 * Body: { startdate, enddate }
 */
router.post("/bulk", async (req, res) => {
    try {
        const { startdate, enddate } = req.body;

        const stateDistricts = [
            { state: "Maharashtra", districts: ["Pune", "Nagpur", "Nashik", "Thane"] },
            { state: "Rajasthan", districts: ["Jaipur", "Jodhpur", "Udaipur", "Bikaner"] },
            { state: "Gujarat", districts: ["Ahmedabad", "Surat", "Rajkot", "Vadodara"] }
            // This list can be expanded to all districts over time
        ];

        console.log(`🔄 Bulk sync: ${stateDistricts.length} states targeted`);

        const records = await fetchMultipleRegions(stateDistricts, startdate, enddate);
        const result = await syncRecordsToDatabase(records);

        res.json({
            status: "ok",
            message: "Bulk sync completed",
            ...result,
            totalRecordsFetched: records.length,
            statesProcessed: stateDistricts.length,
        });
    } catch (err) {
        console.error("Bulk sync error:", err.message);
        res.status(500).json({ error: "Bulk sync failed", message: err.message });
    }
});

export default router;
