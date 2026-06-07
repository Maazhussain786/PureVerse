import { Request, Response } from 'express';
import { fetchTrendingMedia } from '../services/metadataService';
import { resolveVidSrcStream } from '../scrapers/vidsrc';

export const getTrending = async (req: Request, res: Response) => {
  try {
    const data = await fetchTrendingMedia();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

export const searchMedia = async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    // Mocked search implementation
    res.json({ success: true, data: [] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

export const getMediaDetails = async (req: Request, res: Response) => {
  try {
    const { type, id } = req.params;
    // Mocked details implementation
    res.json({ success: true, data: { id, type, title: 'Mock Detail' } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

export const getMediaStream = async (req: Request, res: Response) => {
  try {
    const { type, id } = req.params;
    const { season, episode } = req.query;
    const streamData = await resolveVidSrcStream(type, id, season as string, episode as string);
    res.json({ success: true, data: streamData });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};
