import type { ChatRequestBody, ChatResponse } from '../api/chat'
import OpenAI from 'openai'
import dotenv from 'dotenv'
dotenv.config()

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const TRADER_SYSTEM_PROMPT = `You are Mindcore Trader Copilot, a crypto trading assistant. Your job is to help users swap and transfer tokens easily. When a user wants to swap tokens, encourage them to use clear, natural language. Here are some examples of how users can phrase their swap requests:
- "Swap 0.5 ETH to USDT"
- "I want to swap 100 USDC for ETH"
- "Convert 1 DAI to ETH"
- "Exchange 0.2 ETH for USDC"
When a user wants to transfer tokens, here is how they can phrase their requests:
- "Transfer 0.5 ETH to 0x123abc..."
- "Send 100 USDC to 0x123abc..."
If the user's message is unclear or missing information (amount, token, or recipient address), politely ask for the missing details. For example:
- "How much would you like to swap/transfer?"
- "Which token do you want to send?"
- "What is the recipient's address?"
Always confirm the details before proceeding. You can recognize user intent from any message that mentions swapping, exchanging, converting, sending, or transferring tokens. If the user's message is not related to swapping or transferring tokens, respond naturally.`

function parseSwapIntent(message: string) {
  const swapRegex = /(swap|exchange|convert)\s+(\d+\.?\d*)\s+(\w+)\s+(to|for)\s+(\w+)/i
  const match = message.match(swapRegex)
  if (match) {
    return {
      amount: match[2],
      from: match[3],
      to: match[5],
    }
  }
  return null
}
function parseTransferIntent(message: string) {
  const transferRegex = /(transfer|send)\s+(\d+\.?\d*)\s+(\w+)\s+to\s+(0x[a-fA-F0-9]{40})/i
  const match = message.match(transferRegex)
  if (match) {
    return {
      amount: match[2],
      token: match[3],
      recipient: match[4],
    }
  }
  return null
}

