# Proof Gatekeeper — zkVerify Agent Games

A local build of the **Proof Gatekeeper** agent for [zkVerify Agent Games](https://agentgames.zkverify.io) (Season 01, 21 Oct – 21 Nov 2026).

The agent approves or rejects proof-backed payment requests — but only when a valid **Groth16 (BN128) zero-knowledge proof** backs the decision. The circuit is the judge: it refuses to prove a wrong decision.

## What was proven (locally, snarkjs 0.7.6)

- **Official circuit downloaded + hash-verified:** `circuits/gatekeeper.wasm` (1,755,820 bytes) and `circuits/gatekeeper_final.zkey` (309,750 bytes) from `agentgames.zkverify.io/circuits`. Verification key: Groth16/BN128, 13 public inputs. Official vkHash `0x6b79c6…d77b0`.
- **13 input signals found by probing the WASM** (no `.sym` / `.circom` / `input.json` is served): `minimum, publicBalance, amount, maxTransfer, expiryBlock, currentBlock, recipient, conditionRecipient, decision, taskId, salt, proofVkHash, registeredVkHash`.
- **Valid scenario → proof verifies:** balance 1460 ≥ minimum 1000, amount 500 ≤ cap 1000, VK matches, not expired, recipient matches, decision 1 → `proof_valid.json` (805 bytes), `snarkjs groth16 verify` → **OK** (fullprove ~2.8s).
- **The circuit is the referee:** 5 traps correctly rejected with a valid proof (VK substitution, threshold mismatch, expired condition, recipient mismatch, amount overflow). 2 inconsistent decisions **fail fullprove** — a valid condition with decision 0, and a threshold mismatch with decision 1, both abort with `Assert Failed` in the gatekeeper template. The circuit will not prove a wrong call.
- **Salt is private:** public signal #1 is a commitment over taskId + salt (change the salt, the commitment changes).

Full build log: [`BUILD_LOG.md`](BUILD_LOG.md). The accompanying Creator Track article documents the whole build (`#AgentGames`).

## Reproduce

```bash
npm install          # snarkjs 0.7.6
node probe-signals.js   # re-derive the 13 input signals from the WASM
# generate + verify the valid proof (see BUILD_LOG.md for the exact commands)
npx snarkjs groth16 fullprove input_valid_correct.json circuits/gatekeeper.wasm circuits/gatekeeper_final.zkey proof_valid.json public_valid.json
npx snarkjs groth16 verify verification_key.json public_valid.json proof_valid.json
# → OK
```

The circuits are included in [`circuits/`](circuits/) (official, hash-verified — see BUILD_LOG.md for sha256).

## Honest limits

- This repo is the **local** build and verification loop. The live Gatekeeper track requires a **public HTTPS endpoint** for the platform to POST tasks to — this repo does not host one, so the agent cannot receive live rounds from here.
- Season 01 rounds 01–02 (13–14 Nov) had already closed when this was built; the score is cumulative, so a late start trails by two rounds.
- No on-chain submission was made from this repo.

## Links

- Agent Games: https://agentgames.zkverify.io
- Builder Field Guide: https://agentgames.zkverify.io/build
- Creator Track: https://agentgames.zkverify.io/events/creator-track

#AgentGames
