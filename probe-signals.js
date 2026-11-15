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
  "minimum","public_balance","publicBalance","amount","max_transfer","maxTransfer",
  "expiry_block","expiryBlock","current_block","currentBlock","recipient","condition_recipient","conditionRecipient",
  "registered_vk","registeredVk","proof_vk","proofVk","proof_tx","proofTx",
  "out","decision","valid","isValid","balance","threshold","cap","expiry","current",
  "vk","vkHash","vk_hash","registered_vk_hash","proof_vk_hash",
  "main.minimum","main.public_balance","main.amount","main.recipient",
  "a","b","in","input","value","publicSignals"
];

(async () => {
  const buffer = fs.readFileSync('circuits/gatekeeper.wasm');
  const calc = await wc.WitnessCalculatorBuilder(buffer, { sanityCheck: false });
  const ex = calc.instance.exports;
  console.log('witness size:', ex.getWitnessSize(), '| input size:', ex.getInputSize());
  for (const name of candidates) {
    const h = fnvHash(name);
    const hMSB = parseInt(h.slice(0, 8), 16);
    const hLSB = parseInt(h.slice(8, 16), 16);
    let size;
    try { size = ex.getInputSignalSize(hMSB, hLSB); } catch (e) { size = 'ERR:' + e.message; }
    if (size !== 0 && size !== -1) console.log(`FOUND  ${name} -> size ${size}`);
    else console.log(`  -    ${name} -> ${size}`);
  }
})();
