---
name: argocd-k8s-deploy
description: Use this when deploying, promoting, or rolling back a Neolink service on our Digital Ocean Kubernetes cluster. Covers the GitOps flow (ArgoCD watches the manifests repo), how to bump image tags safely, environment overlays, and why we never `kubectl apply` directly.
---

# ArgoCD + Kubernetes deploys (Neolink platform)

## Platform

- **Kubernetes** on **Digital Ocean** (DOKS).
- **ArgoCD** is the sync controller. It continuously reconciles the live cluster state against a Git repository of manifests.
- Manifests repo layout:
  - `apps/<service>/base/` — base Kustomize resources.
  - `apps/<service>/overlays/<env>/` — per-environment overlay (`dev`, `staging`, `prod`).
- Every app repo builds and pushes an image (registry tag per commit / semver). It does **not** deploy.

## The golden rule

**Never `kubectl apply`, `kubectl edit`, or `kubectl patch` against a cluster.** ArgoCD will revert you, or worse, detect drift and page someone. All changes flow through a Git commit to the manifests repo.

Exceptions: `kubectl logs`, `kubectl get`, `kubectl describe`, `kubectl exec` for debugging. Anything read-only is fine.

## Deploying a new version

1. Build and push the image from the service repo. The image tag is typically the commit SHA or a semver release tag.
2. In the manifests repo, bump the image tag in the target overlay:

        # apps/<service>/overlays/<env>/kustomization.yaml
        images:
          - name: registry.digitalocean.com/neolink/<service>
            newTag: <new-sha-or-version>

3. Open a PR. After merge, ArgoCD detects the change and syncs within ~1 minute (or click **Sync** in the UI for immediate).
4. Watch the Application in the ArgoCD UI until it reports `Synced` + `Healthy`. Look at pod logs via `kubectl logs` if it regresses.

## Promoting dev → staging → prod

- Same image, different overlay. Promote by changing the tag in the next overlay's `kustomization.yaml`.
- Do not rebuild between environments. Promote the exact digest that passed the previous stage.

## Rollback

The fastest safe rollback is **revert the manifests commit**:

    git revert <bad-deploy-commit>
    git push

ArgoCD syncs the cluster back to the previous image. Do not use `kubectl rollout undo` — it creates drift from Git that ArgoCD will fight.

## Secrets

- Secrets come from HashiCorp Vault via the backend's `node-vault` client, not from Kubernetes `Secret` manifests committed to Git.
- If a `Secret` must exist in cluster, it's sealed or fetched at runtime — ask before introducing a new one.

## Common ArgoCD states and what they mean

- `OutOfSync, Healthy` → manifests ahead of cluster; sync (or wait) to apply.
- `Synced, Progressing` → new pods rolling out; wait.
- `Synced, Degraded` → rollout failed; check pod events/logs, usually image pull or health check.
- `Unknown` → ArgoCD can't reach the repo or cluster; check ArgoCD's own pods.

## What to check before a prod deploy

- The image tag exists in the DO container registry.
- The same tag is already `Healthy` in staging.
- No open incident involving the service.
- Migrations (if any) are backward-compatible with the previous image — ArgoCD rolls forward one pod at a time.

## When the user asks "deploy X"

1. Confirm which environment (`dev`/`staging`/`prod`).
2. Confirm the image tag to deploy (don't guess the SHA — ask).
3. Make the kustomization edit in the manifests repo on a branch. Do not push to `main` without a PR for `prod`.
4. Never `kubectl apply` as a shortcut.
