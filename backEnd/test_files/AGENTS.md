# Guidelines for Codex Agents

This repository contains a React front-end under `frontEnd/`, a Flask based
back-end under `backEnd/`, and a small Cloud Function under
`injury_report_fn/`. The long README and the file named
`Lambda Rim - Proejct In-Depth Scheme && File Explanations.txt` contain high
level design notes.

## Setup
- Use **Python 3.9+**.
- Install back-end dependencies with:
  ```bash
  pip install -r backEnd/requirements.txt
  ```
- The front-end uses **Node 18+**. Install packages with:
  ```bash
  npm ci --prefix frontEnd
  ```

## Running
- Start the Flask API locally with:
  ```bash
  python backEnd/app.py
  ```
- The React dev server can be started via:
  ```bash
  npm run dev --prefix frontEnd
  ```
- Build the production front-end with:
  ```bash
  npm run build --prefix frontEnd
  ```

## Testing
There are currently no automated tests. Before committing, run:
```bash
python -m py_compile backEnd/*.py
npm run build --prefix frontEnd
```
This checks that the Python files compile and the React build succeeds.

## Commit Style
- Keep commit messages concise (≤72 chars) and prefixed with `feat:`,
  `fix:` or `docs:` as appropriate.
- Update documentation whenever behavior changes.

## Pull Requests
Include a short summary of changes and mention any manual testing or build
steps run.