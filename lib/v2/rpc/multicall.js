// ============================================
// V2 Multicall3 — Batch all on-chain reads in 1 RPC call
// ============================================
// Uses Multicall3.aggregate3() at 0xcA11bde05977b3631167028862bE2a173976CA11
// Each call has allowFailure=true so one revert doesn't break the batch.

import { ethers } from 'ethers';
import { CONTRACTS } from '../shared/constants.js';
import { getProvider } from './provider.js';

// Multicall3 aggregate3 ABI
const MULTICALL3_ABI = [
  'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[])',
];

const iMulticall3 = new ethers.utils.Interface(MULTICALL3_ABI);

/**
 * Execute a batch of calls via Multicall3.aggregate3
 * @param {Array<{target: string, callData: string, iface: ethers.utils.Interface, fnName: string}>} calls
 * @returns {Promise<Array<{success: boolean, data: any, error: string|null}>>}
 */
export async function multicall(calls) {
  if (calls.length === 0) return [];

  const provider = await getProvider();

  // Encode aggregate3 input
  const multicallInput = calls.map(c => ({
    target: c.target,
    allowFailure: true,
    callData: c.callData,
  }));

  const encodedCall = iMulticall3.encodeFunctionData('aggregate3', [multicallInput]);

  // Execute a single eth_call
  const rawResult = await provider.call({
    to: CONTRACTS.MULTICALL3,
    data: encodedCall,
  });

  // Decode aggregate3 output: (bool success, bytes returnData)[]
  const [results] = iMulticall3.decodeFunctionResult('aggregate3', rawResult);

  // Decode each individual result
  return results.map((result, idx) => {
    const call = calls[idx];
    if (!result.success) {
      return {
        success: false,
        data: null,
        error: `Call ${idx} (${call.fnName}) reverted`,
      };
    }

    try {
      const decoded = call.iface.decodeFunctionResult(call.fnName, result.returnData);
      return { success: true, data: decoded, error: null };
    } catch (err) {
      return {
        success: false,
        data: null,
        error: `Decode error for ${call.fnName}: ${err.message}`,
      };
    }
  });
}

/**
 * Split calls into chunks and execute sequentially if batch is too large.
 * Multicall3 has no hard limit, but very large batches can hit gas estimation issues.
 * @param {Array} calls
 * @param {number} chunkSize - Max calls per batch (default 20)
 * @returns {Promise<Array>}
 */
export async function multicallChunked(calls, chunkSize = 20) {
  if (calls.length <= chunkSize) {
    return multicall(calls);
  }

  const results = [];
  for (let i = 0; i < calls.length; i += chunkSize) {
    const chunk = calls.slice(i, i + chunkSize);
    const chunkResults = await multicall(chunk);
    results.push(...chunkResults);
  }
  return results;
}
