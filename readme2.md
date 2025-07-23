# Lambda Rim 
## Because 99% ain’t a free throw

**Lead Developer | Feb 2025 – Present**  
A full-stack, AI-powered platform that automatically analyzes NBA “Over/Under” picks on PrizePicks. From OCR’ing screenshots to running Poisson, Monte Carlo & GARCH volatility forecasts (including playoff games), and generating natural-language bet explanations via ChatGPT, this site manages the entire pipeline end-to-end—hosted on Firebase Hosting + Cloud Run with CI/CD.

---

## 🚀 Project Overview

- **Objective:** Predict NBA player point performances (“Over/Under” picks) using statistical models (Poisson, Monte Carlo, GARCH volatility) and AI-driven explanations.  
- **Live Outcome:** Turned \$10 into \$3,279+ on PrizePicks (29,900% ROI) with an 11/14 lineup win rate.  
- **Core Features:**  
  - **Screenshot Parsing (OCR):** Upload PrizePicks cards, extract player & threshold pairs.  
  - **Player Pipeline:**  
    - Season & last-5 game averages  
    - Poisson probability  
    - Monte Carlo simulation  
    - GARCH volatility forecast (regular season & playoffs)
    - Injury report scraping
    - Importance scoring (minutes + usage) to label Starter/Rotation/Bench
    - ChatGPT-powered bet explanation  
  - **Playoff Support:** Automatically switches to playoff stats after ≥ 5 postseason games.  
  - **Real-Time Updates:** Background Cloud Functions mark “Concluded” games and settle bets.  
  - **CI/CD & Hosting:** React + Vite on Firebase Hosting, Flask + Docker on Cloud Run, GitHub Actions auto-deploy.

---

## 📸 Pre Flight Website Access

