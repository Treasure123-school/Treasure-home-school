# Vercel Deployment via GitHub Actions

## Why This Setup Exists

Replit signs git commits with its own internal email address (e.g. `46733056-adebankealade01@users.noreply.replit.com`). Vercel's free Hobby plan only deploys commits whose author email matches a connected GitHub account — so every push from Replit was being blocked.

**The fix:** A GitHub Actions workflow runs on every push to `main` and deploys directly to Vercel using the Vercel CLI and a token. Vercel never sees the commit author — it just receives the built files.

---

## One-Time Setup (Do This Once)

### Step 1 — Disconnect Vercel's Automatic Git Integration

This stops Vercel from trying (and failing) to deploy on every commit.

1. Go to [vercel.com](https://vercel.com) → open your project
2. Click **Settings** → **Git**
3. Under "Connected Git Repository", click **Disconnect**
4. Confirm the disconnection

> Your project stays live. Only automatic commit-triggered deploys are turned off. The GitHub Actions workflow will handle deploys from now on.

---

### Step 2 — Create a Vercel Token

1. Go to [vercel.com/account/tokens](https://vercel.com/account/tokens)
2. Click **Create Token**
3. Give it a name like `github-actions-deploy`
4. Set expiry to **No Expiration** (or a long duration)
5. Click **Create** and **copy the token immediately** — it won't be shown again

---

### Step 3 — Get Your Vercel Project ID and Org ID

**Option A — From Vercel Dashboard:**
1. Open your Vercel project → **Settings** → **General**
2. Scroll down to find:
   - **Project ID** — looks like `prj_xxxxxxxxxxxx`
   - **Team ID** (this is your Org ID) — looks like `team_xxxxxxxxxxxx`
   - If you are on a personal account with no team, the Team ID is your personal account ID found at [vercel.com/account](https://vercel.com/account) under **Settings** → scroll to "Your ID"

**Option B — From Replit Terminal:**
1. Open the Shell in Replit
2. Run: `cat .vercel/project.json`
3. You will see:
   ```json
   { "orgId": "team_xxxx", "projectId": "prj_xxxx" }
   ```

---

### Step 4 — Add Secrets to GitHub

1. Go to your GitHub repository: `github.com/Treasure123-school/Treasure-home-school`
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** three times, adding:

   | Secret Name | Value |
   |---|---|
   | `VERCEL_TOKEN` | The token you created in Step 2 |
   | `VERCEL_ORG_ID` | Your Team ID or personal account ID from Step 3 |
   | `VERCEL_PROJECT_ID` | Your Project ID from Step 3 |

---

### Step 5 — Trigger a Deploy

The workflow runs automatically on every push to `main`. To trigger it now:

1. Make any small change in Replit (or push the existing code)
2. Replit pushes to GitHub
3. Go to your GitHub repo → **Actions** tab
4. You will see a workflow run called **"Deploy to Vercel"** — click it to watch the progress
5. Once it shows a green checkmark, your site is live on Vercel

---

## How It Works Going Forward

```
You edit code in Replit
        ↓
Replit pushes commit to GitHub (author email doesn't matter)
        ↓
GitHub Actions detects the push
        ↓
GitHub Actions builds and deploys to Vercel using VERCEL_TOKEN
        ↓
Vercel serves the updated site
```

Every push to the `main` branch triggers a fresh deploy automatically. No manual steps needed after the one-time setup.

---

## What About the Previous Failed Commits?

The failed commits in your GitHub history were just missed deploy attempts — the code changes are safely in your repository. The next successful deploy (via GitHub Actions) will include **all** those changes because it deploys whatever is currently on the `main` branch.

You do not need to re-push or re-run those old commits.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| Workflow fails with "Invalid token" | Check that `VERCEL_TOKEN` secret is correct and not expired |
| Workflow fails with "Project not found" | Double-check `VERCEL_PROJECT_ID` and `VERCEL_ORG_ID` values |
| Workflow succeeds but site is not updated | Make sure you disconnected Vercel's Git integration in Step 1 |
| No workflow running after a push | Confirm the file `.github/workflows/deploy.yml` exists in your repo |
| Build errors in the workflow | Check the Actions log — the error will show exactly which build step failed |

---

## Workflow File Location

The deployment workflow is at:
```
.github/workflows/deploy.yml
```

Do not delete or rename this file. Every push to `main` depends on it.
