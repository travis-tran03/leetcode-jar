# LeetCode Jar Tracker

Simple CLI to track missed LeetCode days. Each missed day is $1 in the jar.

Files:
- `jar.py` - CLI entrypoint
- `jar_data.py` - data model and persistence
- `.jar_data.json` - generated data file

Quickstart:

1. Initialize users:

```cmd
python jar.py init --users travis david
```

2. Mark today's status:

```cmd
python jar.py mark travis done
python jar.py mark david missed
```

3. Close day (mark anyone not set as missed):

```cmd
python jar.py close-day
```

4. View totals:

```cmd
python jar.py totals
```

Run tests (needs pytest):

```cmd
pytest -q
```

Static UI (preview & GitHub Pages):

1. Put your `.jar_data.json` into the `docs/` folder (replace the sample `docs/.jar_data.json`).

2. Preview locally from the repo root:

Option A — run a local server (recommended):

```cmd
py -3 -m http.server 8000
```

Option: Firebase (serverless, recommended)

This project includes optional Firestore support so the static UI can use a central, always-available database without you running a server.

Steps to enable Firestore mode:

1. Create a Firebase project at https://console.firebase.google.com and add a Web app.
2. Create a Firestore database (start in test mode for development).
3. Copy the web SDK config object from Project Settings -> Your apps and create `docs/firebase-config.js` with contents:

```js
window.FIREBASE_CONFIG = {
	apiKey: "...",
	authDomain: "your-project.firebaseapp.com",
	projectId: "your-project-id",
	storageBucket: "your-project.appspot.com",
	messagingSenderId: "...",
	appId: "..."
};
```

4. Commit `docs/firebase-config.js` to the repo? NO — do not commit secrets. Instead add the file locally on the machine that serves the static site, or host the static site somewhere and provide the file there.
5. Optional: add Firestore security rules to require authentication for writes. For quick testing you can use test mode, but for production enable rules.

Once `docs/firebase-config.js` exists and contains your config, the UI will connect to Firestore and read/write the central document `jar/data` and updates will be visible to all clients in realtime.

If you want, I can implement the Firestore rules and a small script to initialize the db document for you.

Open http://localhost:8000/docs/

Option B — open directly (no Python required):

 - Double-click `docs\index.html` in Explorer. The page includes a built-in fallback dataset so it will work without a server. To view your real data, copy your `.jar_data.json` into the `docs/` folder.

3. Publish: push `docs/` to `main`, then go to GitHub -> Settings -> Pages -> Source: Branch `main` / folder `/docs` and save.

Run the interactive server (optional)

1. Create a virtual environment and install dependencies:

```cmd
py -3 -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

2. Run the server from the repo root:

```cmd
py -3 web_app.py
```

3. Open http://localhost:5000/ in your browser. The page will now show Mark Done / Missed buttons that persist to `.jar_data.json` in the repo root.

If `py` or `python` are not on your PATH, use your system's Python launcher accordingly.

