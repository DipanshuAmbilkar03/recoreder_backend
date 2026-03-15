import pg from "pg";
import dns from "dns";

// Force IPv4 definition to prevent EACCES IPv6 network errors connecting to Supabase
dns.setDefaultResultOrder("ipv4first");

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
    },
});

// Test connection on startup
pool.query("SELECT NOW()")
    .then((res) => {
        console.log("✅ Database connected:", res.rows[0].now);
    })
    .catch((err) => {
        console.error("❌ Database connection failed:", err.message);
    });

export default pool;
