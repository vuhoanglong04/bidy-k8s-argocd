#!/usr/bin/env bash
# Save the Sealed Secrets private key OUTSIDE the repo. Without it, a rebuilt cluster cannot
# decrypt k8s/apps/bidy/base/sealed-secret.yaml and you would have to re-seal every secret.
# The output file is a private key: keep it out of git (default path is under $HOME).
set -euo pipefail

OUT="${1:-$HOME/.bidy/sealed-secrets-key.yaml}"
mkdir -p "$(dirname "$OUT")"
umask 077
kubectl -n kube-system get secret -l sealedsecrets.bitnami.com/sealed-secrets-key=active -o yaml > "$OUT"
chmod 600 "$OUT"
echo "Saved to $OUT. bootstrap.sh restores it automatically when it finds this file."
