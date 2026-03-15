import pool from "../database/db.js";

/**
 * GET /api/stations
 * Query params: state, district, aquifer_type, status, page, limit
 */
export async function getAllStations(req, res) {
    try {
        const { state, district, aquifer_type, status, page = 0, limit = 50 } = req.query;

        let query = `
            SELECT s.*, 
            (SELECT water_level FROM groundwater_readings r WHERE r.station_id = s.station_id ORDER BY recorded_at DESC LIMIT 1) as latest_water_level,
            (SELECT recorded_at FROM groundwater_readings r WHERE r.station_id = s.station_id ORDER BY recorded_at DESC LIMIT 1) as latest_reading_date
            FROM stations s 
            WHERE 1=1
        `;
        const params = [];
        let idx = 1;

        if (state) {
            query += ` AND s.state ILIKE $${idx++}`;
            params.push(`%${state}%`);
        }
        if (district) {
            query += ` AND s.district ILIKE $${idx++}`;
            params.push(`%${district}%`);
        }
        if (aquifer_type) {
            query += ` AND s.aquifer_type ILIKE $${idx++}`;
            params.push(`%${aquifer_type}%`);
        }
        if (status) {
            query += ` AND s.station_status = $${idx++}`;
            params.push(status);
        }

        query += ` ORDER BY s.station_name ASC LIMIT $${idx++} OFFSET $${idx++}`;
        params.push(parseInt(limit), parseInt(page) * parseInt(limit));

        const result = await pool.query(query, params);

        res.json({
            data: result.rows,
            count: result.rowCount,
            page: parseInt(page),
            limit: parseInt(limit),
        });
    } catch (err) {
        console.error("Error fetching stations:", err.message);
        res.status(500).json({ error: "Failed to fetch stations" });
    }
}

/**
 * GET /api/stations/:id
 * Returns station details + recent readings
 */
export async function getStationById(req, res) {
    try {
        const { id } = req.params;

        const stationResult = await pool.query(
            "SELECT * FROM stations WHERE station_id = $1",
            [id]
        );

        if (stationResult.rows.length === 0) {
            return res.status(404).json({ error: "Station not found" });
        }

        const readingsResult = await pool.query(
            `SELECT water_level, recorded_at
       FROM groundwater_readings
       WHERE station_id = $1
       ORDER BY recorded_at DESC
       LIMIT 50`,
            [id]
        );

        res.json({
            station: stationResult.rows[0],
            readings: readingsResult.rows,
        });
    } catch (err) {
        console.error("Error fetching station:", err.message);
        res.status(500).json({ error: "Failed to fetch station" });
    }
}
