import 'dotenv/config';
import { assertConfig } from '../src/config.js';
import { deployCommands } from '../src/deployCommands.js';

assertConfig();
await deployCommands();
