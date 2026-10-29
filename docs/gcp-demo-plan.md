# Coding Harness: minimal GCP demo plan

## Objective

Run a single-user demo under `aadityavton@gmail.com`. The user submits a public GitHub HTTPS URL, an optional branch, and an instruction. The VM clones the repository, runs Claude Code using **Gemini** through Vertex AI, reports progress, and returns a downloadable Git patch. The app does not push changes to GitHub.

## Architecture

1. Use the dedicated project `coding-harness-demo-20261029`, linked to the account's existing billing account, separate from its other projects and production VM.
2. Start with one `e2-micro` VM in `us-central1-a`, a 30 GB standard persistent boot disk, and swap. Run one task at a time. This is free-tier eligible if the account's aggregate usage meets Google's conditions, but its 1 GB of RAM and limited CPU can make builds and coding tasks slow or unreliable. Measure before considering `e2-small`.
3. Run the existing Next.js frontend, Express worker, PostgreSQL, Redis, nginx, Claude Code, and a local LiteLLM gateway on that VM. Keep all app and gateway ports on loopback. Use an IAP-authenticated SSH tunnel to view the app, not a public unauthenticated task endpoint. A dedicated network accepts SSH only from the IAP range.
4. Configure Claude Code to use the local LiteLLM Anthropic-compatible gateway. Route its sole model alias to `vertex_ai/gemini-3.5-flash` on Vertex AI's global endpoint. The gateway translates requests and uses the VM's dedicated Google service account with Vertex AI permissions. No Claude model, Google API key, or service account key file is required. The gateway is a third-party compatibility layer, and its tool-call and streaming behavior must be verified end to end.
5. Accept only trusted public GitHub repositories. Clone into a workspace, run the CLI noninteractively with bounded time and turns, and store streamed progress. Capture a patch against the initial commit including new files and agent-created commits. Mark a run failed if the CLI fails or times out. Do not claim tests passed unless the run actually reports them.
6. The CLI runs as an unprivileged user on the VM. This setup is for a trusted single-user demo, not a secure multi-tenant sandbox: repository code running as that user can reach its Google Cloud identity and local services. Do not accept untrusted repositories or expose the app publicly. Stronger sandboxing and metadata/credential isolation are needed before doing either.

## Verification and acceptance

- Check the real Vertex model request and the VM service account's access, then verify the gateway using Anthropic-format requests.
- Submit a small public GitHub repository through the UI with an instruction to add a unit test. Confirm the CLI uses Gemini only, reports completion and actual test output, and produces a patch that includes the new test file and applies cleanly to the original repository.
- Test failure and timeout paths and ensure a failed task does not display as a successful mock. Verify browser access and websocket updates over the IAP tunnel.
- Measure memory and runtime on e2-micro. If it cannot run reliably, report the evidence and use the smallest working configuration.
- Keep a reproducible setup script and systemd units; build the UI with same-origin API/WebSocket URLs, run migrations, and enable restart on failure. The gateway and database must start before the backend.

## Costs

Google's free tier currently covers one qualifying e2-micro, 30 GB-month of standard persistent disk, and limited North American egress, subject to billing-account-wide limits and eligible regions. An external IPv4 address, excess egress, Vertex Gemini inference, or a larger machine can incur charges. Google lists an in-use external IPv4 at $0.005/hour after its limited free allowance (roughly $3.60 for 720 hours), subject to account-wide allowances and current prices. Claude Code's per-run budget is an estimate, not a billing hard cap, and its estimate may be unreliable for translated models. Set turn/time limits and check actual Cloud Billing usage. Stopping the VM reduces compute charges but storage and IP charges may remain. Do not delete the project without the user's instruction.

## Current state

- Project, billing link, Compute Engine and AI APIs, a dedicated service account, network, IAP firewall and SSH permission are configured.
- Direct Vertex AI and gateway requests to Gemini 3.5 Flash succeeded; no Claude model is configured.
- The `e2-micro` is running. A real job cloned `octocat/Hello-World`, used Claude Code via Gemini to create and run a Node test (one passed, zero failed), and returned a patch that applied cleanly to a fresh clone. The dashboard, database, Redis, and WebSocket connection were checked through the IAP tunnel. Large repositories and workloads have not been benchmarked.
- Local simulated runner and Git patch tests passed. Application and deployment changes were copied to the VM for this demo.

## References

- https://docs.litellm.ai/docs/proxy/client_setup/claude_code
- https://docs.litellm.ai/docs/providers/vertex
- https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-5-flash
- https://docs.cloud.google.com/free/docs/free-cloud-features
- https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing

## Operating the demo

Open the private dashboard by running the following on a machine signed in with `aadityavton@gmail.com` and leaving the command running:

```powershell
gcloud compute ssh coding-harness-demo --project=coding-harness-demo-20261029 --zone=us-central1-a --tunnel-through-iap --account=aadityavton@gmail.com -- -N -L 8080:127.0.0.1:8080
```

Then open `http://localhost:8080`. The SSH tunnel grants the signed-in user access to the otherwise private demo; the VM's public IP is not a public website URL.

To reduce ongoing usage after the demo, close the tunnel and stop the VM:

```powershell
gcloud compute instances stop coding-harness-demo --project=coding-harness-demo-20261029 --zone=us-central1-a --account=aadityavton@gmail.com
```

Restart it with `gcloud compute instances start` using the same project, zone and account flags, then open the tunnel again. Persistent disk usage can still be billable while stopped. To inspect service status over SSH, check `coding-harness-backend`, `coding-harness-frontend`, `coding-harness-gateway`, `postgresql`, `redis-server`, and `nginx` with systemd. Gemini inference is billed to the demo project; the $5 per-run value is an estimate, not an enforceable billing limit.

## Project cost display

The dashboard reads the standard Cloud Billing export from BigQuery. The export stores billing data for **all projects on the billing account** in the restricted `billing_export` dataset; its dataset access is limited to the billing export service and the account owner. The VM service account cannot read that dataset directly. It can run the fixed, read-only authorized `billing_dashboard.project_cost` routine, which aggregates only `coding-harness-demo-20261029` and includes both pre-credit usage charges and the amount after reported credits. The VM has BigQuery job creation permission and read access to the routine's dataset.

The deployed routine is recorded as a template in `deployment/gcp-demo/project-cost.sql`; replace the project and billing-account placeholders before running it. Provision the datasets, enable the standard billing export, create and authorize the routine on the raw export dataset, and grant the VM service account access to the routine dataset and permission to create BigQuery jobs. Restrict the raw dataset separately; do not grant the VM direct read access to it. Replacing the routine requires re-authorizing it.

The card refreshes once per minute, while the backend caches successful queries for an hour and retries pending or failed queries after five minutes to limit query costs. Cloud Billing data is delayed and can be revised. The first US multi-region export backfills from the beginning of the previous month and can take up to five days; until project data arrives, the card says it is pending instead of showing $0. The displayed total is the reported project cost, not a guaranteed real-time balance or invoice. BigQuery storage and querying can incur additional charges.

Reference: https://docs.cloud.google.com/billing/docs/how-to/export-data-bigquery
