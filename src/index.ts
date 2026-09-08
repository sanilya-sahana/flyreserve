/**
 * FlyReserve server entry point.
 */

import { createApp } from './app.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;

const app = createApp();

app.listen(PORT, () => {
  console.info(`FlyReserve server listening on port ${PORT}`);
});
