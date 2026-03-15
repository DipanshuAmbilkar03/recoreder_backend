-- Add unique constraint for deduplicating readings
-- Run this in Supabase SQL Editor

ALTER TABLE groundwater_readings
  ADD CONSTRAINT uq_readings_station_time
  UNIQUE (station_id, recorded_at);
