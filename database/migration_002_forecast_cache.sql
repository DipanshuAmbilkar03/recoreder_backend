-- Create forecast_cache table to speed up dashboard loads and prevent hammering the Python microservice
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS forecast_cache (
  id SERIAL PRIMARY KEY,
  station_id INTEGER NOT NULL REFERENCES stations(station_id) ON DELETE CASCADE,
  forecast_days INTEGER NOT NULL,
  forecast_data JSONB NOT NULL,
  model_type VARCHAR(50) NOT NULL,
  mae DOUBLE PRECISION,
  data_points_used INTEGER,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_station_forecast_days UNIQUE (station_id, forecast_days)
);

CREATE INDEX IF NOT EXISTS idx_forecast_cache_station ON forecast_cache (station_id);
