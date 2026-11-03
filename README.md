# Bidy on Kubernetes (kind + Argo CD)

Bidy auction platform (`bidy-be`, `bidy-fe`) on a local kind cluster. CI on GitHub Actions
(build, test, Trivy, push to Docker Hub), CD with Argo CD (GitOps), Sealed Secrets, Traefik, Cilium.

## TODO

### Chaos tests and postmortem

Break things on purpose while a light `curl` loop records status codes, then compare with the
hypothesis written beforehand. Write results to `k8s/docs/chaos-postmortem.md`, plus a blameless
postmortem (summary, timeline, root cause, what went well/badly, action items) for the most
serious finding. Back up Postgres right before experiment 2.

| # | Experiment | Hypothesis | What it checks |
|---|---|---|---|
| 1 | Delete one backend pod | No errors, the second pod keeps serving | Readiness, Service, Deployment |
| 2 | Delete the Postgres pod | API errors for tens of seconds, then recovers, data intact | StatefulSet, PVC |
| 3 | Delete the Redis pod | Quick recovery thanks to AOF; sessions/cache may be affected | Redis persistence |
| 4 | Delete the Traefik pod | Site is down for a few seconds (single replica, `maxSurge: 0`) | Known weak spot, measure it |
| 5 | Drain one worker node | No errors, PDB keeps at least one FE/BE pod; `uncordon` afterwards | PDB, rescheduling |
| 6 | Delete the worker (cron) pod | Cron paused while it is recreated (`Recreate`), then resumes | Single point of failure |

Notes: the backend rate limiter (300 requests / 15 min per IP) blocks heavy loops, so use the
frontend page or `/health`, or raise the limit on dev first.

### Other open items

- Monitoring: Prometheus, Grafana, optionally Loki (keep resources small, Docker VM is 12 GB).
- Re-run the HPA load test for the backend with the rate limiter relaxed.
- `bootstrap.sh` to rebuild everything with one command; architecture diagram, GIF of the
  push -> Actions -> tag bump -> Argo rollout flow, short ADRs.
- Replace the committed `bidy-be/.env` (real credentials) with dummy values, or rotate the keys,
  before the repo goes public.
