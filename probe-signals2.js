const fs = require('fs');
const wc = require('circom_runtime');
function fnvHash(str) {
    const uint64_max = BigInt(2) ** BigInt(64);
    let hash = BigInt("0xCBF29CE484222325");
    for (let i = 0; i < str.length; i++) {
        hash ^= BigInt(str[i].charCodeAt(0));
        hash *= BigInt(0x100000001B3);
        hash %= uint64_max;
    }
    let shash = hash.toString(16);
    let n = 16 - shash.length;
    shash = "0".repeat(n).concat(shash);
    return shash;
}
const candidates = [
  "taskId","task_id","nonce","salt","chainId","chain_id","blockNumber","proofRef","proofReference","proofHash",
  "txHash","tx_hash","conditionHash","condition","conditionId","agentId","owner","signer","signature","deadline",
  "approved","approve","reject","reason","reasonCode","vkRegistered","vkProof","expectedVk","actualVk","conditionVk",
  "hash","commitment","commitmentHash","seed","index","round","roundId","eventId","matchId","score","fee","value",
  "sender","from","to","payer","payee","token","version","protocolVersion","domain","networkId",
  "registeredVk0","registeredVk1","proofVk0","proofVk1","vk0","vk1","vkHi","vkLo",
  "recipientHi","recipientLo","conditionRecipientHi","conditionRecipientLo",
  "isValidCondition","validCondition","conditionValid","checkPassed","passed",
  "publicSignalsHash","inputsHash","stateHash","gameState","turn","action","policy","strategy","strategyHash",
  "minBalance","maxAmount","transferCap","balanceMin","amountMax","blockExpiry","blockCurrent"
];
(async () => {
  const buffer = fs.readFileSync('circuits/gatekeeper.wasm');
  const calc = await wc.WitnessCalculatorBuilder(buffer, { sanityCheck: false });
  const ex = calc.instance.exports;
  const found = [];
  for (const name of candidates) {
    const h = fnvHash(name);
    const size = ex.getInputSignalSize(parseInt(h.slice(0,8),16), parseInt(h.slice(8,16),16));
    if (size !== 0 && size !== -1) { console.log(`FOUND  ${name} -> size ${size}`); found.push(name); }
  }
  console.log('found in batch 2:', JSON.stringify(found));
})();
