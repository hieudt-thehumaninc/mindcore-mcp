import Web3 from 'web3'
import BN from 'bn.js'
import UniswapV2RouterABI from '../abi/uniswapV2RouterABI.json'
import ERC20_ABI from '../abi/erc20ABI.json'
import WETH_ABI from '../abi/wethABI.json'
import { getTokenMeta } from '../utils/getTokenMeta'
import dotenv from 'dotenv'
dotenv.config()

const UNISWAP_ROUTER_ADDRESS = process.env.UNISWAP_ROUTER_ADDRESS as string
const RPC_URL = process.env.RPC_URL as string
const WETH_ADDRESS = process.env.WETH_ADDRESS || '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'

export interface SwapRequest {
  from: string
  to: string
  amount: string
  userAddress: string
  slippage?: number
}

export interface SwapResponse {
  to?: string
  data?: string
  value?: string
  approvalRequired?: boolean
  approval?: { to: string; data: string; value: string }
  message?: string
  error?: string
}

export async function swapHandler(body: SwapRequest): Promise<SwapResponse> {
  if (!UNISWAP_ROUTER_ADDRESS) return { error: 'UNISWAP_ROUTER_ADDRESS is not set in environment variables.' }
  const web3 = new Web3(RPC_URL)
  const router = new web3.eth.Contract(UniswapV2RouterABI as any, UNISWAP_ROUTER_ADDRESS)
  const { from, to, amount, userAddress, slippage = 0.005 } = body

  // Special handling for WETH
  const isWethToEth = String(from).toUpperCase() === 'WETH' && String(to).toUpperCase() === 'ETH'
  const isEthToWeth = String(from).toUpperCase() === 'ETH' && String(to).toUpperCase() === 'WETH'

  if (isEthToWeth) {
    const amountIn = web3.utils.toWei(String(amount), 'ether')
    const wethContract = new web3.eth.Contract(WETH_ABI as any, WETH_ADDRESS)
    const tx = wethContract.methods.deposit()
    return {
      to: WETH_ADDRESS,
      data: tx.encodeABI(),
      value: amountIn,
    }
  }

  if (isWethToEth) {
    const fromMeta = await getTokenMeta('WETH', web3)
    if (!fromMeta || !fromMeta.address || typeof fromMeta.decimals !== 'number') {
      return { error: `WETH not supported` }
    }
    const amountIn = web3.utils.toWei(String(amount), 'ether')
    const wethContract = new web3.eth.Contract(WETH_ABI as any, WETH_ADDRESS)
    const tx = wethContract.methods.withdraw(amountIn)
    return {
      to: WETH_ADDRESS,
      data: tx.encodeABI(),
      value: '0',
    }
  }

  // Fetch token meta for 'from' and 'to'
  const fromMeta = String(from) === 'ETH' ? { address: 'ETH', symbol: 'ETH', decimals: 18 } : await getTokenMeta(String(from), web3)
  const toMeta = String(to) === 'ETH' ? { address: 'ETH', symbol: 'ETH', decimals: 18 } : await getTokenMeta(String(to), web3)

  // ETH -> Token swap
  if (from === 'ETH' && to !== 'ETH') {
    if (!toMeta || !toMeta.address || typeof toMeta.decimals !== 'number') {
      return { error: `Swapping to ${to} coin is not supported. Please try again later` }
    }
    let amountIn = web3.utils.toWei(String(amount), 'ether')
    // Check ETH balance before proceeding
    let ethBalance
    try {
      ethBalance = await web3.eth.getBalance(userAddress)
    } catch (e) {
      return { error: 'Failed to fetch ETH balance.' }
    }
    if (new BN(ethBalance).lt(new BN(amountIn))) {
      return { error: 'Balance insufficient!' }
    }
    let amountsOut
    try {
      amountsOut = (await router.methods
        .getAmountsOut(amountIn, [web3.utils.toChecksumAddress(WETH_ADDRESS), toMeta.address])
        .call()) as string[]
    } catch (e) {
      return { error: String(e) }
    }
    if (!amountsOut || !Array.isArray(amountsOut) || amountsOut.length < 2) {
      return { error: 'Failed to get output amount from router.' }
    }
    const amountOut = amountsOut[1] as string
    const amountOutMin = new BN(amountOut).sub(
      new BN(amountOut).mul(new BN(Math.floor(slippage * 1000))).div(new BN(1000)),
    )
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20
    const tx = router.methods
      .swapExactETHForTokens(
        amountOutMin.toString(),
        [web3.utils.toChecksumAddress(WETH_ADDRESS), toMeta.address],
        userAddress,
        deadline
      )
    return {
      to: UNISWAP_ROUTER_ADDRESS,
      data: tx.encodeABI(),
      value: amountIn,
    }
  }

  // Token -> ETH swap
  if (to === 'ETH' && from !== 'ETH') {
    if (!fromMeta || !fromMeta.address || typeof fromMeta.decimals !== 'number') {
      return { error: `Swapping from ${from} coin is not supported. Please try again later` }
    }
    let amountIn
    try {
      const [whole, dec] = String(amount).split('.')
      const wholeBN = new BN(whole || '0').mul(new BN(10).pow(new BN(fromMeta.decimals)))
      let decBN = new BN(0)
      if (dec) {
        if (dec.length > fromMeta.decimals) {
          return { error: 'Too many decimal places in amount.' }
        }
        const decPadded = dec.padEnd(fromMeta.decimals, '0')
        decBN = new BN(decPadded)
      }
      amountIn = wholeBN.add(decBN).toString()
    } catch (e) {
      return { error: 'Invalid amount format.' }
    }
    // Check token balance before proceeding
    let balance
    try {
      const erc20 = new web3.eth.Contract(ERC20_ABI as any, fromMeta.address)
      balance = await erc20.methods.balanceOf(userAddress).call()
    } catch (e) {
      return { error: 'Failed to fetch token balance.' }
    }
    if (balance === undefined || amountIn === undefined) {
      return { error: 'Internal error: balance or amountIn is undefined' }
    }
    if (new BN(balance).lt(new BN(amountIn))) {
      return { error: 'Balance insufficient!' }
    }
    // Check allowance
    const erc20 = new web3.eth.Contract(ERC20_ABI as any, fromMeta.address)
    let allowance
    try {
      allowance = await erc20.methods.allowance(userAddress, UNISWAP_ROUTER_ADDRESS).call()
    } catch (e) {
      return { error: 'Failed to fetch allowance.' }
    }
    if (allowance === undefined || amountIn === undefined) {
      return { error: 'Internal error: allowance or amountIn is undefined' }
    }
    if (new BN(allowance).lt(new BN(amountIn))) {
      // Not enough allowance, build approval tx
      const maxApproval = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
      const approveTx = erc20.methods.approve(UNISWAP_ROUTER_ADDRESS, maxApproval)
      return {
        approvalRequired: true,
        approval: {
          to: fromMeta.address,
          data: approveTx.encodeABI(),
          value: '0',
        },
        message: 'Approval required before swap. Please sign and send this approval transaction.'
      }
    }
    let amountsOut
    try {
      amountsOut = (await router.methods
        .getAmountsOut(amountIn, [fromMeta.address, web3.utils.toChecksumAddress(WETH_ADDRESS)])
        .call()) as string[]
    } catch (e) {
      return { error: String(e) }
    }
    if (!amountsOut || !Array.isArray(amountsOut) || amountsOut.length < 2) {
      return { error: 'Failed to get output amount from router.' }
    }
    const amountOut = amountsOut[1] as string
    const amountOutMin = new BN(amountOut).sub(
      new BN(amountOut).mul(new BN(Math.floor(slippage * 1000))).div(new BN(1000)),
    )
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20
    const tx = router.methods
      .swapExactTokensForETH(
        amountIn,
        amountOutMin.toString(),
        [fromMeta.address, web3.utils.toChecksumAddress(WETH_ADDRESS)],
        userAddress,
        deadline
      )
    return {
      to: UNISWAP_ROUTER_ADDRESS,
      data: tx.encodeABI(),
      value: '0',
    }
  }

  // Token -> Token swap
  if (from !== 'ETH' && to !== 'ETH') {
    if (!fromMeta || !fromMeta.address || typeof fromMeta.decimals !== 'number') {
      return { error: `Swapping from ${from} coin is not supported. Please try again later` }
    }
    if (!toMeta || !toMeta.address || typeof toMeta.decimals !== 'number') {
      return { error: `Swapping to ${to} coin is not supported. Please try again later` }
    }
    let amountIn
    try {
      const [whole, dec] = String(amount).split('.')
      const wholeBN = new BN(whole || '0').mul(new BN(10).pow(new BN(fromMeta.decimals)))
      let decBN = new BN(0)
      if (dec) {
        if (dec.length > fromMeta.decimals) {
          return { error: 'Too many decimal places in amount.' }
        }
        const decPadded = dec.padEnd(fromMeta.decimals, '0')
        decBN = new BN(decPadded)
      }
      amountIn = wholeBN.add(decBN).toString()
    } catch (e) {
      return { error: 'Invalid amount format.' }
    }
    // Check token balance before proceeding
    const fromTokenContract = new web3.eth.Contract(ERC20_ABI as any, fromMeta.address)
    const balance = await fromTokenContract.methods.balanceOf(userAddress).call() as string
    if (new BN(balance).lt(new BN(amountIn))) {
      return { error: 'Balance insufficient!' }
    }
    // Check allowance
    const allowance = await fromTokenContract.methods.allowance(userAddress, UNISWAP_ROUTER_ADDRESS).call() as string
    if (new BN(allowance).lt(new BN(amountIn))) {
      const maxApproval = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
      const approveTx = fromTokenContract.methods.approve(UNISWAP_ROUTER_ADDRESS, maxApproval)
      return {
        approvalRequired: true,
        approval: {
          to: fromMeta.address,
          data: approveTx.encodeABI(),
          value: '0',
        },
        message: 'Approval required before swap. Please sign and send this approval transaction.'
      }
    }
    // Get amountsOut for Token -> WETH -> Token
    const path = [fromMeta.address, web3.utils.toChecksumAddress(WETH_ADDRESS), toMeta.address]
    let amountsOut
    try {
      amountsOut = (await router.methods
        .getAmountsOut(amountIn, path)
        .call()) as string[]
    } catch (e) {
      return { error: 'Could not get swap estimation. The token pair may not have liquidity.' }
    }
    if (!amountsOut || !Array.isArray(amountsOut) || amountsOut.length < 2) {
      return { error: 'Failed to get output amount from router.' }
    }
    const amountOut = amountsOut[amountsOut.length - 1] as string
    const amountOutMin = new BN(amountOut).sub(
      new BN(amountOut).mul(new BN(Math.floor(slippage * 1000))).div(new BN(1000)),
    )
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20
    const tx = router.methods
      .swapExactTokensForTokens(
        amountIn,
        amountOutMin.toString(),
        path,
        userAddress,
        deadline
      )
    return {
      to: UNISWAP_ROUTER_ADDRESS,
      data: tx.encodeABI(),
      value: '0',
    }
  }

  // Unsupported swap direction
  return { error: 'Invalid swap pair.' }
}

// Example handler for Express/h3/Fastify
export function createSwapHandler() {
  return async (req: any, res: any) => {
    const body = req.body || (await req.json?.())
    const result = await swapHandler(body)
    if (res) {
      res.json ? res.json(result) : res.end(JSON.stringify(result))
    } else {
      return result
    }
  }
}
