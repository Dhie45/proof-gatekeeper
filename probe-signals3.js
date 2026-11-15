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
  "taskHash","task","id","reference","ref","proofId","roundNumber","timestamp","issuedAt","deadlineAt",
  "agent","ownerAddress","expectedRecipient","minAmount","balancePublic","min","max","block","blockHeight",
  "currentHeight","expiryHeight","time","now","result","outcome","isApproved","taskHash2","envelopeHash",
  "payloadHash","commit","comm","root","merkleRoot","nullifier","nullifierHash","vkExpected","vkActual",
  "expectedHash","actualHash","vkRegisteredHash","vkProofHash","registeredHash","proofHash2","tx","hash2",
  "randomness","rand","pepper","publicKey","pubkey","address","verifier","verifierAddress","proofData",
  "gasPrice","tokenAddress","decimals","decisionCode","actionCode","outcomeCode","flag","flags","enabled",
  "check","verified","isVerified","proofValid","vkValid","conditionMet","allValid","pass","passed2",
  "inputHash","state","game","match","competition","season","event","eventName","track","category",
  "senderAddress","recipientAddress","fromAddress","toAddress","payerAddress","payeeAddress",
  "amountWei","valueWei","balanceWei","minimumWei","capWei","limit","maxLimit","transferLimit"
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
  console.log('found in batch 3:', JSON.stringify(found));
})();
