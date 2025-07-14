import Web3 from 'web3';

interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
interface ChatRequestBody {
    messages: ChatMessage[];
    agentId?: number;
    pendingSwap?: any;
    pendingTransfer?: any;
}
interface ChatResponse {
    reply: string;
    [key: string]: any;
}
/**
 * Framework-agnostic chat handler. Pass in the request body, get the response.
 */
declare function chatHandler(body: ChatRequestBody): Promise<ChatResponse>;
/**
 * Example: createChatHandler for Express/h3/Fastify integration
 * Usage: app.post('/api/chat', async (req, res) => res.json(await chatHandler(req.body)))
 */
declare function createChatHandler(): (req: any, res: any) => Promise<ChatResponse | undefined>;

declare function handleMindcoreAnalyst(body: ChatRequestBody): Promise<ChatResponse>;

declare function handleMindcoreTraderCopilot(body: ChatRequestBody): Promise<ChatResponse>;

interface SwapRequest {
    from: string;
    to: string;
    amount: string;
    userAddress: string;
    slippage?: number;
}
interface SwapResponse {
    to?: string;
    data?: string;
    value?: string;
    approvalRequired?: boolean;
    approval?: {
        to: string;
        data: string;
        value: string;
    };
    message?: string;
    error?: string;
}
declare function swapHandler(body: SwapRequest): Promise<SwapResponse>;
declare function createSwapHandler(): (req: any, res: any) => Promise<SwapResponse | undefined>;

interface TransferRequest {
    token: string;
    amount: string;
    recipient: string;
    userAddress: string;
}
interface TransferResponse {
    to?: string;
    data?: string;
    value?: string;
    error?: string;
}
declare function transferHandler(body: TransferRequest): Promise<TransferResponse>;
declare function createTransferHandler(): (req: any, res: any) => Promise<TransferResponse | undefined>;

declare function getTokenMeta(symbolOrAddress: string, web3: Web3): Promise<{
    address: string;
    symbol: string;
    decimals: number;
} | {
    address: string;
    symbol: void | [] | (unknown[] & []);
    decimals: number;
} | null>;

export { type ChatMessage, type ChatRequestBody, type ChatResponse, type SwapRequest, type SwapResponse, type TransferRequest, type TransferResponse, chatHandler, createChatHandler, createSwapHandler, createTransferHandler, getTokenMeta, handleMindcoreAnalyst, handleMindcoreTraderCopilot, swapHandler, transferHandler };
