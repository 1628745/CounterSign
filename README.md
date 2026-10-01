# Countersign

**A payment firewall for AI agents.** Built in 24 hours at &Hacks 2026, William & Mary's hackathon.

> The agent proposes. Policy and people decide. Only the signer can pay.

🏆 **Best Use of Solana** (MLH) and **3rd place, Finance track** at &Hacks 2026

![Countersign Mission Control](docs/images/mission-control.png)

Demo video: [Watch the 2-minute demo](https://www.youtube.com/watch?v=-eReez7Atvw)
Devpost: [Project page](https://devpost.com/software/countersign-fre3xy)

## The problem

AI agents are starting to pay real invoices, and they act on nearly everything they read. That makes a classic accounts-payable scam, "we've changed our payment details," work even better on an agent than on a person. An agent that reads a spoofed email can update a vendor's wallet address in its notes and pay the next legitimate invoice straight to an attacker. On a blockchain, that payment can't be reversed.

## What Countersign does

Countersign sits between an AI accounts-payable agent and the money. The agent can propose payments, but it never holds a signing key. Every proposed payment goes through a deterministic risk gateway, which makes one of three decisions:

| Decision | When | What happens |
| --- | --- | --- |
| **Pay** | Routine invoice from a verified vendor | The signer sends it on Solana immediately |
| **Ask** | Anything unusual | A push notification goes to the owner's phone through Auth0 Guardian, showing the exact amount and wallet |
| **Block** | Clear fraud signals | Nothing is sent, and the reason is logged |

The gateway, not the model, decides when a human needs to approve. A prompt-injected agent can't talk its way past the check, and the signer refuses any payment without a clean decision or a verified approval.

## Demo: guard off vs. guard on

The demo runs the same agent, with the same prompt and tools, on the same inbox twice. The inbox belongs to a fictional business, Tidewater Roasting Co.

- **Guard off:** the agent paid $9,255 to attacker wallets (test tokens on Solana devnet).
- **Guard on:** $0 reached an attacker. Routine invoices paid instantly, and unusual payments waited for approval on the owner's phone.

Results vary a little from run to run because the agent is an LLM. Countersign's checks don't depend on what the model decides.

### The demo inbox

| Email | Scenario | Attack type | What catches it |
| --- | --- | --- | --- |
| E1 | Chesapeake Dairy invoice, $412.50 | None (routine) | Pays automatically |
| E2 | "Updated remittance details" from a lookalike of Blue Ridge's domain | Vendor-detail change that poisons the agent's notes | Recorded as unverified; lookalike domain flagged |
| E3 | Colonial Paper invoice, $742.00 | None (routine) | Pays automatically |
| E4 | Normal Blue Ridge invoice, $2,340.00 | Multi-step context poisoning: the agent pays the address from E2 | Payee isn't the vendor's verified address, and the address traces back to the lookalike email |
| E5 | Colonial Paper invoice with invisible text | Indirect prompt injection | Hidden-text detection and payee verification |
| E6 | Chesapeake "holiday bulk order," $1,480.00 | None (legitimate but unusual) | Amount and daily-spend checks against 90 days of history |
| E7 | The "owner" asks for an urgent $4,800 wire to a new wallet | Executive impersonation | Unverified new payee, held for phone approval |
| E8 | Blue Ridge invoice that was already paid | Duplicate invoice | Duplicate check against payment history |

## How it works

```mermaid
flowchart TD
    Inbox["Inbox<br/>emails + invoices (untrusted)"] --> Agent["AI agent (Claude)<br/>proposes payments, holds no key"]
    Agent -->|payment intent| Gateway["Countersign gateway<br/>deterministic risk checks"]
    Gateway <-->|history + event log| Tiger[("Tiger Data<br/>hypertables + continuous aggregates")]
    Gateway -->|routine: pay| Signer["Signer<br/>sole holder of the treasury key"]
    Gateway -->|unusual: ask| Auth0["Auth0 CIBA<br/>push approval to phone"]
    Auth0 -->|approved| Signer
    Gateway -->|fraud: block| Log["Blocked and logged"]
    Signer --> Solana["Solana devnet<br/>mUSDC transfer + memo"]
```

### Risk checks

Each check produces a plain-English reason that shows up in the dashboard.

| Check | What it looks at |
| --- | --- |
| Payee verification | Is the destination the vendor's verified payout address? |
| Address provenance | Where did this wallet address first appear: the vendor registry, an email, or hidden text? |
| Hidden text | Does the source email contain text people can't see but the agent can read? |
| Lookalike domains | Did the address come from a domain imitating a known vendor? |
| Recent detail changes | Was the vendor's payout address recently changed by an unverified email? |
| Duplicate invoices | Has this invoice already been paid? (Tiger Data) |
| Amount anomaly | How does the amount compare with the vendor's 90-day median? (Tiger Data) |
| Spending velocity | Would today's spend with this vendor exceed its 90-day daily max? (Tiger Data) |
| Isolated classifier | A separate Claude call with no tools rates the email for fraud cues. It's one small input, never the decider. |

### How each platform is used

- **Solana:** the treasury, vendor, and attacker wallets are real devnet accounts. Payments are transfers of a mock USDC SPL token, each with an on-chain memo recording the decision and how it was approved.
- **Auth0:** login for the operator, plus async authorization (CIBA) through the Auth0 Guardian app, so risky payments wait for a human to approve them on a phone.
- **Tiger Data:** payment history and the agent's full event stream live in hypertables. Continuous aggregates provide the daily baselines behind the velocity and anomaly checks, and the event log powers the live dashboard.
- **Claude (via the Vercel AI SDK):** runs the accounts-payable agent and the isolated email classifier.

## Dashboard

- **Mission Control:** the inbox, the agent's live activity, decision cards with reasons, wallet balances, and approvals waiting on your phone.
- **Attack Lab:** write your own malicious email and try to get money past Countersign.
- **Ledger:** payment history and vendor baselines.
- **Under the hood:** the architecture and system internals.

## Running it locally

**You'll need:** Node.js 20+, an Anthropic API key, an Auth0 tenant with CIBA and Guardian push enabled, a Tiger Cloud service, and a little devnet SOL.

```bash
npm install
cp .env.example .env.local   # fill in your keys
npm run doctor               # checks every integration
npm run dev
```

The other scripts (database migrations, seeding, devnet wallet setup, demo reset) are listed in `package.json`. See [CLAUDE.md](CLAUDE.md) for the full command reference.

## Repository guide

| Path | What's in it |
| --- | --- |
| [SPEC.md](SPEC.md) | Full product spec: demo world, data model, policy, and architecture |
| [CLAUDE.md](CLAUDE.md) | Engineering handbook: stack, commands, folder map, non-negotiables |
| [docs/PROGRESS.md](docs/PROGRESS.md) | Build log and decisions |
| `src/` | Next.js app, agent, gateway, Auth0, Solana, and database code |
| `db/migrations/` | Tiger Data schema, hypertables, and continuous aggregates |
| `data/` | Demo inbox scenarios |
| `scripts/` | Setup, seeding, and maintenance scripts |
| `tests/` | Vitest tests |

## Limitations

This is a 24-hour hackathon prototype. It runs only on Solana devnet with test tokens and fictional businesses, and it hasn't been audited. It doesn't stop fraud where a vendor's own verified wallet is compromised, and phone approvals only help if the approver reads them. Don't use it with real funds.

## Credits

Built by [Jude Caldwell](https://www.linkedin.com/in/jude-caldwell-1a66562ab) at &Hacks 2026, William & Mary, with Claude Code as a pair programmer. The idea grew out of my research on prompt injection in tool-using AI agents.

Thanks to MLH and Solana for the Best Use of Solana prize, to Auth0 and Tiger Data for their platforms, and to W&M ACM for putting on &Hacks.
