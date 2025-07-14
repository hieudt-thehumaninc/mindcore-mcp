import { handleMindcoreAnalyst } from '../chat/mindcore-analyst'
import { handleMindcoreTraderCopilot } from '../chat/mindcore-trader-copilot'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequestBody {
  messages: ChatMessage[];
  agentId?: number;
  pendingSwap?: any;
  pendingTransfer?: any;
}

export interface ChatResponse {
  reply: string;
  [key: string]: any;
}

/**
 * Framework-agnostic chat handler. Pass in the request body, get the response.
 */
export async function chatHandler(body: ChatRequestBody): Promise<ChatResponse> {
  switch (body.agentId) {
    case 1:
      return await handleMindcoreAnalyst(body)
    case 2:
      return await handleMindcoreTraderCopilot(body)
    default:
      return await handleMindcoreAnalyst(body)
  }
}

/**
 * Example: createChatHandler for Express/h3/Fastify integration
 * Usage: app.post('/api/chat', async (req, res) => res.json(await chatHandler(req.body)))
 */
export function createChatHandler() {
  return async (req: any, res: any) => {
    const body = req.body || (await req.json?.())
    const result = await chatHandler(body)
    if (res) {
      res.json ? res.json(result) : res.end(JSON.stringify(result))
    } else {
      return result
    }
  }
}
