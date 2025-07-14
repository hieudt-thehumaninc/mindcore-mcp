"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/server.ts
var import_express = __toESM(require("express"));

// src/chat/mindcore-analyst.ts
var import_openai = __toESM(require("openai"));
var import_axios = __toESM(require("axios"));
var import_dotenv = __toESM(require("dotenv"));
import_dotenv.default.config();
var openai = new import_openai.default({ apiKey: process.env.OPENAI_API_KEY });
var ANALYST_SYSTEM_PROMPT = `You are MindCore Analyst, an intelligent assistant for the DexPaprika API.
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
\u26A0\uFE0F Only choose one of two ways: return JSON (if there is a suitable API), or respond naturally (if off-topic).
NEVER return JSON and response at the same time. DO NOT make up endpoints.`;
function handleMindcoreAnalyst(body) {
  return __async(this, null, function* () {
    var _a, _b, _c, _d;
    const messages = [
      { role: "system", content: ANALYST_SYSTEM_PROMPT },
      ...body.messages.filter((m) => m.role === "user").slice(-3).map((m) => ({ role: m.role, content: m.content }))
    ];
    const response = yield openai.chat.completions.create({
      model: "gpt-4o",
      messages
    });
    let reply = ((_b = (_a = response.choices[0]) == null ? void 0 : _a.message) == null ? void 0 : _b.content) || "";
    let parsed = null;
    try {
      parsed = JSON.parse(reply);
    } catch (e) {
      parsed = null;
    }
    if (parsed && typeof parsed === "object" && parsed.endpoint && parsed.method && parsed.params !== void 0) {
      const baseUrl = "https://api.dexpaprika.com";
      const url = `${baseUrl}${parsed.endpoint}`;
      try {
        let apiResponse;
        if (parsed.method === "GET") {
          apiResponse = yield import_axios.default.get(url, { params: parsed.params });
        } else if (parsed.method === "POST") {
          apiResponse = yield import_axios.default.post(url, parsed.params);
        }
        if (apiResponse && apiResponse.data !== void 0) {
          const summaryPrompt = [
            {
              role: "system",
              content: `You are a helpful assistant. Summarize the following API response in a clear, human-friendly way for a crypto user. Only use the data provided.

**Formatting Rules after you have the API response:**
- Use Markdown for formatting.
- Use bold headings for key sections (e.g., **Token Overview**, **Price Data**, **Trading Activity**).
- Use bullet points (\`-\`) for lists of data.
- Present key metrics in a \`Key: Value\` format.
- End line with a new line.
- Add a concluding **Key Takeaways** section to summarize the most important points.

Only use the data provided in the API response. Do not invent any information.`
            },
            {
              role: "user",
              content: `API response:
${JSON.stringify(apiResponse.data, null, 2)}`
            }
          ];
          const summaryResponse = yield openai.chat.completions.create({
            model: "gpt-4o",
            messages: summaryPrompt
          });
          reply = ((_d = (_c = summaryResponse.choices[0]) == null ? void 0 : _c.message) == null ? void 0 : _d.content) || "";
        } else {
          reply = "No data returned from DexPaprika API.";
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        reply = JSON.stringify({ error: "Failed to fetch from DexPaprika API", details: errorMsg });
      }
    }
    return { reply };
  });
}

// src/chat/mindcore-trader-copilot.ts
var import_openai2 = __toESM(require("openai"));
var import_dotenv2 = __toESM(require("dotenv"));
import_dotenv2.default.config();
var openai2 = new import_openai2.default({ apiKey: process.env.OPENAI_API_KEY });
var TRADER_SYSTEM_PROMPT = `You are Mindcore Trader Copilot, a crypto trading assistant. Your job is to help users swap and transfer tokens easily. When a user wants to swap tokens, encourage them to use clear, natural language. Here are some examples of how users can phrase their swap requests:
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
Always confirm the details before proceeding. You can recognize user intent from any message that mentions swapping, exchanging, converting, sending, or transferring tokens. If the user's message is not related to swapping or transferring tokens, respond naturally.`;
function parseSwapIntent(message) {
  const swapRegex = /(swap|exchange|convert)\s+(\d+\.?\d*)\s+(\w+)\s+(to|for)\s+(\w+)/i;
  const match = message.match(swapRegex);
  if (match) {
    return {
      amount: match[2],
      from: match[3],
      to: match[5]
    };
  }
  return null;
}
function parseTransferIntent(message) {
  const transferRegex = /(transfer|send)\s+(\d+\.?\d*)\s+(\w+)\s+to\s+(0x[a-fA-F0-9]{40})/i;
  const match = message.match(transferRegex);
  if (match) {
    return {
      amount: match[2],
      token: match[3],
      recipient: match[4]
    };
  }
  return null;
}
function handleMindcoreTraderCopilot(body) {
  return __async(this, null, function* () {
    var _a, _b, _c, _d, _e, _f, _g;
    const lastUserMessage = ((_b = (_a = body.messages.filter((m) => m.role === "user").slice(-1)[0]) == null ? void 0 : _a.content) == null ? void 0 : _b.trim()) || "";
    let pendingSwap = body.pendingSwap || null;
    let pendingTransfer = body.pendingTransfer || null;
    if (pendingSwap) {
      let { amount, from, to } = pendingSwap;
      if (!amount && !isNaN(Number(lastUserMessage))) {
        amount = parseFloat(lastUserMessage);
      } else if (!from && /^[a-zA-Z0-9]{2,}$/i.test(lastUserMessage)) {
        from = lastUserMessage.toUpperCase();
      } else if (!to && /^[a-zA-Z0-9]{2,}$/i.test(lastUserMessage)) {
        to = lastUserMessage.toUpperCase();
      }
      const missing = [];
      if (!amount) missing.push("amount");
      if (!from) missing.push("from");
      if (!to) missing.push("to");
      if (missing.length > 0) {
        let question = "";
        if (missing.includes("amount")) question = "How much would you like to swap?";
        else if (missing.includes("from")) question = "Which token do you want to swap from?";
        else if (missing.includes("to")) question = "Which token do you want to swap to?";
        return {
          reply: question,
          pendingSwap: { amount, from, to }
        };
      } else {
        return {
          reply: "swap_intent",
          swap: { amount, from, to },
          message: `You want to swap ${amount} ${from} to ${to}. Please confirm the swap.`
        };
      }
    }
    if (pendingTransfer) {
      let { amount, token, recipient } = pendingTransfer;
      if (!amount && !isNaN(Number(lastUserMessage))) {
        amount = parseFloat(lastUserMessage);
      } else if (!token && /^[a-zA-Z0-9]{2,}$/i.test(lastUserMessage)) {
        token = lastUserMessage.toUpperCase();
      } else if (!recipient) {
        if (/^0x[a-fA-F0-9]{40}$/.test(lastUserMessage)) {
          recipient = lastUserMessage;
        } else {
          return {
            reply: "The recipient address format appears to be incorrect. Please provide a valid address (e.g., 0x...).",
            pendingTransfer: { amount, token, recipient: null }
          };
        }
      }
      const missing = [];
      if (!amount) missing.push("amount");
      if (!token) missing.push("token");
      if (!recipient) missing.push("recipient");
      if (missing.length > 0) {
        let question = "";
        if (missing.includes("amount")) question = "How much would you like to transfer?";
        else if (missing.includes("token")) question = "Which token do you want to transfer?";
        else if (missing.includes("recipient")) question = "What is the recipient address?";
        return {
          reply: question,
          pendingTransfer: { amount, token, recipient }
        };
      } else {
        return {
          reply: "transfer_intent",
          transfer: { amount, token, recipient },
          message: `You want to transfer ${amount} ${token} to ${recipient}. Please confirm the transfer.`
        };
      }
    }
    const swapIntent = parseSwapIntent(lastUserMessage);
    const transferIntent = parseTransferIntent(lastUserMessage);
    if (swapIntent) {
      if (pendingSwap) {
        pendingSwap = {
          amount: (_c = swapIntent.amount) != null ? _c : pendingSwap.amount,
          from: (_d = swapIntent.from) != null ? _d : pendingSwap.from,
          to: (_e = swapIntent.to) != null ? _e : pendingSwap.to
        };
      } else {
        pendingSwap = __spreadValues({}, swapIntent);
      }
      const missing = [];
      if (!pendingSwap.amount) missing.push("amount");
      if (!pendingSwap.from) missing.push("from");
      if (!pendingSwap.to) missing.push("to");
      if (missing.length > 0) {
        let question = "";
        if (missing.includes("amount")) question = "How much would you like to swap?";
        else if (missing.includes("from")) question = "Which token do you want to swap from?";
        else if (missing.includes("to")) question = "Which token do you want to swap to?";
        return {
          reply: question,
          pendingSwap
        };
      } else {
        return {
          reply: "swap_intent",
          swap: pendingSwap,
          message: `You want to swap ${pendingSwap.amount} ${pendingSwap.from} to ${pendingSwap.to}. Please confirm the swap.`
        };
      }
    }
    if (transferIntent) {
      if (transferIntent.recipient && !/^0x[a-fA-F0-9]{40}$/.test(transferIntent.recipient)) {
        return {
          reply: "The recipient address format appears to be incorrect. Please provide a valid address (e.g., 0x...).",
          pendingTransfer: { amount: transferIntent.amount, token: transferIntent.token, recipient: null }
        };
      }
      pendingTransfer = __spreadValues({}, transferIntent);
      const missing = [];
      if (!pendingTransfer.amount) missing.push("amount");
      if (!pendingTransfer.token) missing.push("token");
      if (!pendingTransfer.recipient) missing.push("recipient");
      if (missing.length > 0) {
        let question = "";
        if (missing.includes("amount")) question = "How much would you like to transfer?";
        else if (missing.includes("token")) question = "Which token do you want to transfer?";
        else if (missing.includes("recipient")) question = "What is the recipient address?";
        return {
          reply: question,
          pendingTransfer
        };
      } else {
        return {
          reply: "transfer_intent",
          transfer: pendingTransfer,
          message: `You want to transfer ${pendingTransfer.amount} ${pendingTransfer.token} to ${pendingTransfer.recipient}. Please confirm the transfer.`
        };
      }
    }
    const messages = [
      { role: "system", content: TRADER_SYSTEM_PROMPT },
      ...body.messages.slice(-5).map((m) => ({ role: m.role, content: m.content }))
    ];
    const response = yield openai2.chat.completions.create({
      model: "gpt-4o",
      messages
    });
    const reply = ((_g = (_f = response.choices[0]) == null ? void 0 : _f.message) == null ? void 0 : _g.content) || "Sorry, no response.";
    return { reply };
  });
}

// src/api/chat.ts
function chatHandler(body) {
  return __async(this, null, function* () {
    switch (body.agentId) {
      case 1:
        return yield handleMindcoreAnalyst(body);
      case 2:
        return yield handleMindcoreTraderCopilot(body);
      default:
        return yield handleMindcoreAnalyst(body);
    }
  });
}
function createChatHandler() {
  return (req, res) => __async(null, null, function* () {
    var _a;
    const body = req.body || (yield (_a = req.json) == null ? void 0 : _a.call(req));
    const result = yield chatHandler(body);
    if (res) {
      res.json ? res.json(result) : res.end(JSON.stringify(result));
    } else {
      return result;
    }
  });
}

// src/api/swap.ts
var import_web3 = __toESM(require("web3"));
var import_bn = __toESM(require("bn.js"));

// src/abi/uniswapV2RouterABI.json
var uniswapV2RouterABI_default = [
  {
    inputs: [
      { internalType: "uint256", name: "amountOutMin", type: "uint256" },
      { internalType: "address[]", name: "path", type: "address[]" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "deadline", type: "uint256" }
    ],
    name: "swapExactETHForTokens",
    outputs: [
      { internalType: "uint256[]", name: "amounts", type: "uint256[]" }
    ],
    stateMutability: "payable",
    type: "function"
  },
  {
    inputs: [
      { internalType: "uint256", name: "amountIn", type: "uint256" },
      { internalType: "address[]", name: "path", type: "address[]" }
    ],
    name: "getAmountsOut",
    outputs: [
      { internalType: "uint256[]", name: "amounts", type: "uint256[]" }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { internalType: "uint256", name: "amountIn", type: "uint256" },
      { internalType: "uint256", name: "amountOutMin", type: "uint256" },
      { internalType: "address[]", name: "path", type: "address[]" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "deadline", type: "uint256" }
    ],
    name: "swapExactTokensForETH",
    outputs: [
      { internalType: "uint256[]", name: "amounts", type: "uint256[]" }
    ],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { internalType: "uint256", name: "amountIn", type: "uint256" },
      { internalType: "uint256", name: "amountOutMin", type: "uint256" },
      { internalType: "address[]", name: "path", type: "address[]" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "deadline", type: "uint256" }
    ],
    name: "swapExactTokensForTokens",
    outputs: [
      { internalType: "uint256[]", name: "amounts", type: "uint256[]" }
    ],
    stateMutability: "nonpayable",
    type: "function"
  }
];

