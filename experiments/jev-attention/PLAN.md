# Worker progress and attention implementation and integration plan

## PR boundary: attention

- Use a dedicated branch: `experiment/jev-attention`.
- Open a draft PR containing **only `attention`**, its required tests/docs and narrowly necessary wiring.
  Do not bundle other experiments even if they share this repository.
- Keep tests, review, the opt-in setting and rollback scoped to this experiment.
- Start from the verified current default branch, or explicitly link a genuine shared-prerequisite PR and its base.
  Never include unrelated experiment commits.
- Shared changes required by multiple experiments belong in a separate minimal prerequisite PR, not this feature PR.
  Do not introduce a prerequisite unless current source requires it.
- Repository owner, full base/head SHAs, real dependencies and PR URL must be resolved from authorized current source.

**Approved:** September 18, 2026, as a shadow experiment.
**Owner:** repo-authorized implementation agent; Aria approves any later production promotion.
No due date or autonomous task was scheduled.

**Goal:** Detect unsupported completion and wasted worker effort before a human interruption.
**Home:** `sorcerai/firstmate`, at `experiments/jev-attention/`.
**Input mapping:** the profile's input fields are not yet mapped to a real Firstmate evidence interface; fixtures are synthetic.

## Local deliverable

- `profile.json`: explicit input contract and semantic questions.
- `fixtures.json`: independent synthetic smoke cases with separate reference labels.
- Packaged runtime: request projection, preflight guards, strict typed response parsing, bounded transport, abstention and secret-free advisory receipts.
- `test/`: offline behavior and transport tests.

## Preserved boundaries

- No process control, task dispatch, or notification is executed.
- Credential errors and process liveness remain deterministic.
- No production hooks, network access by default, release gate or action execution.
- Threshold 0.9 is provisional, not a correctness probability.

## Repository execution

1. Inspect the existing approved repository, current default branch SHA, open PRs, instruction files, real input/evidence interfaces and test framework.
   Do not use old design documents as current source truth.
2. Run and record the existing baseline.
   On failure, distinguish pre-existing failures from this experiment; do not weaken tests.
3. In an isolated non-default branch, copy only this self-contained experiment or port it to an existing equivalent boundary.
   No new remote repo, sibling-runtime import or framework migration.
4. Capture trusted host state using the existing evidence interface.
   Run the preflight guard before any model call.
   Bind results to the exact input hash.
5. Run the package tests and current repository changed-path tests.
   Demonstrate disabled behavior and zero effect on existing gates, permissions or execution.
6. Obtain independent review through an authorized route.
   A model-generated recommendation must never grant authority.
7. Open a draft PR through the existing No-Mistakes/AXI route when available; otherwise use an already authorized repo write route.
   Never broaden an allowlist, answer ask-user automatically, merge, deploy or push to the default branch.
8. Return real PR URL, base SHA, full head SHA, test/CI receipts and live-inference status.
   Never mark a draft description as an opened PR.

## Model evaluation, separate from software tests

Replace smoke fixtures with permitted real examples.
Human-label a development set and a separate grouped/time-held-out test set.
Keep near-duplicate businesses/tasks together.
Calibrate only on development data; compare rules-only and the currently approved model on identical evidence.
Preserve uncertain/missing state and report accepted accuracy AND coverage with sample sizes.
Inspect high-cost false negatives/positives separately.

- Reviewer agreement
- False interruptions
- Missed stalled runs
- Full-task cost

**Promotion:** requires measured held-out usefulness and a separately reviewed integration.
This package does not enable a production policy.
