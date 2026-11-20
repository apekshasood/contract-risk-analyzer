// middleware/requireUser.js
// Every protected route needs "Authorization: Bearer <supabase access token>".
// On success req.user = { id, email, ... }.
import { getUserFromToken } from '../lib/supabase.js';

export async function requireUser(req, res, next) {
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ error: 'Please sign in' });
    }
    try {
        const user = await getUserFromToken(token);
        if (!user) return res.status(401).json({ error: 'Session expired. Please sign in again.' });
        req.user = user;
        next();
    } catch (err) {
        next(err);
    }
}

export default requireUser;
