import axios from "axios";

const WRIS_BASE = process.env.WRIS_API_BASE;

/**
 * Fetch groundwater data from India WRIS API.
 * The API requires a POST request with parameters in the query string.
 *
 * @param {object} params - Query parameters
 * @returns {Array} Array of station reading objects
 */
export async function fetchGroundwaterData({
    stateName,
    districtName,
    startdate,
    enddate,
    page = 0,
    size = 500,
} = {}) {
    const queryParams = new URLSearchParams({
        agencyName: "CGWB",
        download: "false",
        page: String(page),
        size: String(size),
    });

    if (stateName) queryParams.set("stateName", stateName);
    if (districtName) queryParams.set("districtName", districtName);
    if (startdate) queryParams.set("startdate", startdate);
    if (enddate) queryParams.set("enddate", enddate);

    const url = `${WRIS_BASE}?${queryParams.toString()}`;

    console.log(`📡 Fetching WRIS data: POST ${url}`);

    const response = await axios.post(url, null, { timeout: 30000 });

    if (response.data?.statusCode !== 200) {
        throw new Error(`WRIS API error: ${response.data?.message || "Unknown"}`);
    }

    const records = response.data.data || [];
    console.log(`📦 Received ${records.length} records for ${districtName || "All"}, ${stateName}`);

    return records;
}

/**
 * Fetch data for multiple state/district combinations in sequence.
 * @param {Array<{state: string, districts: string[]}>} stateDistricts - Array of state and its districts
 * @param {string} startdate
 * @param {string} enddate
 * @returns {Array} Combined records from all areas
 */
export async function fetchMultipleRegions(stateDistricts, startdate, enddate) {
    const allRecords = [];

    for (const { state, districts } of stateDistricts) {
        for (const district of districts) {
            if (!district) continue;
            try {
                const records = await fetchGroundwaterData({
                    stateName: state,
                    districtName: district,
                    startdate,
                    enddate,
                    size: 1000,
                });
                allRecords.push(...records);
            } catch (err) {
                // Skip errors like "No data found" silently for clean logs
                if (!err.message.includes("No data")) {
                    console.error(`  ❌ Error fetching ${district}, ${state}: ${err.message}`);
                }
            }
        }
    }

    return allRecords;
}
