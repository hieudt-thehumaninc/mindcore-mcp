import Web3 from 'web3'
import ERC20_ABI from '../abi/erc20ABI.json'

// Static map for common tokens (Ethereum mainnet)
const COMMON_TOKENS: Record<string, { address: string; symbol: string; decimals: number }> = {
  ETH: {
    address: 'ETH',
    symbol: 'ETH',
    decimals: 18,
  },
  USDT: {
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    symbol: 'USDT',
    decimals: 6,
  },
  USDC: {
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    symbol: 'USDC',
    decimals: 6,
  },
  DAI: {
    address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    symbol: 'DAI',
    decimals: 18,
  },
  WETH: {
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    symbol: 'WETH',
    decimals: 18,
  },
}

export async function getTokenMeta(symbolOrAddress: string, web3: Web3) {
  // Check static map first
  const key = symbolOrAddress.toUpperCase()
  if (COMMON_TOKENS[key]) {
    return COMMON_TOKENS[key]
  }
  // If it's an address, try on-chain lookup
  if (web3.utils.isAddress(symbolOrAddress)) {
    try {
      const tokenContract = new web3.eth.Contract(ERC20_ABI as any, symbolOrAddress)
      const [symbol, decimals] = await Promise.all([
        tokenContract.methods.symbol().call(),
        tokenContract.methods.decimals().call(),
      ])
      return {
        address: symbolOrAddress,
        symbol,
        decimals: Number(decimals),
      }
    } catch (e) {
      return null
    }
  }
  // Not found
  return null
}