// src/abi/erc20ABI.json
var erc20ABI_default = [
  {
    constant: true,
    inputs: [],
    name: "name",
    outputs: [{ name: "", type: "string" }],
    type: "function"
  },
  {
    constant: false,
    inputs: [
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" }
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    type: "function"
  },
  {
    constant: true,
    inputs: [],
    name: "totalSupply",
    outputs: [{ name: "", type: "uint256" }],
    type: "function"
  },
  {
    constant: false,
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" }
    ],
    name: "transferFrom",
    outputs: [{ name: "", type: "bool" }],
    type: "function"
  },
  {
    constant: true,
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    type: "function"
  },
  {
    constant: true,
    inputs: [{ name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function"
  },
  {
    constant: true,
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    type: "function"
  },
  {
    constant: false,
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" }
    ],
    name: "transfer",
    outputs: [{ name: "", type: "bool" }],
    type: "function"
  },
  {
    constant: true,
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" }
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    type: "function"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: false, name: "value", type: "uint256" }
    ],
    name: "Transfer",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "owner", type: "address" },
      { indexed: true, name: "spender", type: "address" },
      { indexed: false, name: "value", type: "uint256" }
    ],
    name: "Approval",
    type: "event"
  }
];

// src/abi/wethABI.json
var wethABI_default = [
  {
    constant: false,
    inputs: [],
    name: "deposit",
    outputs: [],
    payable: true,
    stateMutability: "payable",
    type: "function"
  },
  {
    constant: false,
    inputs: [
      {
        name: "wad",
        type: "uint256"
      }
    ],
    name: "withdraw",
    outputs: [],
    payable: false,
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    constant: true,
    inputs: [],
    name: "name",
    outputs: [
      {
        name: "",
        type: "string"
      }
    ],
    payable: false,
    stateMutability: "view",
    type: "function"
  },
  {
    constant: false,
    inputs: [
      {
        name: "guy",
        type: "address"
      },
      {
        name: "wad",
        type: "uint256"
      }
    ],
    name: "approve",
    outputs: [
      {
        name: "",
        type: "bool"
      }
    ],
    payable: false,
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    constant: true,
    inputs: [],
    name: "totalSupply",
    outputs: [
      {
        name: "",
        type: "uint256"
      }
    ],
    payable: false,
    stateMutability: "view",
    type: "function"
  },
  {
    constant: false,
    inputs: [
      {
        name: "src",
        type: "address"
      },
      {
        name: "dst",
        type: "address"
      },
      {
        name: "wad",
        type: "uint256"
      }
    ],
    name: "transferFrom",
    outputs: [
      {
        name: "",
        type: "bool"
      }
    ],
    payable: false,
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    constant: true,
    inputs: [],
    name: "decimals",
    outputs: [
      {
        name: "",
        type: "uint8"
      }
    ],
    payable: false,
    stateMutability: "view",
    type: "function"
  },
  {
    constant: true,
    inputs: [
      {
        name: "",
        type: "address"
      }
    ],
    name: "balanceOf",
    outputs: [
      {
        name: "",
        type: "uint256"
      }
    ],
    payable: false,
    stateMutability: "view",
    type: "function"
  },
  {
    constant: true,
    inputs: [],
    name: "symbol",
    outputs: [
      {
        name: "",
        type: "string"
      }
    ],
    payable: false,
    stateMutability: "view",
    type: "function"
  },
  {
    constant: false,
    inputs: [
      {
        name: "dst",
        type: "address"
      },
      {
        name: "wad",
        type: "uint256"
      }
    ],
    name: "transfer",
    outputs: [
      {
        name: "",
        type: "bool"
      }
    ],
    payable: false,
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    constant: true,
    inputs: [
      {
        name: "",
        type: "address"
      },
      {
        name: "",
        type: "address"
      }
    ],
    name: "allowance",
    outputs: [
      {
        name: "",
        type: "uint256"
      }
    ],
    payable: false,
    stateMutability: "view",
    type: "function"
  },
  {
    payable: true,
    stateMutability: "payable",
    type: "fallback"
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        name: "src",
        type: "address"
      },
      {
        indexed: true,
        name: "guy",
        type: "address"
      },
      {
        indexed: false,
        name: "wad",
        type: "uint256"
      }
    ],
    name: "Approval",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        name: "src",
        type: "address"
      },
      {
        indexed: true,
        name: "dst",
        type: "address"
      },
      {
        indexed: false,
        name: "wad",
        type: "uint256"
      }
    ],
    name: "Transfer",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        name: "dst",
        type: "address"
      },
      {
        indexed: false,
        name: "wad",
        type: "uint256"
      }
    ],
    name: "Deposit",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        name: "src",
        type: "address"
      },
      {
        indexed: false,
        name: "wad",
        type: "uint256"
      }
    ],
    name: "Withdrawal",
    type: "event"
  }
];

