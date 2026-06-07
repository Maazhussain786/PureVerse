import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { Server } from 'socket.io';
import setupSockets from './sockets/roomCoordinator';
import routes from './routes';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Setup API Routes
app.use('/api', routes);

// Setup Sockets
setupSockets(io);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`[AniVerse] API Gateway running on port ${PORT}`);
});
