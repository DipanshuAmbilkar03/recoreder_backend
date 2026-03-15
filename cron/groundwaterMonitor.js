import cron from "node-cron";
import { fetchMultipleRegions } from "../services/wrisService.js";
import { syncRecordsToDatabase } from "../services/syncService.js";
import { checkLowWaterLevels } from "../services/alertService.js";

export function startGroundwaterMonitor() {
    cron.schedule("0 */6 * * *", async () => {
        console.log("Running scheduled groundwater data sync...");

        try {
            // Calculate date range: last 7 days
            const endDate = new Date().toISOString().split("T")[0];
            const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0];

            const stateDistricts = [
                { state: "Maharashtra", districts: ["Pune", "Nagpur", "Nashik", "Thane"] },
                { state: "Rajasthan", districts: ["Jaipur", "Jodhpur", "Udaipur", "Bikaner"] },
                { state: "Gujarat", districts: ["Ahmedabad", "Surat", "Rajkot", "Vadodara"] }
                // Hardcoded short list to prevent cron timeouts, can be expanded
            ];

            const records = await fetchMultipleRegions(stateDistricts, startDate, endDate);
            const result = await syncRecordsToDatabase(records);

            console.log(`Cron sync: ${result.stationsUpserted} stations, ${result.readingsInserted} readings`);

            await checkLowWaterLevels();
        } catch (err) {
            console.error(" Cron job failed:", err.message);
        }
    });

    console.log("🕐 Groundwater monitor cron job scheduled (every 6 hours)");
}
