import pool from "../database/db.js";

/**
 * Check for stations with critically low water levels
 * and create alerts if thresholds are breached.
 */
export async function checkLowWaterLevels(thresholdMeters = 5.0) {
    try {
        const result = await pool.query(
            `SELECT s.station_id, s.station_name, s.district, s.state,
              r.water_level, r.recorded_at
       FROM stations s
       JOIN LATERAL (
         SELECT water_level, recorded_at
         FROM groundwater_readings
         WHERE station_id = s.station_id
         ORDER BY recorded_at DESC
         LIMIT 1
       ) r ON true
       WHERE r.water_level < $1`,
            [thresholdMeters]
        );

        for (const row of result.rows) {
            await pool.query(
                `INSERT INTO alerts (station_id, alert_type, value, message)
         VALUES ($1, 'low_level', $2, $3)
         ON CONFLICT DO NOTHING`,
                [
                    row.station_id,
                    row.water_level,
                    `Low water level (${row.water_level}m) at ${row.station_name}, ${row.district}`,
                ]
            );
        }

        console.log(`🚨 Low-level check: ${result.rows.length} stations flagged`);
        return result.rows;
    } catch (err) {
        console.error("Alert service error:", err.message);
        throw err;
    }
}
