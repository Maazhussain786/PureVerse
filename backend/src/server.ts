import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import { Server } from 'socket.io';
import setupSockets from './sockets/roomCoordinator';
import routes from './routes';

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

// Image proxy for CDNs that block hotlinking (e.g. MyAnimeList)
app.get('/api/proxy/image', async (req, res) => {
  const imageUrl = req.query.url as string;
  if (!imageUrl) {
    res.status(400).send('Missing url parameter');
    return;
  }

  // Only allow whitelisted domains
  const allowed = ['cdn.myanimelist.net', 'image.tmdb.org', 'img.youtube.com'];
  try {
    const url = new URL(imageUrl);
    if (!allowed.some(d => url.hostname.endsWith(d))) {
      res.status(403).send('Domain not allowed');
      return;
    }
  } catch {
    res.status(400).send('Invalid URL');
    return;
  }

  try {
    const { default: axios } = await import('axios');
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 8000,
      headers: { 'Referer': '' },
    });
    const contentType = String(response.headers['content-type'] || 'image/jpeg');
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=86400'); // Cache 24h
    res.send(response.data);
  } catch {
    res.status(502).send('Failed to fetch image');
  }
});

// Setup Sockets
setupSockets(io);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`[AniVerse] API Gateway running on port ${PORT}`);
});
