import pool from "../database/db.js";

/**
 * GET /api/analytics/overview
 * Returns key groundwater metrics
 */
export async function getOverviewStats(req, res) {
    try {
        const stats = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM stations) AS total_stations,
        (SELECT COUNT(*) FROM stations WHERE station_status = 'active') AS active_stations,
        (SELECT ROUND(AVG(water_level)::numeric, 2) FROM groundwater_readings) AS avg_water_level,
        (SELECT ROUND(MIN(water_level)::numeric, 2) FROM groundwater_readings) AS min_water_level,
        (SELECT ROUND(MAX(water_level)::numeric, 2) FROM groundwater_readings) AS max_water_level
    `);

        res.json(stats.rows[0]);
    } catch (err) {
        console.error("Error fetching overview:", err.message);
        res.status(500).json({ error: "Failed to fetch overview stats" });
    }
}

/**
 * GET /api/analytics/trends
 * Query params: station_id (required), period (daily|monthly|yearly)
 */
export async function getWaterLevelTrends(req, res) {
    try {
        const { station_id, period = "daily" } = req.query;

        if (!station_id) {
            return res.status(400).json({ error: "station_id is required" });
        }

        let dateFormat;
        switch (period) {
            case "monthly":
                dateFormat = "YYYY-MM";
                break;
            case "yearly":
                dateFormat = "YYYY";
                break;
            default:
                dateFormat = "YYYY-MM-DD";
        }

        const result = await pool.query(
            `SELECT
         TO_CHAR(recorded_at, $1) AS period,
         ROUND(AVG(water_level)::numeric, 2) AS avg_level,
         ROUND(MIN(water_level)::numeric, 2) AS min_level,
         ROUND(MAX(water_level)::numeric, 2) AS max_level,
         COUNT(*) AS reading_count
       FROM groundwater_readings
       WHERE station_id = $2
       GROUP BY period
       ORDER BY period DESC
       LIMIT 100`,
            [dateFormat, station_id]
        );

        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching trends:", err.message);
        res.status(500).json({ error: "Failed to fetch trends" });
    }
}

/**
 * GET /api/analytics/districts
 * Returns average water level per district for comparison charts
 */
export async function getDistrictComparison(req, res) {
    try {
        const result = await pool.query(`
            SELECT s.district, s.state,
                   COUNT(DISTINCT s.station_id) AS station_count,
                   ROUND(AVG(r.water_level)::numeric, 2) AS avg_water_level,
                   ROUND(MIN(r.water_level)::numeric, 2) AS min_water_level,
                   ROUND(MAX(r.water_level)::numeric, 2) AS max_water_level
            FROM stations s
            JOIN groundwater_readings r ON r.station_id = s.station_id
            WHERE s.district IS NOT NULL
            GROUP BY s.district, s.state
            ORDER BY avg_water_level ASC
            LIMIT 30
        `);

        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching district comparison:", err.message);
        res.status(500).json({ error: "Failed to fetch district comparison" });
    }
}

/**
 * GET /api/analytics/aquifers
 * Returns distribution of stations by aquifer type
 */
export async function getAquiferDistribution(req, res) {
    try {
        const result = await pool.query(`
            SELECT aquifer_type, COUNT(*) as count
            FROM stations
            WHERE aquifer_type IS NOT NULL
            GROUP BY aquifer_type
            ORDER BY count DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching aquifer distribution:", err.message);
        res.status(500).json({ error: "Failed to fetch aquifer distribution" });
    }
}

/**
 * GET /api/analytics/status-distribution
 * Returns station health status counts
 */
export async function getStatusDistribution(req, res) {
    try {
        const result = await pool.query(`
            SELECT 
                LOWER(station_status) as status, 
                COUNT(*) as count
            FROM stations
            GROUP BY status
        `);
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching status distribution:", err.message);
        res.status(500).json({ error: "Failed to fetch status distribution" });
    }
}

/**
 * GET /api/analytics/depth-correlation
 * Returns data points for well depth vs water level scatter plot
 */
export async function getDepthLevelCorrelation(req, res) {
    try {
        const result = await pool.query(`
            SELECT 
                s.well_depth, 
                ROUND(AVG(r.water_level)::numeric, 2) as avg_water_level
            FROM stations s
            JOIN groundwater_readings r ON s.station_id = r.station_id
            WHERE s.well_depth IS NOT NULL
            GROUP BY s.station_id, s.well_depth
        `);
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching depth correlation:", err.message);
        res.status(500).json({ error: "Failed to fetch depth correlation" });
    }
}

/**
 * GET /api/analytics/seasonal-trends
 * Returns monthly averages grouped by year
 */
export async function getSeasonalTrends(req, res) {
    try {
        const result = await pool.query(`
            SELECT 
                EXTRACT(YEAR FROM recorded_at) as year,
                EXTRACT(MONTH FROM recorded_at) as month,
                ROUND(AVG(water_level)::numeric, 2) as avg_level
            FROM groundwater_readings
            GROUP BY year, month
            ORDER BY year DESC, month ASC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching seasonal trends:", err.message);
        res.status(500).json({ error: "Failed to fetch seasonal trends" });
    }
}

/**
 * GET /api/analytics/district-insights
 * Detailed insights for leaderboard
 */
export async function getDistrictInsights(req, res) {
    try {
        const result = await pool.query(`
            SELECT 
                s.district,
                ROUND(AVG(r.water_level)::numeric, 2) as current_level,
                COUNT(r.reading_id) as reading_count
            FROM stations s
            JOIN groundwater_readings r ON s.station_id = r.station_id
            GROUP BY s.district
            ORDER BY current_level DESC
            LIMIT 5
        `);
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching district insights:", err.message);
        res.status(500).json({ error: "Failed to fetch district insights" });
    }
}
