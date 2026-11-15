# Build log — zkVerify Agent Games, Proof Gatekeeper (local loop)
Date: 15 Nov 2026 (~16:38–16:45 WIB). All work local; no account, no registration, no on-chain submission.

## Sources read (official pages, fetched 15 Nov 2026)
- https://agentgames.zkverify.io/build (Builder Field Guide)
- https://agentgames.zkverify.io/events/creator-track (eligibility: #AgentGames in every entry; tag @ZKVProtocol if on X; manual review: technical substance, clarity, zkVerify relevance, originality)
- https://agentgames.zkverify.io/rules (prize eligibility: connected GitHub + wallet; agent = public HTTPS endpoint, no localhost/private IP/custom ports; one GitHub per competition account)
- https://agentgames.zkverify.io/events/proof-gatekeeper (sample task, 7 traps, score model, 8 rounds 13–21 Nov, 4PM–2AM IST)

## Circuit artifacts (downloaded from agentgames.zkverify.io)
- circuits/gatekeeper.wasm — 1,755,820 bytes, sha256 be00aefe3c8ba910951a242f50e55937bf82a0375ad4b69c2ef10629ab92764f
- circuits/gatekeeper_final.zkey — 309,750 bytes, sha256 adfe95a439a7063a82a4967ef026d2dd6857a4d02c63b3caf63dac02e01af80d
- /api/circuit-info: gatekeeper vkHash 0x6b79c6012a6d8651f3e13bc4d2a20370280ab49700c90c5316d4168bfbad77b0
  - decimal 48612629870452471351995307734854562318858385272285416761371572079729769805744 (255-bit > BN128 field prime)
  - mod p: 4836144126773920907502496244340012141761656471453348073975163706578152814510
- snarkjs 0.7.6, Node v24.22.1. Verification key: groth16, bn128, nPublic 13. Witness size 647, input size 13.
- 404 (not served): gatekeeper.sym, gatekeeper.circom, gatekeeper.r1cs, verification_key.json, input.json

## 13 input signals (found by probing the WASM via circom_runtime getInputSignalSize + FNV-1a hash)
minimum, publicBalance, amount, maxTransfer, expiryBlock, currentBlock, recipient,
conditionRecipient, decision, taskId, salt, proofVkHash, registeredVkHash — all size 1, camelCase.
Scripts: probe-signals.js, probe-signals2.js, probe-signals3.js, probe-signals4.js.

## Valid scenario (input_valid_correct.json)
minimum 1000, publicBalance 1460, amount 500, maxTransfer 1000, expiryBlock 19842201,
currentBlock 19832000, recipient = conditionRecipient = 0x1111…1111
(97433442488726861213578988847752201310395502865), decision 1, taskId 24, salt 12345,
proofVkHash = registeredVkHash = gatekeeper vkHash (decimal above).
- fullprove ~2.8s → proof_correct.json 805 bytes; `snarkjs groth16 verify` → OK.
- public signals: [commitment 19833346495721727950822528393279092831530130886476995302562363810213804959230,
  proofVkHash mod p, registeredVkHash mod p, 1000, 1460, 19842201, 19832000,
  recipient, conditionRecipient, 500, 1000, 1, 24]. Salt is private (not in public signals).

## Control experiments (all fullprove + verify)
- salt 99999 (same otherwise): verify OK; commitment changes to
  18906216470960525730565370558806070173486919347776737444443727032563564691259 → signal[0] is a taskId+salt commitment.
- VK_SUBSTITUTION (proofVkHash = vfyPolicy vkHash 0x6c56509f…, decision 0): verify OK (802 bytes).
- THRESHOLD_MISMATCH (publicBalance 500, decision 0): verify OK (804 bytes).
- EXPIRED_CONDITION (currentBlock 19850000, decision 0): verify OK (804 bytes).
- RECIPIENT_MISMATCH (conditionRecipient different, decision 0): verify OK (803 bytes).
- AMOUNT_OVERFLOW (amount 1500, decision 0): verify OK (806 bytes).
- Valid conditions + decision 0: fullprove FAILED — "Assert Failed. Error in template GatekeeperEvaluation_79 line: 102".
- THRESHOLD_MISMATCH + decision 1: fullprove FAILED — same assert, line 102.
Conclusion: the circuit enforces decision == computed validity; inconsistent decisions cannot be proven.

## Endpoint blocker (verified, not assumed)
- hostname -I: 198.19.0.2 (CGNAT) + fd8b:… ULA IPv6; egress via proxy only; listening sockets only on
  127.0.0.1/[::1]. No public inbound address → a live HTTPS agent endpoint cannot be hosted here.
- Rounds 01–02 (13–14 Nov) already closed with results; scores cumulative. Joining from round 03 means starting 2 rounds behind.

## Deliverable
- Draft article (English): ~/workspace/zkverify-agent-games/creator-track/article.md (17,394 bytes)
- This log + all inputs/proofs/publics: ~/workspace/zkverify-agent-games/gatekeeper-build/
