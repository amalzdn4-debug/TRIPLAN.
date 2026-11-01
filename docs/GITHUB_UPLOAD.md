# Uploading TRIPLAN to GitHub — step by step

This guide assumes you have a GitHub account but have never uploaded this project. There are two methods:

| | Method A — GitHub website | Method B — Git commands |
|---|---|---|
| Needs installing | Nothing | Git |
| Effort the first time | 3 drag-and-drop uploads | ~8 commands |
| Future updates | Re-upload changed files by hand | One short command sequence |
| Recommended for | A one-time upload | Ongoing work on the site ✅ |

> **What you received:**
> - **`triplan.zip`** — the complete project (use this for Method B and as your master copy).
> - **`triplan-github-web-upload.zip`** — the *same files*, pre-split into three batches of fewer than 100 files each, for Method A. GitHub's website accepts at most 100 files per upload, and this project has about 195.

Nothing in either ZIP is secret. Real passwords and API keys are **never** stored in the project: you add them later in your hosting dashboard (see `DEPLOYMENT.md`).

---

## Method A — Upload through the GitHub website

### 1. Log in to GitHub
1. Open **https://github.com** in Chrome, Edge or Firefox (folder drag-and-drop works best in these).
2. Click **Sign in** (top right) and enter your username/email and password (and your two-factor code if you use one).

### 2. Create a new repository called `triplan`
1. Click the **+** icon at the top right → **New repository**.
2. **Repository name:** `triplan`
3. **Description (optional):** `TRIPLAN — Plan less. Explore more.`
4. **Visibility:** choose **Private**. Only you (and people you invite) can see the code. You can make it public later. Hosting on Vercel works with private repositories.

### 3. Repository settings to choose
- **Leave "Add a README file" unticked.**
- **Leave "Add .gitignore" set to "None".**
- **Leave "Choose a license" set to "None".**

The project already contains its own `README.md` and `.gitignore`. Creating them on GitHub would cause duplicates.

Click **Create repository**. You will see a mostly empty page with a "Quick setup" box.

### 4. Prepare the files on your computer
1. Find **`triplan-github-web-upload.zip`** (usually in *Downloads*).
2. Extract it:
   - **Windows:** right-click → **Extract All…** → **Extract**.
   - **Mac:** double-click the ZIP.
3. Inside you will find three folders: **`1-root-files`**, **`2-src-part-1`**, **`3-src-part-2`**, plus a short `READ-ME-FIRST.txt`.

**Show hidden files.** Some important files start with a dot (`.gitignore`, `.env.example`, `.github`), and computers hide those by default:
- **Windows 11:** File Explorer → **View** → **Show** → tick **Hidden items**.
- **Windows 10:** File Explorer → **View** tab → tick **Hidden items**.
- **Mac:** in Finder, press **Cmd + Shift + .** (full stop). Press again to hide them later.

### 5. Upload the files (3 batches)
On your new repository page, click the link **"uploading an existing file"** (in the Quick setup box). Later batches use **Add file → Upload files** on the repository's main page.

**Batch 1 — root files (about 65 files)**
1. Open the folder **`1-root-files`** on your computer.
2. Select **everything inside it** (Windows: Ctrl + A, Mac: Cmd + A), including the dot-files. **Do not** drag the `1-root-files` folder itself, only its contents.
3. Drag the selection into the GitHub upload area.
4. Wait until every file shows in the list below the upload area (big folders take a moment).
5. Scroll down to **Commit changes**:
   - First box: `Initial upload — part 1 of 3`
   - Leave **"Commit directly to the main branch"** selected.
   - Click **Commit changes**.

**Batch 2 — first half of the `src` folder**
1. Back on the repository main page, click **Add file → Upload files**.
2. Open **`2-src-part-1`** on your computer. It contains a single folder named **`src`**.
3. Drag that **`src` folder** into the GitHub upload area. GitHub keeps the folder structure.
4. Commit message `Initial upload — part 2 of 3` → **Commit changes**.

**Batch 3 — second half of the `src` folder**
1. **Add file → Upload files** again.
2. Open **`3-src-part-2`**, drag its **`src` folder** into the upload area. GitHub merges it with the existing `src` folder; nothing is overwritten.
3. Commit message `Initial upload — part 3 of 3` → **Commit changes**.

### 6. About the "first commit"
Each **Commit changes** click *is* a commit (a saved snapshot of your files). After the three batches your repository has three commits, which is completely fine.

### 7. Check that everything arrived
On the repository main page you should see:
- Folders: **`.github`**, **`db`**, **`docs`**, **`messages`**, **`public`**, **`scripts`**, **`src`**, **`tests`**
- Files including **`.env.example`**, **`.gitignore`**, **`package.json`**, **`README.md`**, **`vercel.json`**
- The README displayed below the file list.