// src/utils/getTokenMeta.ts
var COMMON_TOKENS = {
  ETH: {
    address: "ETH",
    symbol: "ETH",
    decimals: 18
  },
  USDT: {
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    symbol: "USDT",
    decimals: 6
  },
  USDC: {
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    symbol: "USDC",
    decimals: 6
  },
  DAI: {
    address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    symbol: "DAI",
    decimals: 18
  },
  WETH: {
    address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    symbol: "WETH",
    decimals: 18
  }
};
function getTokenMeta(symbolOrAddress, web3) {
  return __async(this, null, function* () {
    const key = symbolOrAddress.toUpperCase();
    if (COMMON_TOKENS[key]) {
      return COMMON_TOKENS[key];
    }
    if (web3.utils.isAddress(symbolOrAddress)) {
      try {
        const tokenContract = new web3.eth.Contract(erc20ABI_default, symbolOrAddress);
        const [symbol, decimals] = yield Promise.all([
          tokenContract.methods.symbol().call(),
          tokenContract.methods.decimals().call()
        ]);
        return {
          address: symbolOrAddress,
          symbol,
          decimals: Number(decimals)
        };
      } catch (e) {
        return null;
      }
    }
    return null;
  });
}

// src/api/swap.ts
var import_dotenv3 = __toESM(require("dotenv"));
import_dotenv3.default.config();
var UNISWAP_ROUTER_ADDRESS = process.env.UNISWAP_ROUTER_ADDRESS;
var RPC_URL = process.env.RPC_URL;
var WETH_ADDRESS = process.env.WETH_ADDRESS || "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
function swapHandler(body) {
  return __async(this, null, function* () {
    if (!UNISWAP_ROUTER_ADDRESS) return { error: "UNISWAP_ROUTER_ADDRESS is not set in environment variables." };
    const web3 = new import_web3.default(RPC_URL);
    const router = new web3.eth.Contract(uniswapV2RouterABI_default, UNISWAP_ROUTER_ADDRESS);
    const { from, to, amount, userAddress, slippage = 5e-3 } = body;
    const isWethToEth = String(from).toUpperCase() === "WETH" && String(to).toUpperCase() === "ETH";
    const isEthToWeth = String(from).toUpperCase() === "ETH" && String(to).toUpperCase() === "WETH";
    if (isEthToWeth) {
      const amountIn = web3.utils.toWei(String(amount), "ether");
      const wethContract = new web3.eth.Contract(wethABI_default, WETH_ADDRESS);
      const tx = wethContract.methods.deposit();
      return {
        to: WETH_ADDRESS,
        data: tx.encodeABI(),
        value: amountIn
      };
    }
    if (isWethToEth) {
      const fromMeta2 = yield getTokenMeta("WETH", web3);
      if (!fromMeta2 || !fromMeta2.address || typeof fromMeta2.decimals !== "number") {
        return { error: `WETH not supported` };
      }
      const amountIn = web3.utils.toWei(String(amount), "ether");
      const wethContract = new web3.eth.Contract(wethABI_default, WETH_ADDRESS);
      const tx = wethContract.methods.withdraw(amountIn);
      return {
        to: WETH_ADDRESS,
        data: tx.encodeABI(),
        value: "0"
      };
    }
    const fromMeta = String(from) === "ETH" ? { address: "ETH", symbol: "ETH", decimals: 18 } : yield getTokenMeta(String(from), web3);
    const toMeta = String(to) === "ETH" ? { address: "ETH", symbol: "ETH", decimals: 18 } : yield getTokenMeta(String(to), web3);
    if (from === "ETH" && to !== "ETH") {
      if (!toMeta || !toMeta.address || typeof toMeta.decimals !== "number") {
        return { error: `Swapping to ${to} coin is not supported. Please try again later` };
      }
      let amountIn = web3.utils.toWei(String(amount), "ether");
      let ethBalance;
      try {
        ethBalance = yield web3.eth.getBalance(userAddress);
      } catch (e) {
        return { error: "Failed to fetch ETH balance." };
      }
      if (new import_bn.default(ethBalance).lt(new import_bn.default(amountIn))) {
        return { error: "Balance insufficient!" };
      }
      let amountsOut;
      try {
        amountsOut = yield router.methods.getAmountsOut(amountIn, [web3.utils.toChecksumAddress(WETH_ADDRESS), toMeta.address]).call();
      } catch (e) {
        return { error: String(e) };
      }
      if (!amountsOut || !Array.isArray(amountsOut) || amountsOut.length < 2) {
        return { error: "Failed to get output amount from router." };
      }
      const amountOut = amountsOut[1];
      const amountOutMin = new import_bn.default(amountOut).sub(
        new import_bn.default(amountOut).mul(new import_bn.default(Math.floor(slippage * 1e3))).div(new import_bn.default(1e3))
      );
      const deadline = Math.floor(Date.now() / 1e3) + 60 * 20;
      const tx = router.methods.swapExactETHForTokens(
        amountOutMin.toString(),
        [web3.utils.toChecksumAddress(WETH_ADDRESS), toMeta.address],
        userAddress,
        deadline
      );
      return {
        to: UNISWAP_ROUTER_ADDRESS,
        data: tx.encodeABI(),
        value: amountIn
      };
    }
    if (to === "ETH" && from !== "ETH") {
      if (!fromMeta || !fromMeta.address || typeof fromMeta.decimals !== "number") {
        return { error: `Swapping from ${from} coin is not supported. Please try again later` };
      }
      let amountIn;
      try {
        const [whole, dec] = String(amount).split(".");
        const wholeBN = new import_bn.default(whole || "0").mul(new import_bn.default(10).pow(new import_bn.default(fromMeta.decimals)));
        let decBN = new import_bn.default(0);
        if (dec) {
          if (dec.length > fromMeta.decimals) {
            return { error: "Too many decimal places in amount." };
          }
          const decPadded = dec.padEnd(fromMeta.decimals, "0");
          decBN = new import_bn.default(decPadded);
        }
        amountIn = wholeBN.add(decBN).toString();
      } catch (e) {
        return { error: "Invalid amount format." };
      }
      let balance;
      try {
        const erc202 = new web3.eth.Contract(erc20ABI_default, fromMeta.address);
        balance = yield erc202.methods.balanceOf(userAddress).call();
      } catch (e) {
        return { error: "Failed to fetch token balance." };
      }
      if (balance === void 0 || amountIn === void 0) {
        return { error: "Internal error: balance or amountIn is undefined" };
      }
      if (new import_bn.default(balance).lt(new import_bn.default(amountIn))) {
        return { error: "Balance insufficient!" };
      }
      const erc20 = new web3.eth.Contract(erc20ABI_default, fromMeta.address);
      let allowance;
      try {
        allowance = yield erc20.methods.allowance(userAddress, UNISWAP_ROUTER_ADDRESS).call();
      } catch (e) {
        return { error: "Failed to fetch allowance." };
      }
      if (allowance === void 0 || amountIn === void 0) {
        return { error: "Internal error: allowance or amountIn is undefined" };
      }
      if (new import_bn.default(allowance).lt(new import_bn.default(amountIn))) {
        const maxApproval = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
        const approveTx = erc20.methods.approve(UNISWAP_ROUTER_ADDRESS, maxApproval);
        return {
          approvalRequired: true,
          approval: {
            to: fromMeta.address,
            data: approveTx.encodeABI(),
            value: "0"
          },
          message: "Approval required before swap. Please sign and send this approval transaction."
        };
      }
      let amountsOut;
      try {
        amountsOut = yield router.methods.getAmountsOut(amountIn, [fromMeta.address, web3.utils.toChecksumAddress(WETH_ADDRESS)]).call();
      } catch (e) {
        return { error: String(e) };
      }
      if (!amountsOut || !Array.isArray(amountsOut) || amountsOut.length < 2) {
        return { error: "Failed to get output amount from router." };
      }
      const amountOut = amountsOut[1];
      const amountOutMin = new import_bn.default(amountOut).sub(
        new import_bn.default(amountOut).mul(new import_bn.default(Math.floor(slippage * 1e3))).div(new import_bn.default(1e3))
      );
      const deadline = Math.floor(Date.now() / 1e3) + 60 * 20;
      const tx = router.methods.swapExactTokensForETH(
        amountIn,
        amountOutMin.toString(),
        [fromMeta.address, web3.utils.toChecksumAddress(WETH_ADDRESS)],
        userAddress,
        deadline
      );
      return {
        to: UNISWAP_ROUTER_ADDRESS,
        data: tx.encodeABI(),
        value: "0"
      };
    }
    if (from !== "ETH" && to !== "ETH") {
      if (!fromMeta || !fromMeta.address || typeof fromMeta.decimals !== "number") {
        return { error: `Swapping from ${from} coin is not supported. Please try again later` };
      }
      if (!toMeta || !toMeta.address || typeof toMeta.decimals !== "number") {
        return { error: `Swapping to ${to} coin is not supported. Please try again later` };
      }
      let amountIn;
      try {
        const [whole, dec] = String(amount).split(".");
        const wholeBN = new import_bn.default(whole || "0").mul(new import_bn.default(10).pow(new import_bn.default(fromMeta.decimals)));
        let decBN = new import_bn.default(0);
        if (dec) {
          if (dec.length > fromMeta.decimals) {
            return { error: "Too many decimal places in amount." };
          }
          const decPadded = dec.padEnd(fromMeta.decimals, "0");
          decBN = new import_bn.default(decPadded);
        }
        amountIn = wholeBN.add(decBN).toString();
      } catch (e) {
        return { error: "Invalid amount format." };
      }
      const fromTokenContract = new web3.eth.Contract(erc20ABI_default, fromMeta.address);
      const balance = yield fromTokenContract.methods.balanceOf(userAddress).call();
      if (new import_bn.default(balance).lt(new import_bn.default(amountIn))) {
        return { error: "Balance insufficient!" };
      }
      const allowance = yield fromTokenContract.methods.allowance(userAddress, UNISWAP_ROUTER_ADDRESS).call();
      if (new import_bn.default(allowance).lt(new import_bn.default(amountIn))) {
        const maxApproval = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
        const approveTx = fromTokenContract.methods.approve(UNISWAP_ROUTER_ADDRESS, maxApproval);
        return {
          approvalRequired: true,
          approval: {
            to: fromMeta.address,
            data: approveTx.encodeABI(),
            value: "0"
          },
          message: "Approval required before swap. Please sign and send this approval transaction."
        };
      }
      const path = [fromMeta.address, web3.utils.toChecksumAddress(WETH_ADDRESS), toMeta.address];
      let amountsOut;
      try {
        amountsOut = yield router.methods.getAmountsOut(amountIn, path).call();
      } catch (e) {
        return { error: "Could not get swap estimation. The token pair may not have liquidity." };
      }
      if (!amountsOut || !Array.isArray(amountsOut) || amountsOut.length < 2) {
        return { error: "Failed to get output amount from router." };
      }
      const amountOut = amountsOut[amountsOut.length - 1];
      const amountOutMin = new import_bn.default(amountOut).sub(
        new import_bn.default(amountOut).mul(new import_bn.default(Math.floor(slippage * 1e3))).div(new import_bn.default(1e3))
      );
      const deadline = Math.floor(Date.now() / 1e3) + 60 * 20;
      const tx = router.methods.swapExactTokensForTokens(
        amountIn,
        amountOutMin.toString(),
        path,
        userAddress,
        deadline
      );
      return {
        to: UNISWAP_ROUTER_ADDRESS,
        data: tx.encodeABI(),
        value: "0"
      };
    }
    return { error: "Invalid swap pair." };
  });
}

