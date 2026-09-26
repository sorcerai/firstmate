# Worker progress and attention: standalone shadow experiment

Goal: detect unsupported completion and wasted worker effort before a human interruption.
[`PLAN.md`](PLAN.md) owns the experiment's scope, preserved boundaries, and promotion criteria.

This directory is opt-in and inert.
Nothing in Firstmate's runtime, hooks, supervision, `bin/`, or CI imports or runs it.
It runs only when a person invokes it deliberately from this directory.
Outputs are advisory, never action commands.

## Layout

The bundle's internal layout is kept intact, so `cli.mjs` and `test/helpers.mjs` resolve paths unchanged.

- `experiments/attention/profile.json` - input contract and the semantic question.
- `experiments/attention/fixtures.json` - synthetic smoke cases with separate reference labels.
- `lib/` - request projection, preflight guards, strict typed response parsing, bounded transport, abstention, and secret-free advisory receipts.
- `test/` - offline behavior and transport tests.
- `manifest.json` - the experiment registry `cli.mjs` reads.

## Run locally

Requires Node.js 22 or newer and no package installation.

```bash
node --test test/experiment.test.mjs
node cli.mjs
```

The default invocation is an offline contract check that makes zero provider requests, even with credentials present.
Its report says `"mode": "offline"` and `"providerRequestsStarted": 0`.

## Explicit optional live smoke

A live call requires `--live`, an explicit `--max-calls` budget, and `TYPESAFE_API_KEY` in the environment.
Review the bundled synthetic inputs before running it.

```bash
node cli.mjs --profile attention --live --max-calls 3 > smoke-results.local.json
```

No secret is stored here, and this example is not a record of a completed live call.
`--max-calls` is a global process budget; every started request, including a failed one, consumes a slot.
A provider error stops the batch.

Offline mocked tests are not evidence of live accuracy, speed, or profitability.
Threshold 0.9 is provisional and is not a correctness probability.

## Rollback

Leave the experiment unused, or delete this directory and its entries in `docs/documentation-audiences.json`.
No migration, data deletion, or production recovery is required.