export async function handleMindcoreTraderCopilot(body: ChatRequestBody): Promise<ChatResponse> {
  const lastUserMessage = body.messages.filter(m => m.role === 'user').slice(-1)[0]?.content?.trim() || ''
  let pendingSwap = body.pendingSwap || null
  let pendingTransfer = body.pendingTransfer || null

  // Pending swap flow
  if (pendingSwap) {
    let { amount, from, to } = pendingSwap
    if (!amount && !isNaN(Number(lastUserMessage))) {
      amount = parseFloat(lastUserMessage)
    } else if (!from && /^[a-zA-Z0-9]{2,}$/i.test(lastUserMessage)) {
      from = lastUserMessage.toUpperCase()
    } else if (!to && /^[a-zA-Z0-9]{2,}$/i.test(lastUserMessage)) {
      to = lastUserMessage.toUpperCase()
    }
    const missing = []
    if (!amount) missing.push('amount')
    if (!from) missing.push('from')
    if (!to) missing.push('to')
    if (missing.length > 0) {
      let question = ''
      if (missing.includes('amount')) question = 'How much would you like to swap?'
      else if (missing.includes('from')) question = 'Which token do you want to swap from?'
      else if (missing.includes('to')) question = 'Which token do you want to swap to?'
      return {
        reply: question,
        pendingSwap: { amount, from, to },
      }
    } else {
      return {
        reply: 'swap_intent',
        swap: { amount, from, to },
        message: `You want to swap ${amount} ${from} to ${to}. Please confirm the swap.`,
      }
    }
  }

  // Pending transfer flow
  if (pendingTransfer) {
    let { amount, token, recipient } = pendingTransfer
    if (!amount && !isNaN(Number(lastUserMessage))) {
      amount = parseFloat(lastUserMessage)
    } else if (!token && /^[a-zA-Z0-9]{2,}$/i.test(lastUserMessage)) {
      token = lastUserMessage.toUpperCase()
    } else if (!recipient) {
      if (/^0x[a-fA-F0-9]{40}$/.test(lastUserMessage)) {
        recipient = lastUserMessage
      } else {
        return {
          reply: 'The recipient address format appears to be incorrect. Please provide a valid address (e.g., 0x...).',
          pendingTransfer: { amount, token, recipient: null },
        }
      }
    }
    const missing = []
    if (!amount) missing.push('amount')
    if (!token) missing.push('token')
    if (!recipient) missing.push('recipient')
    if (missing.length > 0) {
      let question = ''
      if (missing.includes('amount')) question = 'How much would you like to transfer?'
      else if (missing.includes('token')) question = 'Which token do you want to transfer?'
      else if (missing.includes('recipient')) question = 'What is the recipient address?'
      return {
        reply: question,
        pendingTransfer: { amount, token, recipient },
      }
    } else {
      return {
        reply: 'transfer_intent',
        transfer: { amount, token, recipient },
        message: `You want to transfer ${amount} ${token} to ${recipient}. Please confirm the transfer.`,
      }
    }
  }

  // Try to parse swap or transfer intent
  const swapIntent = parseSwapIntent(lastUserMessage)
  const transferIntent = parseTransferIntent(lastUserMessage)

  // Swap intent
  if (swapIntent) {
    if (pendingSwap) {
      pendingSwap = {
        amount: swapIntent.amount ?? pendingSwap.amount,
        from: swapIntent.from ?? pendingSwap.from,
        to: swapIntent.to ?? pendingSwap.to,
      }
    } else {
      pendingSwap = { ...swapIntent }
    }
    const missing = []
    if (!pendingSwap.amount) missing.push('amount')
    if (!pendingSwap.from) missing.push('from')
    if (!pendingSwap.to) missing.push('to')
    if (missing.length > 0) {
      let question = ''
      if (missing.includes('amount')) question = 'How much would you like to swap?'
      else if (missing.includes('from')) question = 'Which token do you want to swap from?'
      else if (missing.includes('to')) question = 'Which token do you want to swap to?'
      return {
        reply: question,
        pendingSwap,
      }
    } else {
      return {
        reply: 'swap_intent',
        swap: pendingSwap,
        message: `You want to swap ${pendingSwap.amount} ${pendingSwap.from} to ${pendingSwap.to}. Please confirm the swap.`,
      }
    }
  }

  // Transfer intent
  if (transferIntent) {
    if (transferIntent.recipient && !/^0x[a-fA-F0-9]{40}$/.test(transferIntent.recipient)) {
      return {
        reply: 'The recipient address format appears to be incorrect. Please provide a valid address (e.g., 0x...).',
        pendingTransfer: { amount: transferIntent.amount, token: transferIntent.token, recipient: null },
      }
    }
    pendingTransfer = { ...transferIntent }
    const missing = []
    if (!pendingTransfer.amount) missing.push('amount')
    if (!pendingTransfer.token) missing.push('token')
    if (!pendingTransfer.recipient) missing.push('recipient')
    if (missing.length > 0) {
      let question = ''
      if (missing.includes('amount')) question = 'How much would you like to transfer?'
      else if (missing.includes('token')) question = 'Which token do you want to transfer?'
      else if (missing.includes('recipient')) question = 'What is the recipient address?'
      return {
        reply: question,
        pendingTransfer,
      }
    } else {
      return {
        reply: 'transfer_intent',
        transfer: pendingTransfer,
        message: `You want to transfer ${pendingTransfer.amount} ${pendingTransfer.token} to ${pendingTransfer.recipient}. Please confirm the transfer.`,
      }
    }
  }

  // Fallback to LLM
  const messages = [
    { role: 'system' as const, content: TRADER_SYSTEM_PROMPT },
    ...body.messages.slice(-5).map(m => ({ role: m.role as 'system' | 'user' | 'assistant', content: m.content })),
  ]
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: messages as any,
  })
  const reply = response.choices[0]?.message?.content || 'Sorry, no response.'
  return { reply }
}
