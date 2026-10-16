import { configuration } from '../server/config.js';
import { createApp } from '../server/app.js';
// Vercel: set NODEJS_HELPERS=0; Stripe verifies the original request bytes.
export default createApp(configuration(false));
