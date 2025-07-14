import express, { Request, Response } from 'express';
import { createChatHandler, swapHandler, transferHandler } from './index';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(express.json());

// Chat endpoint (framework-agnostic handler)
app.post('/api/chat', createChatHandler());

// Swap endpoint
app.post('/api/swap', async (req: Request, res: Response) => {
  try {
    const result = await swapHandler(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Transfer endpoint
app.post('/api/transfer', async (req: Request, res: Response) => {
  try {
    const result = await transferHandler(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Mindcore MCP Server running on port ${port}`);
}); 