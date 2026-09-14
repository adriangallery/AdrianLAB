import { ethers } from 'ethers';
const provider = new ethers.providers.JsonRpcProvider(process.env.BASE_RPC_URL || 'https://base-mainnet.g.alchemy.com/v2/6TTSw3wJVVJZsPsioLk8T');
const TRAITS = '0x90546848474FB3c9fda3fdAd887969bB244E7e58';
const TOKEN_ID = 1176;

const c = new ethers.Contract(TRAITS, [
  'function totalMintedPerAsset(uint256) view returns (uint256)',
  'function getAvailableSupply(uint256) view returns (uint256)',
  'function assets(uint256) view returns (string category, bool tempFlag, uint256 maxSupply, uint8 assetType)',
], provider);

const minted = await c.totalMintedPerAsset(TOKEN_ID);
const available = await c.getAvailableSupply(TOKEN_ID);
const asset = await c.assets(TOKEN_ID);

console.log(`tokenId            ${TOKEN_ID}`);
console.log(`maxSupply          ${asset.maxSupply.toString()}`);
console.log(`totalMintedPerAsset ${minted.toString()}   (incremental, never decreases on burn)`);
console.log(`getAvailableSupply ${available.toString()}   (= maxSupply - totalMinted)`);

// Sum balances across known holders by replaying TransferSingle events
const erc1155 = new ethers.Contract(TRAITS, [
  'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)',
], provider);

console.log(`\nReplaying TransferSingle events for tokenId=${TOKEN_ID}...`);
const filter = erc1155.filters.TransferSingle(null, null, null);
const latestBlock = await provider.getBlockNumber();
const STEP = 100_000;
let from0 = latestBlock - 800_000; // Look back ~800k blocks (~16d)
const balances = new Map();
let totalEvents = 0;

while (from0 < latestBlock) {
  const to = Math.min(from0 + STEP - 1, latestBlock);
  const logs = await erc1155.queryFilter(filter, from0, to);
  for (const log of logs) {
    if (log.args.id.toNumber() !== TOKEN_ID) continue;
    totalEvents++;
    const v = log.args.value.toNumber();
    const fromAddr = log.args.from.toLowerCase();
    const toAddr = log.args.to.toLowerCase();
    if (fromAddr !== '0x0000000000000000000000000000000000000000') {
      balances.set(fromAddr, (balances.get(fromAddr) ?? 0) - v);
    }
    if (toAddr !== '0x0000000000000000000000000000000000000000') {
      balances.set(toAddr, (balances.get(toAddr) ?? 0) + v);
    } else {
      console.log(`  BURN: ${v} from ${fromAddr.slice(0,10)}... at block ${log.blockNumber}`);
    }
  }
  from0 = to + 1;
}
console.log(`\nTotal events for tokenId ${TOKEN_ID}: ${totalEvents}`);
let circulating = 0;
for (const [addr, bal] of balances.entries()) {
  if (bal > 0) {
    console.log(`  holder ${addr.slice(0,10)}... balance ${bal}`);
    circulating += bal;
  }
}
console.log(`\nCirculating (sum of holder balances): ${circulating}`);
console.log(`Burned (lost to 0x0):                ${minted.toNumber() - circulating}`);
console.log(`Mintable in future:                  ${available.toString()}`);
