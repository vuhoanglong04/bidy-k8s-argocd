#!/usr/bin/env bash
# Initialise/unseal Vault and (re)create what External Secrets needs. Safe to run again:
# run it after every Vault pod restart, because Vault starts sealed.
#
# Secrets are kept OUTSIDE the repo under ~/.bidy (override with BIDY_DIR):
#   vault-init.json    unseal key + root token, written on the first init. Losing it together
#                      with the Vault PVC means losing every secret.
#   bidy-secret.json   {"KEY": "value", ...} loaded into secret/bidy/dev when Vault is empty.
#                      Without it Vault is configured but left empty; load values yourself with
#                      `vault kv put secret/bidy/dev KEY=value ...`.
set -euo pipefail

BIDY_DIR="${BIDY_DIR:-$HOME/.bidy}"
INIT_FILE="$BIDY_DIR/vault-init.json"
SECRETS_FILE="$BIDY_DIR/bidy-secret.json"
NS=vault
POD=vault-0

step() { printf '\n==> %s\n' "$*"; }
vexec() { kubectl -n "$NS" exec -i "$POD" -- env VAULT_TOKEN="${TOKEN:-}" vault "$@"; }

command -v jq >/dev/null || { echo "missing required tool: jq" >&2; exit 1; }

status() { kubectl -n "$NS" exec "$POD" -- vault status -format=json 2>/dev/null || true; }

step "waiting for $POD (Argo CD installs it after the root app)"
# `vault status` exits 2 while sealed but still prints JSON, so only the JSON matters here
until [ -n "$(status | jq -r '.initialized // empty')" ]; do sleep 5; done

if [ "$(status | jq -r .initialized)" != "true" ]; then
  step "initialising Vault"
  mkdir -p "$BIDY_DIR"
  umask 077
  kubectl -n "$NS" exec "$POD" -- vault operator init -key-shares=1 -key-threshold=1 -format=json > "$INIT_FILE"
  chmod 600 "$INIT_FILE"
  echo "unseal key and root token saved to $INIT_FILE: back it up, it is not in git"
fi

[ -r "$INIT_FILE" ] || { echo "Vault is initialised but $INIT_FILE is missing: cannot unseal" >&2; exit 1; }

if [ "$(status | jq -r .sealed)" = "true" ]; then
  step "unsealing"
  kubectl -n "$NS" exec "$POD" -- vault operator unseal "$(jq -r '.unseal_keys_b64[0]' "$INIT_FILE")" >/dev/null
fi

TOKEN="$(jq -r .root_token "$INIT_FILE")"

step "secrets engine, policy and Kubernetes auth"
vexec secrets list -format=json | jq -e 'has("secret/")' >/dev/null || vexec secrets enable -path=secret kv-v2

vexec policy write bidy-dev-read - >/dev/null <<'POLICY'
path "secret/data/bidy/dev"     { capabilities = ["read"] }
path "secret/metadata/bidy/dev" { capabilities = ["read","list"] }
POLICY

vexec auth list -format=json | jq -e 'has("kubernetes/")' >/dev/null || vexec auth enable kubernetes
vexec write auth/kubernetes/config kubernetes_host="https://kubernetes.default.svc:443" >/dev/null
vexec write auth/kubernetes/role/bidy-dev \
  bound_service_account_names=eso-vault \
  bound_service_account_namespaces=bidy-dev \
  policies=bidy-dev-read ttl=15m >/dev/null

if vexec kv get secret/bidy/dev >/dev/null 2>&1; then
  echo "secret/bidy/dev already has data, leaving it alone"
elif [ -r "$SECRETS_FILE" ]; then
  step "loading secret/bidy/dev from $SECRETS_FILE"
  jq -c . "$SECRETS_FILE" | vexec kv put secret/bidy/dev - >/dev/null
else
  echo
  echo "WARNING: secret/bidy/dev is empty and $SECRETS_FILE does not exist."
  echo "         bidy-secret will not be created until you load the values, e.g.:"
  echo "         vault kv put secret/bidy/dev JWT_SECRET=... POSTGRES_PASSWORD=... (see README)"
fi

echo
echo "Vault is ready. ExternalSecret bidy-secret refreshes every minute."