[Website Link](https://prizepicksproject-15337.web.app/)

- **Currently, the project is still in development as more features will be integrated along with bug fixes** 
  - If you would like access to the website despite it's early development phase, please feel free to reach out to bryanram2024@gmail.com

---

## 📸 Demo Video

[Watch on GitHub](https://github.com/user-attachments/assets/ec796b28-824e-4374-8d9a-beedc7a0ed4e)

---

## 🖼️ Screenshots

### Home Page  
![](https://github.com/user-attachments/assets/39f4e1e9-add3-415b-95ca-03cb9c5b3129)  
Greeted by Earnings, Active Bets & Live Picks.

### Player Analysis Panel  
![](https://github.com/user-attachments/assets/8d960312-30c7-47f6-9004-ed82facc348b)  
Input a player + threshold → see probability forecasts & AI explanation.

### Processed Players Dashboard  
![](https://github.com/user-attachments/assets/3f9c727b-b315-4688-bd57-0a12a55820dc)  
Aggregated player cards across all users.

---

## 🧰 Tech Stack

### Front-End  
- **React + Vite** – SPA framework  
- **Tailwind CSS** – Utility-first styling  
- **Lucide React** – Icon library  
- **Recharts** – Charts & graphs  

### Back-End  
- **Python 3.9+**  
- **OCaml** - Monte Carlo
- **Flask** – REST API  
- **gunicorn** – WSGI server (Cloud Run)  
- **firebase-admin** – Firestore & Auth  
- **openai** – ChatGPT o4-mini integration

### 📈 Data & Analytics  
- **Poisson & Monte Carlo** – Probability pipelines  
- **GARCH (arch-model)** – Volatility forecasting  
- **pandas, NumPy** – Data wrangling  
- **NBA API** – Stats & box scores  
- **OCR (screenshot_parser.py)** – Image data extraction  
- **Requests** – Web scraping (NBA Injury Report)  
- **!!Coming Soon!!** - ML Algorithm trained off of data stored in Firestore

### Infrastructure & Deployment  
- **Firebase Hosting** – Front-end CDN & SSL  
- **Cloud Run** – Containerized Flask API  
- **Firebase Cloud Functions** – Background jobs & data migration  
- **GitHub Actions** – CI/CD (build → deploy Hosting & Cloud Run)  
- **Docker** – Back-end container  


---


## 📊 Probability & Forecasting Methods

Below is a quick reference on how each analytical value is produced inside the player documents.

### 🔢 Poisson Probability (`poissonProbability`)
- **Data window:** *All* regular‑season games from the current season  
- **Library:** Native Python `math` (no external deps)  
- **Computation:**  
  - Calculate the season scoring average `λ`  
  - Evaluate $$P(X \ge t) \;=\; 1 - \sum_{k=0}^{\lceil t\rceil-1} \frac{e^{-\lambda}\lambda^{k}}{k!}$$  
    where **`t`** is the user‑selected points threshold  
- **Interpretation:** Purely distribution‑based likelihood a player scores **over** the line given their season‑long mean

---

### 🎲 Monte Carlo Probability (`monteCarloProbability`)
- **Data window:** Up to **60** most‑recent games (regular *and* playoff)  
- **Stats used:** sample mean `μ` & standard deviation `σ`  
- **Simulations:** **100 000** random seasons per query  
- **Engine priority:**  
  1. **OCaml** routine exposed through a C shared library (`mc_stub.c`) for speed  
  2. Fallback to NumPy’s `np.random.normal()` if the native lib isn’t available  
- **Output:** Fraction of simulations where the random score ≥ user threshold  
- **Why Monte Carlo?** Captures hot/cold streaks and non‑Gaussian tails better than a single closed‑form model

---

### 📈 GARCH Volatility Forecast (`volatilityForecast`, `volatilityPlayOffsForecast`)
- **Data window:** **Last 50** games (or all playoff games once ≥ 5 exist)  
- **Library:** [`arch`](https://github.com/bashtage/arch) – fits a **GARCH(1,1)** model  
- **Pipeline:**  
  1. Convert the points series to “returns” via first differences  
  2. Fit GARCH(1,1) on those returns  
  3. Return the 1‑step‑ahead forecasted **σ** (square‑root of the predicted variance)  
- **Interpretation:** Forward‑looking volatility that reflects clustering of high‑variance performances

---

Together, these three metrics give a balanced outlook:

| Metric | Scope | Strength |
| ------ | ----- | -------- |
| **Poisson** | Season‑long | Fast analytical baseline |
| **Monte Carlo** | Last ≤ 60 games | Empirical tail‑risk capture |
| **GARCH σ** | Last 50 games | Short‑run variance / streak detection |


---


### Project Scheme
```plaintext
PRIZEPICKS_PREDICTIONWEBSITE/
├── backEnd/
│   ├── app.py
│   ├── backtester.py
│   ├── chatgpt_bet_explainer.py
│   ├── injury_report.py
│   ├── main.py
│   ├── monte_carlo.py
│   ├── player_analyzer.py
│   ├── prediction_analyzer.py
│   ├── requirements.txt
│   ├── screenshot_parser.py
│   └── volatility.py
├── frontEnd/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── scripts/
│   │   ├── services/
│   │   ├── App.css
│   │   ├── App.jsx
│   │   ├── firebase.js
│   │   ├── index.css
│   │   └── main.jsx
├── injury_report_fn/
│   ├── full_injury_report.py
├── .firebaserc
├── firebase.json
└── README.md
```

### Firestore Database Scheme
```plaintext
firestore/
├─ processedPlayers/ (collection)
│   ├── active/ (document)
│   │   └── {first_last_threshold_YYYYMMDD (e.g. aaron_gordon_11.5_20250511)}/ (document)
│   │       ├─ name: string (e.g. Aaron Wiggins)
│   │       ├─ playerId: string (e.g. 1630598)
│   │       ├─ team: string (e.g. Oklahoma City Thunder)
│   │       ├─ position: string (e.g. G)
│   │       ├─ opponent: string (e.g. Minnesota Timberwolves)
│   │       ├─ photoUrl: string
│   │       ├─ teamLogo: string
│   │       ├─ opponentLogo: string
│   │       ├─ gameDate: Timestamp
│   │       ├─ gameTime: string
│   │       ├─ gameType: string
│   │       ├─ teamPlayoffRank: number
│   │       ├─ opponentPlayoffRank: number
│   │       ├─ seasonAvgPoints: number
│   │       ├─ last5RegularGamesAvg: number
│   │       ├─ seasonAvgVsOpponent: number
│   │       ├─ homeAwayAvg: number
│   │       ├─ last5RegularGames: array<map> 
│   │       │    └─ [{ date, points, opponent, opponentFullName, … }, …]
│   │       ├─ advancedPerformance: map
│   │       ├─ careerSeasonStats: array<map>
│   │       ├─ injuryReport: map
│   │       ├─ betExplanation: map
│   │       ├─ poissonProbability: number
│   │       ├─ monteCarloProbability: number
│   │       ├─ volatilityForecast: number
│   │       ├─ season_games_agst_opp: array<map>
│   │       ├─ num_playoff_games: number
│   │       ├─ playoffAvg: number
│   │       ├─ playoff_games: array<map> 
│   │       │    └─ [{ date, points, opponent, …, gameType: "Playoffs" }, …]
│   │       └─ volatilityPlayOffsForecast: number
│   ├── concluded/ (document)
│   │       └── {first_last_threshold_YYYYMMDD}/ 
│   │           └─ (same fields as active/)
│   └── injury_report/ (document)
│           └── {team_name (e.g. indiana_pacers)}/ (document)
│               ├─ lastUpdated: timestamp
│               ├─ players: array<map>
│               │   ├─ gameDate: string
│               │   ├─ gameTime: string
│               │   └─ reason: string
│               └─ team: string
├─ users/{userId}/ (collection)
│   ├─ activeBets/{YYYYMMDDTHHMMSSZ}
│   │   └─ { betAmount, potentialWinnings, picks: [ [0] player_Document_References, [i]... ] }
│   ├─ betHistory/{YYYYMMDDTHHMMSSZ}
│   │   └─ { betAmount, potentialWinnings, betResult, picks: [ [0] /processedPlayers/players/active/first_last_threshold_YYYYMMDD (reference) (e.g. /processedPlayers/players/active/andrew_nembhard_7.5), [i]... ] }
│   ├─ picks: [ [0] /processedPlayers/players/active/first_last_threshold_YYYYMMDD (reference) (e.g. /processedPlayers/players/active/andrew_nembhard_7.5), [i]... ]
│   └─ profileData
└─ admin/
    ├── profile/ 
    ├── analytics/
    │   ├── daily_stats/
    │   ├── user_metrics/
    │   └── system_health/
    ├── monitoring/
    │   ├── api_performance/
    │   └── error_logs/
    └── reports/
        ├── bet_performance/
        └── player_analytics/
```
