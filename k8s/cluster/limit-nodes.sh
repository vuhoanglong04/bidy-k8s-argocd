#!/usr/bin/env bash
# Cap CPU/memory of each kind node container (kind has no per-node limit in its config).
# Run after `kind create cluster`. Safe to re-run; changes apply live, no restart needed.
set -euo pipefail

CLUSTER="${CLUSTER:-bidy}"

CP_CPUS="${CP_CPUS:-2}";         CP_MEM="${CP_MEM:-2g}"
WORKER_CPUS="${WORKER_CPUS:-2}"; WORKER_MEM="${WORKER_MEM:-3g}"

limit() { # name cpus mem
  # --memory-swap == --memory disables swap so the cap is a hard cap
  docker update --cpus "$2" --memory "$3" --memory-swap "$3" "$1" >/dev/null
  echo "$1: cpus=$2 mem=$3"
}

for node in $(docker ps --filter "label=io.x-k8s.kind.cluster=${CLUSTER}" --format '{{.Names}}'); do
  case "$node" in
    *control-plane*) limit "$node" "$CP_CPUS" "$CP_MEM" ;;
    *)               limit "$node" "$WORKER_CPUS" "$WORKER_MEM" ;;
  esac
done

echo
docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}' \
  $(docker ps --filter "label=io.x-k8s.kind.cluster=${CLUSTER}" --format '{{.Names}}')
