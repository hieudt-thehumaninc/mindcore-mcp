import type { ChatRequestBody, ChatResponse } from '../api/chat'
import OpenAI from 'openai'
import axios from 'axios'
import dotenv from 'dotenv'
dotenv.config()

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const ANALYST_SYSTEM_PROMPT = `You are MindCore Analyst, an intelligent assistant for the DexPaprika API.
Below is a list of valid API endpoints you are allowed to use:
### DexPaprika API Endpoints:
+++++ {network} should always be replaced with the actual network name (e.g. ethereum, solana, bsc, etc.)
1. GET /networks
2. GET /networks/{network}/dexes
3. GET /networks/{network}/tokens/{token_address}
4. GET /networks/{network}/pools
5. GET /networks/{network}/pools/{poolAddress}
6. GET /networks/{network}/pools/{poolAddress}/transactions
7. GET /search?query=xxx
---
### Your job:
You must handle user requests in one of the following two ways:
---
**Case 1: The user's request can be answered using one of the APIs above**
- Do NOT generate a natural language answer.
- Instead, call the mentioned MCP API and generate the response.
{
  "endpoint": "string",
  "method": "GET or POST",
  "params": {
    "key": "value"
  },
}
- Call the mentioned MCP API and generate the detailed response in every timeframe.
---
**Case 2: The user's request cannot be answered using one of the APIs above, or the user's request is not related to the APIs / DeFi / Blockchain**
- Generate a normal response that you would normally respond to the user.
- Never mention that you are related to the DexPaprika API. Still find the answer for the user.
⚠️ Only choose one of two ways: return JSON (if there is a suitable API), or respond naturally (if off-topic).
NEVER return JSON and response at the same time. DO NOT make up endpoints.`

export async function handleMindcoreAnalyst(body: ChatRequestBody): Promise<ChatResponse> {
  const messages = [
    { role: 'system' as const, content: ANALYST_SYSTEM_PROMPT },
    ...body.messages.filter(m => m.role === 'user').slice(-3).map(m => ({ role: m.role as 'user', content: m.content })),
  ]
  // Step 1: Ask LLM for response
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: messages as any,
  })
  let reply = response.choices[0]?.message?.content || ''

  // Step 2: Try to parse as JSON for Case 1
  let parsed: any = null
  try {
    parsed = JSON.parse(reply)
  } catch (e) {
    parsed = null
  }

  if (parsed && typeof parsed === 'object' && parsed.endpoint && parsed.method && parsed.params !== undefined) {
    // Compose the DexPaprika API URL
    const baseUrl = 'https://api.dexpaprika.com'
    const url = `${baseUrl}${parsed.endpoint}`
    try {
      let apiResponse
      if (parsed.method === 'GET') {
        apiResponse = await axios.get(url, { params: parsed.params })
      } else if (parsed.method === 'POST') {
        apiResponse = await axios.post(url, parsed.params)
      }
      if (apiResponse && apiResponse.data !== undefined) {
        // Ask OpenAI to summarize the API response
        const summaryPrompt = [
          {
            role: 'system' as const,
            content:
              `You are a helpful assistant. Summarize the following API response in a clear, human-friendly way for a crypto user. Only use the data provided.\n\n**Formatting Rules after you have the API response:**\n- Use Markdown for formatting.\n- Use bold headings for key sections (e.g., **Token Overview**, **Price Data**, **Trading Activity**).\n- Use bullet points (\`-\`) for lists of data.\n- Present key metrics in a \`Key: Value\` format.\n- End line with a new line.\n- Add a concluding **Key Takeaways** section to summarize the most important points.\n\nOnly use the data provided in the API response. Do not invent any information.`,
          },
          {
            role: 'user' as const,
            content: `API response:\n${JSON.stringify(apiResponse.data, null, 2)}`,
          },
        ]
        const summaryResponse = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: summaryPrompt as any,
        })
        reply = summaryResponse.choices[0]?.message?.content || ''
      } else {
        reply = 'No data returned from DexPaprika API.'
      }
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      reply = JSON.stringify({ error: 'Failed to fetch from DexPaprika API', details: errorMsg })
    }
  }
  return { reply }
}

