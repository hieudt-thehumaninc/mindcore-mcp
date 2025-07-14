# Mindcore MCP Server

MCP (Model Context Protocol) server for onchain chat, DeFi operations, and AI model integration.

## Overview

This library provides a framework for AI-powered chat and DeFi operations (swap, transfer) via MCP-compliant tools. It is designed for seamless integration with AI models and LLM tool providers.

---

## Features

- **AI Chat Agents**: Analyst and Trader Copilot powered by OpenAI.
- **DeFi Operations**: Swap tokens (Uniswap), transfer ETH/ERC20.
- **Intent Parsing**: Natural language understanding for DeFi actions.
- **MCP Tool Manifest**: Ready for LLM/AI tool integration.
- **Framework Agnostic**: Use with Express, Fastify, h3, or any Node.js backend.

---

## Installation

```sh
npm install mindcore-mcp
```

---

## Usage

### Basic Example

```ts
import { createChatHandler, swapHandler, transferHandler } from 'mindcore-mcp';

// Example: Express.js
app.post('/api/chat', createChatHandler());

// Example: Direct function call
const chatResponse = await chatHandler({
  messages: [{ role: 'user', content: 'Swap 1 ETH to USDC' }],
  agentId: 2
});

const swapResponse = await swapHandler({
  from: 'ETH',
  to: 'USDC',
  amount: '1',
  userAddress: '0xYourAddress'
});
```

---

## Running the Server

You can run the Mindcore MCP Server as a standalone HTTP server:

```sh
npx mindcore-mcp
```

This will start the server on the default port (3000). You can set a custom port with the `PORT` environment variable.

---

## MCP Tools

| Tool      | Description                                 | Example Use Case                |
|-----------|---------------------------------------------|---------------------------------|
| `chat`    | AI-powered chat with intent parsing         | "What is the price of ETH?"     |
| `swap`    | Swap tokens via Uniswap                     | "Swap 1 ETH to USDC"            |
| `transfer`| Transfer ETH or ERC20 tokens                | "Send 10 USDC to 0xabc..."      |

---

## Environment Variables

| Variable                | Description                        |
|-------------------------|------------------------------------|
| `OPENAI_API_KEY`        | Your OpenAI API key                |
| `RPC_URL`               | Ethereum RPC URL                   |
| `UNISWAP_ROUTER_ADDRESS`| Uniswap router contract address    |
| `WETH_ADDRESS`          | (Optional) WETH contract address   |

Copy `.env.example` to `.env` and fill in your values.

---

## Usage with LLM Tools

The Mindcore MCP Server exposes the following MCP-compliant tools for LLMs:

### `chat`
**Endpoint:** `POST /api/chat`
**Input:**
```json
{
  "messages": [
    { "role": "user", "content": "Swap 1 ETH to USDC" }
  ],
  "agentId": 2
}
```
**Output:**
```json
{
  "reply": "swap_intent",
  "swap": { "amount": "1", "from": "ETH", "to": "USDC" },
  "message": "You want to swap 1 ETH to USDC. Please confirm the swap."
}
```

### `swap`
**Endpoint:** `POST /api/swap`
**Input:**
```json
{
  "from": "ETH",
  "to": "USDC",
  "amount": "1",
  "userAddress": "0xYourAddress"
}
```
**Output:**
Returns transaction data for the swap.

### `transfer`
**Endpoint:** `POST /api/transfer`
**Input:**
```json
{
  "token": "USDC",
  "amount": "10",
  "recipient": "0xRecipientAddress",
  "userAddress": "0xYourAddress"
}
```
**Output:**
Returns transaction data for the transfer.

---

### Registering Tools with LLMs

To use these tools with an LLM, add them to your tool manifest or configuration. Example (pseudo-config):

```json
{
  "mcpServers": {
    "mindcore": {
      "command": "npx",
      "args": [
        "mindcore-mcp"
      ],
      "env": {
        "OPENAI_API_KEY": "your_openai_api_key",
        "RPC_URL": "your_rpc_url",
        "UNISWAP_ROUTER_ADDRESS": "your_router_address"
      }
    }
  }
}
```

---

**Prompting Tips:**
- Instruct the LLM to use the `chat`, `swap`, and `transfer` tools for onchain actions.
- Provide the tool descriptions and example calls in your LLM's tool registry.

---

## Development

```sh
# Build the package
npm run build

# Run tests (if implemented)
npm test
```

---

## License

MIT

---