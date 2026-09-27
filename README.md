# Countersign

A payment firewall for AI agents — built in 24 hours at &hacks (William & Mary).

> The agent proposes. Policy and people decide. Only the signer can pay.

See [SPEC.md](./SPEC.md) for the full product spec and [CLAUDE.md](./CLAUDE.md) for the engineering
handbook (stack, commands, folder map, non-negotiables). Build progress and decisions are tracked in
[docs/PROGRESS.md](./docs/PROGRESS.md).

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in secrets
npm run doctor                # verify environment
npm run dev
```
