import 'dotenv/config';
import { migrate } from '../src/database/init.js';
import { pool } from '../src/database/pool.js';

await migrate();
await pool.end();
