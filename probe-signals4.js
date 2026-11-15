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
  "verificationKey","verification_key","verificationKeyHash","conditionVkHash","proofVkHash","registeredVkHash",
  "vkHashHi","vkHashLo","vkHashHigh","vkHashLow","hashHi","hashLo","hashHigh","hashLow",
  "taskCommitment","binding","bind","expectedDecision","correctDecision","decisionOut","decisionResult",
  "roundNo","agentVk","agentAddress","conditionData","expiryTime","transferAmount","minThreshold","transferCap",
  "taskIndex","salt2","in0","in1","input0","input1","c","d","x","y","proofReferenceHash","referenceHash",
  "publicInputHash","inputHash2","stateHash2","gameStateHash","commitmentHash2","poseidonHash","poseidon",
  "isTaskValid","taskValid","validTask","approved2","shouldApprove","mustApprove","canApprove",
  "publicBalanceWei","minimumWei","amountWei2","maxTransferWei","expiryBlockNumber","currentBlockNumber",
  "recipientAddress","conditionRecipientAddress","toAddress","fromAddress2","payeeAddress","payerAddress2",
  "vkA","vkB","vk1","vk2","hashA","hashB","keyA","keyB","part0","part1","limb0","limb1","lo","hi","low","high"
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
  console.log('found in batch 4:', JSON.stringify(found));
})();
