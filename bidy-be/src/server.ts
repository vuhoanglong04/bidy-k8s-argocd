import 'reflect-metadata';
import 'dotenv/config';
import http from 'http';
import { Server } from 'socket.io';
import app from './app.js';
import { AppDataSource } from './database/data-source.js';
import { socketCorsConfig } from './config/cors.config.js';
import socketHandlerService from './modules/common/socket-handler.service.js';
import { startCronJob } from './schedulers/index.js';


const PORT = Number(process.env.PORT ?? 3000);

async function bootstrap(): Promise<void> {

  await AppDataSource.initialize();

  const httpServer = http.createServer(app);

  const io = new Server(httpServer, { cors: socketCorsConfig });
  socketHandlerService.socket(io);

  startCronJob();

  httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

bootstrap().catch((error: unknown) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
