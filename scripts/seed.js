import 'dotenv/config';
import { seed } from '../src/database/init.js';
import { pool } from '../src/database/pool.js';

await seed();
await pool.end();
