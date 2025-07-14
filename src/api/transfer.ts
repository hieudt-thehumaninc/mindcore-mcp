import Web3 from 'web3'
import BN from 'bn.js'
import ERC20_ABI from '../abi/erc20ABI.json'
import { getTokenMeta } from '../utils/getTokenMeta'
import dotenv from 'dotenv'
dotenv.config()

const RPC_URL = process.env.RPC_URL as string

export interface TransferRequest {
  token: string
  amount: string
  recipient: string
  userAddress: string
}

export interface TransferResponse {
  to?: string
  data?: string
  value?: string
  error?: string
}

export async function transferHandler(body: TransferRequest): Promise<TransferResponse> {
  const { token, amount, recipient, userAddress } = body
  const web3 = new Web3(RPC_URL)

  // Validate recipient address
  if (!web3.utils.isAddress(recipient)) {
    return { error: 'Invalid recipient address.' }
  }

  // Native ETH transfer
  if (token.toUpperCase() === 'ETH') {
    let amountInWei
    try {
      amountInWei = web3.utils.toWei(amount, 'ether')
    } catch (e) {
      return { error: 'Invalid amount' }
    }
    const balance = await web3.eth.getBalance(userAddress)
    if (new BN(balance).lt(new BN(amountInWei))) {
      return { error: 'Insufficient ETH balance.' }
    }
    return {
      to: recipient,
      data: '0x',
      value: amountInWei,
    }
  }

  // ERC20 token transfer
  const tokenMeta = await getTokenMeta(token, web3)
  if (!tokenMeta || !tokenMeta.address || typeof tokenMeta.decimals !== 'number') {
    return { error: `Token ${token} not supported.` }
  }
  let amountInBaseUnit
  try {
    const [whole, dec] = String(amount).split('.')
    const wholeBN = new BN(whole || '0').mul(new BN(10).pow(new BN(tokenMeta.decimals)))
    let decBN = new BN(0)
    if (dec) {
      if (dec.length > tokenMeta.decimals) {
        return { error: 'Too many decimal places in amount.' }
      }
      const decPadded = dec.padEnd(tokenMeta.decimals, '0')
      decBN = new BN(decPadded)
    }
    amountInBaseUnit = wholeBN.add(decBN)
  } catch (e) {
    return { error: 'Invalid amount format.' }
  }
  const tokenContract = new web3.eth.Contract(ERC20_ABI as any, tokenMeta.address)
  const balance = await tokenContract.methods.balanceOf(userAddress).call()
  if (new BN(balance as unknown as string).lt(amountInBaseUnit)) {
    return { error: `Insufficient ${token} balance.` }
  }
  const txData = tokenContract.methods.transfer(recipient, amountInBaseUnit.toString()).encodeABI()
  return {
    to: tokenMeta.address,
    data: txData,
    value: '0',
  }
}

// Example handler for Express/h3/Fastify
export function createTransferHandler() {
  return async (req: any, res: any) => {
    const body = req.body || (await req.json?.())
    const result = await transferHandler(body)
    if (res) {
      res.json ? res.json(result) : res.end(JSON.stringify(result))
    } else {
      return result
    }
  }
}
