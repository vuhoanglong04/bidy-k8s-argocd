# Restore a Postgres backup

Backups are written daily (02:00 UTC) by the `postgres-backup` CronJob to
`r2:<BUCKET_NAME>/backups/postgres/bidy_db-<timestamp>.pgdump` (custom format, 7 days kept).

Run a backup now:

    kubectl -n bidy-dev create job --from=cronjob/postgres-backup backup-manual-$(date +%s)

Restore drill into a scratch database (never touches `bidy_db`):

    # 1. pick a file
    kubectl -n bidy-dev run r2-ls --rm -i --restart=Never --image=rclone/rclone:1.68.2 \
      --env=RCLONE_CONFIG_R2_TYPE=s3 --env=RCLONE_CONFIG_R2_PROVIDER=Cloudflare ... lsl r2:<bucket>/backups/postgres

    # 2. download, then restore into a new DB
    kubectl -n bidy-dev exec postgres-0 -- createdb -U postgres bidy_restore_test
    kubectl -n bidy-dev exec -i postgres-0 -- pg_restore -U postgres -d bidy_restore_test --no-owner < bidy_db-<ts>.pgdump
    kubectl -n bidy-dev exec postgres-0 -- psql -U postgres -d bidy_restore_test -c '\dt'
    kubectl -n bidy-dev exec postgres-0 -- dropdb -U postgres bidy_restore_test

For a real recovery, scale `bidy-backend`/`bidy-worker` to 0, restore with `--clean --if-exists`
into `bidy_db`, then let Argo CD / the HPA scale them back.
