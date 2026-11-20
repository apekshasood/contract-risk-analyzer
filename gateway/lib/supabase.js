// lib/supabase.js
// Talk to Supabase over its REST APIs with axios (no extra SDK needed).
// - Auth API: check a user's access token.
// - PostgREST (/rest/v1): read/write tables with the service_role key.
//   service_role bypasses RLS, so the gateway must check ownership itself.
import axios from 'axios';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
}

export const db = axios.create({
    baseURL: `${SUPABASE_URL}/rest/v1`,
    headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    timeout: 10_000,
});

// Returns the user ({ id, email, ... }) for a valid access token, or null.
export async function getUserFromToken(token) {
    try {
        const { data } = await axios.get(`${SUPABASE_URL}/auth/v1/user`, {
            headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` },
            timeout: 10_000,
        });
        return data?.id ? data : null;
    } catch (err) {
        if (err.response?.status === 401 || err.response?.status === 403) return null;
        throw err; // Supabase down: let errorHandler answer 502, not "logged out"
    }
}
