import pool from "../database/db.js";
import axios from "axios";

/**
 * GET /api/forecast/:station_id
 * Query params: days (default 30, max 120)
 * Returns predicted groundwater levels
 */
export async function getForecast(req, res) {
    const { station_id } = req.params;
    const days = parseInt(req.query.days || "30");

    if (!station_id) {
        return res.status(400).json({ error: "station_id is required" });
    }

    try {
        // 1. Check database cache first (valid for 6 hours)
        const cacheResult = await pool.query(
            `SELECT forecast_data, model_type, mae, data_points_used, generated_at 
             FROM forecast_cache 
             WHERE station_id = $1 AND forecast_days = $2 
             AND generated_at > NOW() - INTERVAL '6 hours'`,
            [station_id, days]
        );

        if (cacheResult.rows.length > 0) {
            const cached = cacheResult.rows[0];
            console.log(`⚡ Cache Hit (DB) for station ${station_id}, ${days} days`);
            return res.json({
                forecast: cached.forecast_data,
                metadata: {
                    station_id: parseInt(station_id),
                    model_type: cached.model_type,
                    mae: cached.mae,
                    data_points_used: cached.data_points_used,
                    generated_at: cached.generated_at,
                    cached: true
                }
            });
        }

        // 2. Call the Python Forecasting Microservice
        const pythonServiceUrl = process.env.FORECAST_SERVICE_URL || "http://127.0.0.1:8000";
        const requestUrl = `${pythonServiceUrl}/predict/${station_id}?days=${days}`;
        console.log(`🤖 Requesting forecast from microservice: ${requestUrl}`);

        try {
            const response = await axios.get(requestUrl, { timeout: 10000 }); // 10s timeout
            const { forecast, metadata } = response.data;

            // 3. Save / Upsert to database cache
            await pool.query(
                `INSERT INTO forecast_cache (station_id, forecast_days, forecast_data, model_type, mae, data_points_used, generated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, NOW())
                 ON CONFLICT (station_id, forecast_days) DO UPDATE SET
                   forecast_data = EXCLUDED.forecast_data,
                   model_type = EXCLUDED.model_type,
                   mae = EXCLUDED.mae,
                   data_points_used = EXCLUDED.data_points_used,
                   generated_at = NOW()`,
                [
                    station_id,
                    days,
                    JSON.stringify(forecast),
                    metadata.model_type,
                    metadata.mae,
                    metadata.data_points_used
                ]
            );

            return res.json({
                forecast,
                metadata: {
                    ...metadata,
                    cached: false
                }
            });
        } catch (err) {
            console.warn(`⚠️ Forecasting microservice error or offline: ${err.message}. Trying stale cache or fallback.`);

            // Try to use stale cache even if it's older than 6 hours
            const staleCacheResult = await pool.query(
                `SELECT forecast_data, model_type, mae, data_points_used, generated_at 
                 FROM forecast_cache 
                 WHERE station_id = $1 AND forecast_days = $2 
                 ORDER BY generated_at DESC LIMIT 1`,
                [station_id, days]
            );

            if (staleCacheResult.rows.length > 0) {
                const cached = staleCacheResult.rows[0];
                console.log(`📂 Stale Cache Fallback for station ${station_id}, ${days} days`);
                return res.json({
                    forecast: cached.forecast_data,
                    metadata: {
                        station_id: parseInt(station_id),
                        model_type: `${cached.model_type} (Stale)`,
                        mae: cached.mae,
                        data_points_used: cached.data_points_used,
                        generated_at: cached.generated_at,
                        cached: true,
                        warning: "Microservice offline. Showing stale cached forecast."
                    }
                });
            }

            // Stale cache not available, run JS fallback linear extrapolation
            console.log(`📉 No cache available. Generating Node.js-side linear fallback forecast.`);
            const fallbackForecast = await generateNodeFallbackForecast(station_id, days);
            return res.json(fallbackForecast);
        }
    } catch (err) {
        console.error("Forecast Controller Error:", err.message);
        res.status(500).json({ error: "Failed to generate forecast" });
    }
}

/**
 * JS local fallback helper for forecasting when Python microservice is down
 */
async function generateNodeFallbackForecast(stationId, days) {
    const readingsResult = await pool.query(
        `SELECT water_level, recorded_at 
         FROM groundwater_readings 
         WHERE station_id = $1 
         ORDER BY recorded_at DESC 
         LIMIT 60`,
        [stationId]
    );

    const readings = readingsResult.rows;
    const forecast = [];
    let modelType = "Node-StaticAverage";
    let dataPointsUsed = readings.length;

    const today = new Date();

    if (readings.length === 0) {
        // No data fallback
        const baseLevel = 8.5;
        for (let i = 1; i <= days; i++) {
            const nextDate = new Date();
            nextDate.setDate(today.getDate() + i);
            forecast.push({
                date: nextDate.toISOString().split("T")[0],
                predicted: baseLevel,
                lower_bound: Math.max(0, baseLevel - 2.5 - (0.05 * i)),
                upper_bound: baseLevel + 2.5 + (0.05 * i)
            });
        }
    } else if (readings.length < 5) {
        // Not enough data for trend, use average
        const avg = readings.reduce((sum, r) => sum + r.water_level, 0) / readings.length;
        const lastReadingDate = new Date(readings[0].recorded_at);
        for (let i = 1; i <= days; i++) {
            const nextDate = new Date(lastReadingDate);
            nextDate.setDate(lastReadingDate.getDate() + i);
            forecast.push({
                date: nextDate.toISOString().split("T")[0],
                predicted: parseFloat(avg.toFixed(2)),
                lower_bound: parseFloat(Math.max(0, avg - 1.5 - (0.04 * i)).toFixed(2)),
                upper_bound: parseFloat((avg + 1.5 + (0.04 * i)).toFixed(2))
            });
        }
    } else {
        // Simple linear trend line (least squares method)
        // Reverse array so it is chronological (index 0 is oldest, last is newest)
        const chron = [...readings].reverse();
        const y = chron.map(r => r.water_level);
        const x = Array.from({ length: y.length }, (_, idx) => idx);

        const n = y.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        for (let i = 0; i < n; i++) {
            sumX += x[i];
            sumY += y[i];
            sumXY += x[i] * y[i];
            sumXX += x[i] * x[i];
        }

        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        
        const lastReadingDate = new Date(readings[0].recorded_at);
        const lastActualVal = readings[0].water_level;

        modelType = "Node-LinearRegression";

        for (let i = 1; i <= days; i++) {
            const nextDate = new Date(lastReadingDate);
            nextDate.setDate(lastReadingDate.getDate() + i);
            
            // Predict based on slope
            let pred = lastActualVal + (slope * i);
            if (pred < 0) pred = 0; // Water level cannot be negative in this context
            
            const uncertainty = 0.5 + (0.05 * i);
            forecast.push({
                date: nextDate.toISOString().split("T")[0],
                predicted: parseFloat(pred.toFixed(2)),
                lower_bound: parseFloat(Math.max(0, pred - uncertainty).toFixed(2)),
                upper_bound: parseFloat((pred + uncertainty).toFixed(2))
            });
        }
    }

    return {
        forecast,
        metadata: {
            station_id: parseInt(stationId),
            model_type: `${modelType} (Fallback)`,
            mae: 0,
            data_points_used: dataPointsUsed,
            warning: "Microservice offline. Showing local algorithmic fallback forecast."
        }
    };
}
