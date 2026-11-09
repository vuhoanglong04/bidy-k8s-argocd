#!/usr/bin/env bash
# Rebuild the whole platform from scratch with one command:
#   kind cluster -> node limits -> Cilium -> Argo CD -> root app -> Vault init/unseal
# Everything after the root app (Traefik, Vault, External Secrets, metrics-server, monitoring, bidy-dev)
# is installed by Argo CD from this repository.
#
# Prerequisites: docker, kind, kubectl, helm.
# Optional env:
#   ARGOCD_REPO_KEY   SSH private key with read access to the repo   (default ~/.ssh/id_ed25519)
#   SKIP_VAULT=1      do not init/unseal Vault (see vault-bootstrap.sh)
#   SKIP_LIMITS=1     do not cap node CPU/memory
set -euo pipefail

CLUSTER="${CLUSTER:-bidy}"
ARGOCD_VERSION="${ARGOCD_VERSION:-v3.5.6}"
CILIUM_VERSION="${CILIUM_VERSION:-1.20.4}"
REPO_URL="${REPO_URL:-git@github.com:vuhoanglong04/bidy-k8s-argocd.git}"
ARGOCD_REPO_KEY="${ARGOCD_REPO_KEY:-$HOME/.ssh/id_ed25519}"

HERE="$(cd "$(dirname "$0")" && pwd)"
K8S="$(dirname "$HERE")"

step() { printf '\n==> %s\n' "$*"; }

for tool in docker kind kubectl helm; do
  command -v "$tool" >/dev/null || { echo "missing required tool: $tool" >&2; exit 1; }
done
[ -r "$ARGOCD_REPO_KEY" ] || { echo "cannot read repo SSH key: $ARGOCD_REPO_KEY (set ARGOCD_REPO_KEY)" >&2; exit 1; }

step "kind cluster '$CLUSTER'"
if kind get clusters | grep -qx "$CLUSTER"; then
  echo "already exists, reusing"
else
  kind create cluster --name "$CLUSTER" --config "$HERE/kind-config.yaml"
fi
kubectl config use-context "kind-$CLUSTER" >/dev/null

if [ -z "${SKIP_LIMITS:-}" ]; then
  step "node resource limits"
  CLUSTER="$CLUSTER" "$HERE/limit-nodes.sh" >/dev/null
fi

step "Cilium $CILIUM_VERSION (nodes stay NotReady until the CNI is up)"
helm repo add cilium https://helm.cilium.io >/dev/null 2>&1 || true
helm upgrade --install cilium cilium/cilium --version "$CILIUM_VERSION" \
  -n kube-system -f "$K8S/platform/cilium/values.yaml" --wait --timeout 10m
kubectl wait --for=condition=Ready nodes --all --timeout=300s

step "Argo CD $ARGOCD_VERSION"
kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -n argocd --server-side --force-conflicts \
  -f "https://raw.githubusercontent.com/argoproj/argo-cd/$ARGOCD_VERSION/manifests/install.yaml"
kubectl -n argocd rollout status deploy/argocd-server --timeout=300s
kubectl -n argocd rollout status deploy/argocd-repo-server --timeout=300s

step "Repository credentials"
kubectl -n argocd create secret generic repo-bidy-k8s-argocd \
  --from-literal=type=git --from-literal=url="$REPO_URL" \
  --from-file=sshPrivateKey="$ARGOCD_REPO_KEY" \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl -n argocd label secret repo-bidy-k8s-argocd argocd.argoproj.io/secret-type=repository --overwrite

step "Root application (app-of-apps)"
kubectl apply -f "$K8S/argocd/root.yaml"

if [ -z "${SKIP_VAULT:-}" ]; then
  step "Vault (init, unseal, load secrets)"
  "$HERE/vault-bootstrap.sh"
fi

cat <<MSG

Done. Argo CD now installs the rest; the first sync takes several minutes (image pulls).
  watch:    kubectl -n argocd get applications
  Argo CD:  kubectl -n argocd port-forward svc/argocd-server 8080:443
            password: kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d
  App:      http://bidy.localtest.me
  Grafana:  http://grafana.localtest.me
            password: kubectl -n monitoring get secret monitoring-grafana -o jsonpath='{.data.admin-password}' | base64 -d
MSG