Then click into **`src`**. You should see **`actions`, `app`, `components`, `config`, `content`, `data`, `db`, `i18n`, `lib`, `styles`** and **`middleware.ts`**. Inside `src/app` there must be a folder literally named **`[locale]`** (square brackets are part of the name).

Finally, open the **Actions** tab. A workflow called **CI** runs automatically. It installs everything, checks types and translations, runs the tests and makes a production build on GitHub's servers. After a few minutes:
- ✅ **green tick:** the project builds.
- ❌ **red cross:** open it, copy the first error message, and send it to me (or your developer).

**If `.github`, `.gitignore` or `.env.example` are missing:** hidden files weren't visible when you selected. Turn on hidden files (step 4), then **Add file → Upload files** and drag just those items from `1-root-files`.

### GitHub website limitations: when to use Method B
- At most **100 files per upload** (hence the 3 batches) and **25 MB per file**. No TRIPLAN file is anywhere near that size.
- **Deleting, moving or renaming** many files is tedious on the website; Git does it in one command.
- The website ignores `.gitattributes` line-ending rules (not an issue for this project).
- For **regular updates**, Method B or the free **GitHub Desktop** app (https://desktop.github.com, a point-and-click version of Method B with no file limits) is far easier.

---

## Method B — Upload using Git commands

### Before you start (one time)
1. **Install Git:** https://git-scm.com/downloads. On Windows, accept the defaults; this also installs *Git Credential Manager*, which handles GitHub sign-in for you.
2. **Open a terminal:**
   - **Windows:** Start menu → type **PowerShell** → open **Windows PowerShell**.
   - **Mac:** Applications → Utilities → **Terminal**.
3. Check Git works:
   ```bash
   git --version
   ```
   You should see something like `git version 2.x`.
4. Tell Git who you are (shown on your commits). Replace the two values:
   ```bash
   git config --global user.name "Your Name"
   git config --global user.email "you@example.com"
   ```
5. **Create the empty repository on GitHub first:** follow Method A steps 1–3 (name `triplan`, Private, nothing ticked). Leave that page open; it shows your repository's URL.

### The commands, in order

Assumes `triplan.zip` is in your **Downloads** folder.

**1. Extract the ZIP**

*Windows (PowerShell):*
```powershell
cd $HOME\Downloads
Expand-Archive -Path .\triplan.zip -DestinationPath .
```
*Mac (Terminal):*
```bash
cd ~/Downloads
unzip triplan.zip
```

**2. Open the project folder**
```bash
cd triplan
```

**3. Initialise Git** (creates a new repository on your computer with a branch called `main`)
```bash
git init -b main
```

**4. Add the files**
```bash
git add .
```
Optional safety check (lists what will be uploaded; no file named `.env` or `.env.local` may appear, only `.env.example`):
```bash
git status
```

**5. Commit the project**
```bash
git commit -m "Initial version of TRIPLAN"
```

**6. Connect to your GitHub repository**
```bash
git remote add origin https://github.com/YOUR-GITHUB-USERNAME/triplan.git
```
➡️ **Replace `YOUR-GITHUB-USERNAME`** with your GitHub username exactly as it appears in your profile URL (`https://github.com/your-username`). Alternatively, copy the full HTTPS URL from the repository's Quick setup box.

**7. Push (upload) to GitHub**
```bash
git push -u origin main
```
The first time, a browser window opens asking you to **sign in to GitHub and authorise Git**. Approve it. (GitHub doesn't accept your account password on the command line. If no window appears, create a *personal access token* at https://github.com/settings/tokens and paste it when asked for a password.)

Refresh the repository page: all files appear in **one** commit. Then do the checks in Method A, step 7.

### Updating the website on GitHub later
Whenever you (or a developer) change files inside the `triplan` folder:
```bash
cd path/to/triplan          # e.g.  cd ~/Downloads/triplan   or   cd $HOME\Downloads\triplan
git status                  # see what changed
git add .
git commit -m "Describe the change, e.g. Update Paris description"
git push
```
If the site is connected to Vercel (see `DEPLOYMENT.md`), **every push automatically rebuilds and republishes the live site** within a few minutes.

Useful extras:
- `git log --oneline` shows your history.
- `git pull` downloads changes made elsewhere (e.g. edits on github.com) before you start working.
- To undo uncommitted changes to one file: `git restore path/to/file`.

### Golden rules
- **Never** put real passwords or API keys in any project file. They belong in Vercel → Settings → Environment Variables.
- Never upload a file named `.env` or `.env.local`. The project's `.gitignore` already blocks them for Method B; with Method A, just don't drag them in.
- If you ever accidentally upload a secret, **revoke/regenerate that key immediately** at the provider (Stripe, Google, etc.). Deleting the file isn't enough, because it remains in the history.
