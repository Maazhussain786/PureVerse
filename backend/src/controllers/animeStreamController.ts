import { Request, Response } from 'express';
import { fetchAnimeStream } from '../services/consumetService';

export const getAnimeStream = async (req: Request, res: Response) => {
  try {
    const { title, episode, type } = req.query;

    if (!title || !episode) {
      res.status(400).json({ success: false, message: "Missing title or episode" });
      return;
    }

    const epNum = parseInt(episode as string, 10);
    const streamType = (type as 'sub' | 'dub') || 'sub';

    const streamData = await fetchAnimeStream(title as string, epNum, streamType);
    
    res.json(streamData);
  } catch (error: any) {
    console.error('Anime Stream error:', error?.message || error);
    res.status(500).json({ 
      status: "error", 
      message: error?.message || 'Failed to extract anime stream' 
    });
  }
};
