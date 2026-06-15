import pool from "../database/db.js";

/**
 * Process raw WRIS API records and insert into database.
 * Handles both station upserts and reading inserts.
 *
 * WRIS record shape:
 *  stationCode, stationName, latitude, longitude, state, district,
 *  dataValue (water level), dataTime, wellDepth, wellAquiferType,
 *  stationStatus, unit, stationType, agencyName, tehsil, ...
 */
export async function syncRecordsToDatabase(records) {
    if (!records || records.length === 0) {
        console.log("⚠️  No records to sync");
        return { stationsUpserted: 0, readingsInserted: 0 };
    }

    let stationsUpserted = 0;
    let readingsInserted = 0;

    // Group records by station code (many readings per station)
    const stationMap = new Map();
    for (const rec of records) {
        if (!rec.stationCode) continue;
        if (!stationMap.has(rec.stationCode)) {
            stationMap.set(rec.stationCode, {
                station: rec,
                readings: [],
            });
        }
        stationMap.get(rec.stationCode).readings.push(rec);
    }

    console.log(`🔄 Syncing ${stationMap.size} stations, ${records.length} readings...`);

    // 1. Upsert stations
    for (const [code, { station }] of stationMap) {
        try {
            await pool.query(
                `INSERT INTO stations (station_code, station_name, latitude, longitude, district, state, aquifer_type, well_depth, station_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (station_code) DO UPDATE SET
           station_name = EXCLUDED.station_name,
           latitude = EXCLUDED.latitude,
           longitude = EXCLUDED.longitude,
           district = EXCLUDED.district,
           state = EXCLUDED.state,
           aquifer_type = EXCLUDED.aquifer_type,
           well_depth = EXCLUDED.well_depth,
           station_status = EXCLUDED.station_status,
           updated_at = NOW()`,
                [
                    station.stationCode,
                    station.stationName,
                    station.latitude,
                    station.longitude,
                    station.district,
                    station.state,
                    station.wellAquiferType || null,
                    station.wellDepth || null,
                    station.stationStatus || "Active",
                ]
            );
            stationsUpserted++;
        } catch (err) {
            console.error(`  Station upsert error [${code}]:`, err.message);
        }
    }

    // 2. Insert readings in bulk (skip duplicates)
    for (const [code, { readings }] of stationMap) {
        // Get the station_id for this code
        const stationResult = await pool.query(
            "SELECT station_id FROM stations WHERE station_code = $1",
            [code]
        );

        if (stationResult.rows.length === 0) continue;
        const stationId = stationResult.rows[0].station_id;

        const validReadings = readings.filter(r => r.dataValue != null && r.dataTime);
        if (validReadings.length === 0) continue;

        console.log(`   📈 Inserting ${validReadings.length} readings for station ${code}...`);

        // Batch size (optional, but 1000 is usually fine for one query)
        const batchSize = 500;
        for (let i = 0; i < validReadings.length; i += batchSize) {
            const batch = validReadings.slice(i, i + batchSize);
            const values = [];
            const placeholders = [];
            
            batch.forEach((rec, idx) => {
                const baseId = idx * 3;
                placeholders.push(`($${baseId + 1}, $${baseId + 2}, $${baseId + 3})`);
                values.push(stationId, rec.dataValue, rec.dataTime);
            });

            const query = `
                INSERT INTO groundwater_readings (station_id, water_level, recorded_at)
                VALUES ${placeholders.join(", ")}
                ON CONFLICT DO NOTHING
            `;

            try {
                const result = await pool.query(query, values);
                readingsInserted += result.rowCount || 0;
            } catch (err) {
                console.error(`  ❌ Bulk reading insert error for ${code}:`, err.message);
            }
        }
    }

    console.log(`✅ Sync complete: ${stationsUpserted} stations, ${readingsInserted} readings`);
    return { stationsUpserted, readingsInserted };
}
