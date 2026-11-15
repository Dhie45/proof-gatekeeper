# Don't Trust the Agent. Verify It. — Building a Proof Gatekeeper for zkVerify Agent Games

#AgentGames

**TL;DR:** I built the local half of a Proof Gatekeeper agent for zkVerify's Agent Games (Season 01, 21 Oct – 21 Nov 2026): I downloaded the official Groth16 circuit, reverse-engineered its 13 input signals by probing the WASM, generated a real proof for a valid payment decision, verified it with `snarkjs`, and then proved — by making the prover fail — that the circuit itself refuses to bless a wrong decision. The one thing I could not do is the live half: my machine has no public address, so it can never be the HTTPS endpoint the competition requires. This article is the record of what worked, what failed, and what the circuit actually enforces.

**Update (15 Nov 2026):** the Proof Gatekeeper agent has since been registered on the Agent Games dashboard (track: Proof Gatekeeper only; repo: https://github.com/Dhie45/proof-gatekeeper). A public HTTPS endpoint is being set up so it can receive tasks daily.

---

## 1. What Agent Games is

[Agent Games](https://agentgames.zkverify.io) is zkVerify's Season 01 tournament for AI agents (21 October – 21 November 2026). Four tracks share a 400,000 VFY prize pool — 100,000 VFY per track, split 50,000 / 30,000 / 20,000 across the top three. Every result is verified on-chain with zero-knowledge proofs; the tagline is "AI agents compete. Proofs decide. Results are on-chain."

The four tracks are:

1. **Proof Gatekeeper** — your agent acts as a payment guard: receive a task, decide APPROVE or REJECT within 60 seconds, and prove the decision with a zero-knowledge proof.
2. **Steal the VFY** — head-to-head agent matches, 20 turns each, starting from 100 VFY.
3. **Wildcard** — build any type of Web3 agent.
4. **Creator Track** — document your build in public (this article).

I entered the Proof Gatekeeper track — the one where your agent *is* the gatekeeper for payments — and this is what I built and what I learned.

## 2. The job: approve or reject, with a proof

The [Proof Gatekeeper event page](https://agentgames.zkverify.io/events/proof-gatekeeper) publishes the whole game in advance. Each task is a structured decision — outcome and reasoning are both recorded — and the agent has a 60-second window to answer. Eight daily scored rounds run 13–21 November 2026, 4:00 PM–2:00 AM IST each day, eight tasks per agent per round, scores cumulative.

A sample task payload:

```json
{
  "type": "agent-games.proof-gatekeeper.v1",
  "task_id": "gk_24_9d1",
  "mode": "competition",
  "input": {
    "registered_vk": "0x7d3a...f291",
    "proof_vk": "0xa4c1...b8ff",
    "minimum": "1000",
    "public_balance": "1460",
    "expiry_block": 19842201,
    "current_block": 19832000,
    "recipient": "0xDe42...9f01",
    "condition_recipient": "0xDe42...9f01",
    "amount": "500",
    "max_transfer": "1000",
    "proof_tx": "0xa4c1...8ff1"
  }
}
```

And the trap encyclopedia — all seven detectable trap varieties, documented before the competition opens:

| Trap | Correct call | Share of tasks |
|---|---|---|
| VALID_CONDITION | APPROVE | ~50% |
| VK_SUBSTITUTION (proof verifies, but its VK ≠ registered VK) | REJECT | ~13% |
| THRESHOLD_MISMATCH (balance below minimum) | REJECT | ~8% |
| PROOF_REUSED (proof reference already accepted) | REJECT | ~11% |
| EXPIRED_CONDITION (block height past expiry) | REJECT | ~6% |
| RECIPIENT_MISMATCH | REJECT | ~6% |
| AMOUNT_OVERFLOW (amount above the transfer cap) | REJECT | ~6% |

The score model is deliberately asymmetric: a correct APPROVE or correct REJECT earns **+12**; an incorrect APPROVE costs **−6** (approving a trap is worse than being cautious); an incorrect REJECT costs **−3**; a timeout costs **−2**; and a provable task answered without a valid Groth16 proof costs an extra **−2**, plus you lose the reliability bonus (+0 to +5, pro-rated by the share of provable tasks whose proof verified). The test is whether your agent checks *every* field — not whether it can guess.

## 3. The circuit: what I downloaded

The [Builder Field Guide](https://agentgames.zkverify.io/build) says both competitions use Groth16/BN128 circuits compiled with Circom 2.x, and points at the artifacts. The circuit registry is served as JSON from `/api/circuit-info`:

```json
{
  "network": "mainnet",
  "circuits": {
    "gatekeeper": {
      "vkHash": "0x6b79c6012a6d8651f3e13bc4d2a20370280ab49700c90c5316d4168bfbad77b0",
      "artifacts": {
        "wasm": "https://agentgames.zkverify.io/circuits/gatekeeper.wasm",
        "zkey": "https://agentgames.zkverify.io/circuits/gatekeeper_final.zkey"
      }
    }
  }
}
```

What I downloaded on 15 November 2026 (and verified by hash):

| File | Size | SHA-256 |
|---|---|---|
| `gatekeeper.wasm` | 1,755,820 bytes | `be00aefe3c8ba910951a242f50e55937bf82a0375ad4b69c2ef10629ab92764f` |
| `gatekeeper_final.zkey` | 309,750 bytes | `adfe95a439a7063a82a4967ef026d2dd6857a4d02c63b3caf63dac02e01af80d` |

Exporting the verification key with snarkjs 0.7.6:

- Protocol: **Groth16**, curve: **BN128**
- **nPublic: 13** public signals
- Witness size: **647**, input size: **13**

One detail worth knowing: the registered `vkHash` is a 255-bit number (`48612629870452471351995307734854562318858385272285416761371572079729769805744`), which is *larger* than the BN128 scalar field prime. snarkjs reduces it modulo the prime on input, so the value the circuit actually sees is `4836144126773920907502496244340012141761656471453348073975163706578152814510`. Both sides — prover and verifier — apply the same reduction, so the comparison still works. I confirmed this by checking the public signals of my proof (more below).

## 4. The part nobody documents: the circuit's 13 input signals

Here is where the work got interesting. The official pages publish the *task* fields, but not the *circuit* inputs. No `.sym` file, no `.circom` source, no `input.json` template is served — I checked (`gatekeeper.sym`, `gatekeeper.circom`, `gatekeeper.r1cs`, `verification_key.json`, `input.json` all return 404). The task payload uses `snake_case` (`public_balance`, `max_transfer`); the circuit, it turns out, does not.

So I probed the WASM itself. Circom's witness calculator exposes `getInputSignalSize` keyed by the FNV-1a hash of the signal name, so I wrote a small script that asks the loaded WASM, for each candidate name, "are you an input, and how big are you?" Four rounds of candidates later, all 13 inputs were found — and every one of them is **camelCase**:

| # | Input signal | Size | Role |
|---|---|---|---|
| 1 | `minimum` | 1 | Required minimum balance |
| 2 | `publicBalance` | 1 | Balance disclosed in the proof |
| 3 | `amount` | 1 | Requested payment amount |
| 4 | `maxTransfer` | 1 | Single-transfer cap |
| 5 | `expiryBlock` | 1 | Condition expiry (block height) |
| 6 | `currentBlock` | 1 | Block height at decision time |
| 7 | `recipient` | 1 | Recipient committed in the proof |
| 8 | `conditionRecipient` | 1 | Recipient on the payment condition |
| 9 | `decision` | 1 | 1 = APPROVE, 0 = REJECT |
| 10 | `taskId` | 1 | Binds the proof to a task |
| 11 | `salt` | 1 | Private blinding value (see §6) |
| 12 | `proofVkHash` | 1 | VK hash of the submitted proof |
| 13 | `registeredVkHash` | 1 | VK hash of the registered condition |

Two things surprised me. First, the verification-key check is *inside* the circuit: `proofVkHash` and `registeredVkHash` are both circuit inputs, so the VK_SUBSTITUTION trap is caught by the proof itself, not only by the agent's off-chain checks. Second, `decision` is an *input* — the circuit doesn't compute the decision for you, it constrains the decision you submit. That distinction is the whole story of the next section.

## 5. The proof loop, run for real

With the inputs known, I ran the full loop locally with snarkjs 0.7.6 (Node v24.22.1). The valid scenario mirrors the official sample task: public balance 1460 against a minimum of 1000, amount 500 against a cap of 1000, recipient matching the condition, expiry block 19842201 ahead of current block 19832000, proof VK equal to the registered VK, `taskId` 24 (from the sample task id `gk_24_9d1`), `salt` 12345, decision 1 (APPROVE).

```bash
snarkjs groth16 fullprove input.json circuits/gatekeeper.wasm \
  circuits/gatekeeper_final.zkey proof.json public.json
# ~2.8 s on this machine
snarkjs groth16 verify verification_key.json public.json proof.json
# [INFO] snarkJS: OK!
```

The proof is **805 bytes** of JSON (`pi_a`, `pi_b`, `pi_c` over BN128). The 13 public signals, in order, are:

```
[
 "19833346495721727950822528393279092831530130886476995302562363810213804959230",
 "4836144126773920907502496244340012141761656471453348073975163706578152814510",
 "4836144126773920907502496244340012141761656471453348073975163706578152814510",
 "1000", "1460", "19842201", "19832000",
 "97433442488726861213578988847752201310395502865",
 "97433442488726861213578988847752201310395502865",
 "500", "1000", "1", "24"
]
```

That is: `[commitment, proofVkHash, registeredVkHash, minimum, publicBalance, expiryBlock, currentBlock, recipient, conditionRecipient, amount, maxTransfer, decision, taskId]`. Positions 2 and 3 are the registered vkHash reduced modulo the field prime — exactly the value I computed in §3, which confirms the VK inputs land where I think they do. And `salt` is nowhere in the public signals: it is a *private* input.

## 6. The circuit is the referee — I proved it by failing

A proof that verifies for a valid scenario is the minimum. The real question is whether the circuit enforces the *decision*. So I ran eight scenarios through the same loop — the valid case, four trap cases with the correct REJECT, and two deliberately inconsistent decisions:

| Scenario | Decision submitted | Result |
|---|---|---|
| Valid condition (all checks pass) | 1 (APPROVE) | Proof 805 bytes, `snarkjs groth16 verify` → **OK** |
| Valid condition, decision REJECT | 0 | **fullprove FAILED** — `Assert Failed. Error in template GatekeeperEvaluation_79 line: 102` |
| VK_SUBSTITUTION (proof VK ≠ registered VK) | 0 (REJECT) | Proof 802 bytes, verify → **OK** |
| THRESHOLD_MISMATCH (balance 500 < minimum 1000) | 0 (REJECT) | Proof 804 bytes, verify → **OK** |
| THRESHOLD_MISMATCH, decision APPROVE | 1 | **fullprove FAILED** — same assert, line 102 |
| EXPIRED_CONDITION (current block 19850000 > expiry 19842201) | 0 (REJECT) | Proof 804 bytes, verify → **OK** |
| RECIPIENT_MISMATCH | 0 (REJECT) | Proof 803 bytes, verify → **OK** |
| AMOUNT_OVERFLOW (amount 1500 > cap 1000) | 0 (REJECT) | Proof 806 bytes, verify → **OK** |

(The 802–807 byte range is just JSON serialization — the numbers have different digit lengths. The protocol is identical.)

The two failures are the finding. The circuit's template is `GatekeeperEvaluation_79`, and its assert at line 102 refuses to generate a proof whenever the submitted decision disagrees with the conditions the circuit itself evaluates. You cannot get a verifying proof for approving a trap, and you cannot get one for rejecting a genuinely valid payment either. A valid proof is necessary but not sufficient — and the circuit makes sure of it from the inside. The platform re-verifying my proof against its own registered key is the second lock; the circuit refusing to prove a lie is the first.

The salt finding is the other half of the story. Public signal #1 — the commitment — changes when the salt changes and nothing else does: with `salt` 12345 it is `19833346495721727950822528393279092831530130886476995302562363810213804959230`; with `salt` 99999 (same task, same decision) it becomes `18906216470960525730565370558806070173486919347776737444443727032563564691259`. The salt is private, so the commitment is the public anchor that binds a proof to one task without revealing the blinding value. Reusing a proof for another task would mean reusing its commitment — and the platform's seen-set (the PROOF_REUSED trap) is exactly what catches that.

## 7. What I did not do — and the blocker that stopped the live half

Two honest boundaries:

**I did not submit anything on-chain.** The proofs above were verified locally with snarkjs against the exported verification key. I did not push a proof to zkVerify via Kurier (which needs a mainnet API key) or zkVerifyJS (which needs a funded account), and I did not register an agent or run a practice task. The local loop is real; the on-chain submission is not something I attempted.

**I cannot host the live agent from this machine.** The competition requires a public HTTPS endpoint — no localhost, no private IP ranges, no custom ports — that answers signed tasks within 60 seconds. My machine has no public address: its interfaces are `198.19.0.2` (CGNAT range) and a ULA IPv6 address, its egress goes through a proxy, and the only listening sockets are on localhost. There is no way for the platform to POST a task to it. That is a hard, environmental blocker, not a code problem — and it is the same wall another builder documented earlier the same day. A live Proof Gatekeeper entry needs a publicly reachable host (a VPS, a tunnel, or a cloud function), and that host has to stay up: the rules say an agent offline when a task arrives forfeits that task.

There is also a timing reality: scored rounds 01 and 02 (13–14 November) are already closed with results published, and scores are cumulative across all eight rounds. Joining from round 03 (15 November) onward means starting two rounds behind the field. That doesn't make it pointless — a strong run across the remaining six rounds plus the reliability bonus is still a real score — but it does change the odds, and it should be stated plainly.

## 8. Why this matters beyond one tournament

The design point of Agent Games is not the 400,000 VFY. It is the shape of the problem: an AI agent that can move money, approve payments, and act on its own is only useful if someone else can check its work without re-doing it — and without trusting it. "Don't trust the agent. Verify it" is the whole pitch, and the Gatekeeper circuit is a clean instance of it:

- **The decision is checked, not the reasoning.** The circuit never sees *why* the agent decided; it checks whether the decision matches the facts (threshold, recipient, expiry, VK, cap). That is the right boundary: the agent keeps its judgement private, the network keeps the verdict.
- **A wrong decision is unprovable, not just punishable.** The −6 for approving a trap is the policy layer; the assert at line 102 is the cryptographic layer. Both have to exist, because a penalty only matters after the damage.
- **The proof is bound to the task.** `taskId` + `salt` → commitment means a proof cannot be replayed onto a different task, and the seen-set rule turns that into a scored trap.

If agents are going to hold keys and move value — and they already do — this is the minimum viable shape of accountability: every consequential decision carries a proof that anyone can verify, and the proof cannot be manufactured for a decision the agent didn't actually justify. zkVerify's bet is that verification becomes a commodity primitive, like TLS: boring, cheap, and everywhere. After building the local half of one gatekeeper, I think the bet is pointed in the right direction — even if my own agent will have to live on a machine with a public address before it can play.

## 9. Reproduce it

All of this was done on 15 November 2026 with public artifacts only — no account, no key, no registration needed for the local loop:

```bash
# 1. Download the official circuit artifacts
curl -O https://agentgames.zkverify.io/circuits/gatekeeper.wasm
curl -O https://agentgames.zkverify.io/circuits/gatekeeper_final.zkey
# vkHash (from https://agentgames.zkverify.io/api/circuit-info):
# 0x6b79c6012a6d8651f3e13bc4d2a20370280ab49700c90c5316d4168bfbad77b0

# 2. Install snarkjs and export the verification key
npm install snarkjs   # 0.7.6
snarkjs zkey export verificationkey gatekeeper_final.zkey verification_key.json
# protocol: groth16, curve: bn128, nPublic: 13

# 3. Prove a valid APPROVE (input.json uses the 13 camelCase signals
#    from §4; recipient/conditionRecipient must match, proofVkHash must
#    equal registeredVkHash, balance >= minimum, amount <= maxTransfer,
#    currentBlock < expiryBlock, decision "1")
snarkjs groth16 fullprove input.json gatekeeper.wasm \
  gatekeeper_final.zkey proof.json public.json
snarkjs groth16 verify verification_key.json public.json proof.json
# [INFO] snarkJS: OK!
```

To find the signal names yourself: load `gatekeeper.wasm` with `circom_runtime`'s `WitnessCalculatorBuilder` and call `getInputSignalSize` with the FNV-1a hash of each candidate name — a size of 1 means "input signal", 0 means "not a signal". That is how the table in §4 was produced; no `.sym` file is needed.

---

*Links: [Agent Games](https://agentgames.zkverify.io) · [Builder Field Guide](https://agentgames.zkverify.io/build) · [Proof Gatekeeper](https://agentgames.zkverify.io/events/proof-gatekeeper) · [Creator Track](https://agentgames.zkverify.io/events/creator-track) · [Rules](https://agentgames.zkverify.io/rules) · [Circuit info (JSON)](https://agentgames.zkverify.io/api/circuit-info)*

*Season 01 runs 21 October – 21 November 2026; judging 22–30 November. Creator Track entries must include #AgentGames (and tag @ZKVProtocol if posted on X). This article documents work done locally on 15 November 2026; the Proof Gatekeeper agent was registered later that day (see update above); no proof was submitted on-chain.*
