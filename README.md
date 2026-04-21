# Sreddit

Type a topic → get a deck of fun facts scraped from Reddit and curated by an LLM.

## Project structure

```
sreddit/
├── app.py                  # Flask backend
├── requirements.txt        # Python dependencies
├── .env.example            # Template — copy to .env and add real keys
├── .gitignore              # Keeps secrets out of Git
├── templates/
│   └── index.html
└── static/
    ├── style.css
    └── app.js
```

## Local development

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Copy `.env.example` to `.env` and fill in your real API keys:
   ```bash
   cp .env.example .env        # macOS / Linux
   copy .env.example .env      # Windows
   ```

   Then edit `.env` with a text editor and replace the placeholders.

3. Run:
   ```bash
   python app.py
   ```
   Open http://localhost:5000

## Deploying online

**Never commit your `.env` file.** The `.gitignore` already blocks it, but always double-check.
On the host, set `BRAVE_API_KEY` and `OPENAI_API_KEY` through the platform's environment-variable UI —
not in your code, not in a committed file.

### Option A — Render.com (easiest free option)

1. Push your code to GitHub (the `.gitignore` will exclude `.env`).
2. Create a free account at https://render.com.
3. New → Web Service → connect your GitHub repo.
4. Settings:
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app`
5. **Environment** tab → Add Environment Variables:
   - `BRAVE_API_KEY` = your real Brave key
   - `OPENAI_API_KEY` = your real OpenAI key
6. Deploy.

### Option B — Railway.app

1. Push to GitHub.
2. railway.app → New Project → Deploy from GitHub.
3. Variables tab → add `BRAVE_API_KEY` and `OPENAI_API_KEY`.
4. Railway auto-detects Python and uses `gunicorn app:app`.

### Option C — PythonAnywhere

1. Upload files or pull from GitHub (don't upload your `.env`).
2. In the Web app setup, add environment variables in the WSGI config:
   ```python
   import os
   os.environ["BRAVE_API_KEY"] = "your_key"
   os.environ["OPENAI_API_KEY"] = "your_key"
   ```
   (Note: this file is not in your Git repo — it lives on the server.)

## Security checklist before publishing

- [ ] **Rotate the keys that were in the original code.** Assume they are compromised.
- [ ] Never commit `.env` to Git — run `git status` and make sure it's not listed.
- [ ] On the host, set env vars through the dashboard, not in code.
- [ ] Set `FLASK_DEBUG=0` (or don't set it) in production — debug mode exposes a remote code execution vector.
- [ ] Consider setting up rate limiting (e.g. `flask-limiter`) so a malicious user can't burn through your OpenAI credits.

## If you accidentally committed a key

1. Rotate/revoke it immediately at the provider.
2. Remove it from history with `git filter-repo` or BFG, then force-push. Simply deleting the key in a new commit does NOT hide it — it's still in Git history.
