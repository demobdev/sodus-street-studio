import { createServer } from 'node:http';
import { configuration } from './config.js';
import { createApp } from './app.js';
const config = configuration(true);
const server = createServer(createApp(config));
server.listen(4317,'127.0.0.1',()=>console.log(`Igloo API: http://127.0.0.1:4317 (${config.mock?'local simulation':config.mode})`));
