-- DWLR Groundwater Monitoring System
-- Database Schema for Supabase PostgreSQL

-- ── Enable PostGIS Extension ──
CREATE EXTENSION IF NOT EXISTS postgis;

-- ══════════════════════════════════════
-- 1. Stations Table
-- ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS stations (
  station_id    SERIAL PRIMARY KEY,
  station_code  VARCHAR(50) UNIQUE NOT NULL,
  station_name  VARCHAR(255) NOT NULL,
  latitude      DOUBLE PRECISION NOT NULL,
  longitude     DOUBLE PRECISION NOT NULL,
  district      VARCHAR(150),
  state         VARCHAR(150),
  aquifer_type  VARCHAR(100),
  well_depth    DOUBLE PRECISION,
  station_status VARCHAR(50) DEFAULT 'active',
  geom          GEOMETRY(Point, 4326),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-populate geom from lat/lng
CREATE OR REPLACE FUNCTION update_station_geom()
RETURNS TRIGGER AS $$
BEGIN
  NEW.geom := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_station_geom
  BEFORE INSERT OR UPDATE OF latitude, longitude ON stations
  FOR EACH ROW
  EXECUTE FUNCTION update_station_geom();

-- Spatial index for fast geo queries
CREATE INDEX IF NOT EXISTS idx_stations_geom ON stations USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_stations_state ON stations (state);
CREATE INDEX IF NOT EXISTS idx_stations_district ON stations (district);

-- ══════════════════════════════════════
-- 2. Groundwater Readings Table
-- ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS groundwater_readings (
  reading_id   SERIAL PRIMARY KEY,
  station_id   INTEGER NOT NULL REFERENCES stations(station_id) ON DELETE CASCADE,
  water_level  DOUBLE PRECISION NOT NULL,
  recorded_at  TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_readings_station ON groundwater_readings (station_id);
CREATE INDEX IF NOT EXISTS idx_readings_time ON groundwater_readings (recorded_at DESC);

-- ══════════════════════════════════════
-- 3. Users Table
-- ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════
-- 4. Alerts Table
-- ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS alerts (
  alert_id     SERIAL PRIMARY KEY,
  station_id   INTEGER NOT NULL REFERENCES stations(station_id) ON DELETE CASCADE,
  alert_type   VARCHAR(50) NOT NULL CHECK (alert_type IN ('low_level', 'rapid_depletion')),
  value        DOUBLE PRECISION,
  message      TEXT,
  is_resolved  BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_station ON alerts (station_id);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts (alert_type);
