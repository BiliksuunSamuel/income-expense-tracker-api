import { Logger } from '@nestjs/common';
import { readdirSync } from 'fs';
import { join } from 'path';

const actors = [];
const actorsPath = join(__dirname, '../actors');
const logger = new Logger('load.services');
readdirSync(actorsPath).forEach((file) => {
  if (!file.endsWith('.js')) return; // Ignore non-JavaScript files

  const module = require(join(actorsPath, file));

  Object.keys(module).forEach((key) => {
    const service = module[key];

    if (typeof service === 'function' && service.name !== 'BaseActor') {
      logger.debug(`Registering actors: ${key}`);
      actors.push(service);
    }
  });
});

logger.debug(`✅ Registered ${actors.length} actors`);

export default actors;