// src/api/transfer.ts
var import_web32 = __toESM(require("web3"));
var import_bn2 = __toESM(require("bn.js"));
var import_dotenv4 = __toESM(require("dotenv"));
import_dotenv4.default.config();
var RPC_URL2 = process.env.RPC_URL;
function transferHandler(body) {
  return __async(this, null, function* () {
    const { token, amount, recipient, userAddress } = body;
    const web3 = new import_web32.default(RPC_URL2);
    if (!web3.utils.isAddress(recipient)) {
      return { error: "Invalid recipient address." };
    }
    if (token.toUpperCase() === "ETH") {
      let amountInWei;
      try {
        amountInWei = web3.utils.toWei(amount, "ether");
      } catch (e) {
        return { error: "Invalid amount" };
      }
      const balance2 = yield web3.eth.getBalance(userAddress);
      if (new import_bn2.default(balance2).lt(new import_bn2.default(amountInWei))) {
        return { error: "Insufficient ETH balance." };
      }
      return {
        to: recipient,
        data: "0x",
        value: amountInWei
      };
    }
    const tokenMeta = yield getTokenMeta(token, web3);
    if (!tokenMeta || !tokenMeta.address || typeof tokenMeta.decimals !== "number") {
      return { error: `Token ${token} not supported.` };
    }
    let amountInBaseUnit;
    try {
      const [whole, dec] = String(amount).split(".");
      const wholeBN = new import_bn2.default(whole || "0").mul(new import_bn2.default(10).pow(new import_bn2.default(tokenMeta.decimals)));
      let decBN = new import_bn2.default(0);
      if (dec) {
        if (dec.length > tokenMeta.decimals) {
          return { error: "Too many decimal places in amount." };
        }
        const decPadded = dec.padEnd(tokenMeta.decimals, "0");
        decBN = new import_bn2.default(decPadded);
      }
      amountInBaseUnit = wholeBN.add(decBN);
    } catch (e) {
      return { error: "Invalid amount format." };
    }
    const tokenContract = new web3.eth.Contract(erc20ABI_default, tokenMeta.address);
    const balance = yield tokenContract.methods.balanceOf(userAddress).call();
    if (new import_bn2.default(balance).lt(amountInBaseUnit)) {
      return { error: `Insufficient ${token} balance.` };
    }
    const txData = tokenContract.methods.transfer(recipient, amountInBaseUnit.toString()).encodeABI();
    return {
      to: tokenMeta.address,
      data: txData,
      value: "0"
    };
  });
}

// src/server.ts
var import_dotenv5 = __toESM(require("dotenv"));
import_dotenv5.default.config();
var app = (0, import_express.default)();
app.use(import_express.default.json());
app.post("/api/chat", createChatHandler());
app.post("/api/swap", (req, res) => __async(null, null, function* () {
  try {
    const result = yield swapHandler(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}));
app.post("/api/transfer", (req, res) => __async(null, null, function* () {
  try {
    const result = yield transferHandler(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}));
var port = process.env.PORT || 3e3;
app.listen(port, () => {
  console.log(`Mindcore MCP Server running on port ${port}`);
});
