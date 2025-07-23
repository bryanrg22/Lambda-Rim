# Lambda Rim – *The #1 Hub for NBA Fanatasy Sports Betting for 'Over' Points*
<img width="200" height="200" alt="Image" src="https://github.com/user-attachments/assets/c1dadc67-f681-496e-95da-14aa5df64c25" />

> **If they use Math, why can't we? Sign Up For Free Today!**

**Website:** [LambdaRim.com](https://lambdarim.com/)

---

## What is Lambda Rim?

Lambda Rim analyzes a **Fantasy Sports Pick**, and answers one burning question:

> **“Is the *****'over'***** worth my money?”**

Behind that single answer sits a full pipeline—OCR → feature engineering → probabilistic models through machhine learning and statistics → natural‑language rationale—served by a **React + Vite front‑end** and a **Flask API** on Google **Cloud Run**.

---

## 🚀 Current Project Overview

- **Objective:** Predict NBA Player 'Point' performances (“Over” Picks) using Statistical models (Poisson, Monte Carlo, GARCH volatility) and AI-driven explanations.  
- **Core Features:**  
  - **Screenshot Parsing (OCR):** Upload PrizePicks cards, extract player & threshold pairs.  
  - **Player Pipeline:**  
    - Player Data and Stats (Recent Games, Team v Opponent, etc) 
    - Poisson Probability
    - Monte Carlo Simulation
    - GARCH Volatility Forecast
    - Injury Report Scraping
    - Importance Scoring (usage rate, Importance Score) to label Starter/Rotation/Bench
    - ChatGPT-powered Bet Explanation
  - **Playoff Support:** Automatically switches to playoff stats after ≥ 5 postseason games.  
  - **Real-Time Updates:** Background Cloud Functions mark “Concluded” games and settle bets and Scrape Offical NBA Injury Report for up-to-date Injury Information.  
  - **CI/CD & Hosting:** React + Vite on Firebase Hosting, Flask + Docker on Cloud Run, GitHub Actions auto-deploy.
  - **Privacy First**: Account Creation through Google, Microsoft, and Firebase Authentication Methods.
  - **Terms Of Service**: First‑time Users ensures age & jurisdiction compliance.

---

## 🛠️ Tech Stack at a Glance
![Python] ![OCaml] ![ChatGPT] ![Flask] ![React] ![TailwindCSS] ![Google Cloud] ![Pandas] ![Firebase]

### ☁️ Back-End  
- **Python** - BackEnd Engine
- **OCaml** - Monte Carlo Engine
- **Flask** – REST API  
- **gunicorn** – WSGI server (Cloud Run)  
- **firebase-admin** – Firestore & Auth  
- **openai** – ChatGPT o4-mini integration

### 🖼️ Front-End  
- **React + Vite** – SPA framework  
- **Tailwind CSS** – Utility-first styling  

### 📈 Data & Analytics  
- **Poisson & Monte Carlo** – Probability pipelines  
- **GARCH (arch-model)** – Volatility forecasting  
- **pandas, NumPy** – Data wrangling  
- **NBA API** – Stats & box scores  
- **OCR (screenshot_parser.py)** – Image data extraction  
- **Requests** – Web scraping (NBA Injury Report)  
- **!!Coming Soon!!** - ML Algorithm trained off of player picks stored in Firestore

### 🏙️ Infrastructure & Deployment  
- **Firebase Hosting** – Front-end CDN & SSL  
- **Google Cloud Run** – Containerized Flask API  
- **Firebase Cloud Functions** – Background jobs & data migration  
- **GitHub Actions** – CI/CD (build → deploy Hosting & Cloud Run)  
- **Docker** – Back-end container

---

## 📊 More on the Probability & Forecasting Methods

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
- **OCaml Engine:** Routine exposed through a C shared library (`mc_stub.c`) for speed efficiency
- **Output:** Fraction of simulations where the random score ≥ user threshold  
- **Why Monte Carlo?** Captures hot/cold streaks and non‑Gaussian tails better than a single closed‑form model

---

### 📈 GARCH Volatility Forecast
- **Data window:** **Last 50** games
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

##  📸 Demo Videos

---


## What Does the Future Hold for Lambda Rim ?

As the sole developer of **Lambda Rim**, I envision it evolving far beyond an NBA “over points” analyzer. I turned \$10 into \$50+ on PrizePicks just by searcing up simple stats such as averages, injury reports, and team ranks all on my iphone — I saw potential that others overlooked. What many dismiss as pure gambling, I see as a microcosm of the stock market. By mining historical data, applying statistical & machine‑learning models, and detecting hidden patterns, I’m essentially shadowing what a quant does every day.

My hackathon wins and in‑office stints at top quant/software firms (Jane Street, Google) have allowed me to sharpen every algorithm and dashboard I have built. With that expertise, Lambda Rim’s mission is clear:

> **Become the #1 Hub for Fantasy Sports Betting**


## 🔍 Next Steps of Action

### 1. 📊 Expanding Comprehensive Analytics
- **All NBA Categories**: Points, rebounds, assists, blocks, and more  
- **Multi‑League Support**: Extend the same rigorous analytics to MLB, NFL, etc.

### 2. 🤖 Advanced Machine Learning
1. **Baseline Probability Ensemble**  
   Implement Regularised Logistic Regression, LightGBM, CatBoost, and stacking meta‑models—then calibrate—to generate rock‑solid win probabilities and surface your daily “best picks.”
2. **Ticket Optimization & Correlation**  
   Use an integer‑LP optimizer and Gaussian‑copula simulation to craft the single highest‑value multi‑leg ticket.
3. **Learning to Rank**  
   Deploy LambdaMART so the system learns from past outcomes which picks should rise to the top each day.
4. **Deep & Bayesian Models**  
   - **TFT** (Temporal Fusion Transformer) to capture momentum in raw game‑stat sequences  
   - **Hierarchical Bayesian Logistic** to stabilize predictions for rookies and low‑sample players
5. **Heavy Hitters & Fine‑Tuning**  
   Build Player2Vec/TabTransformer embeddings, multi‑task neural nets for exact‑point forecasts, and playoff‑only fine‑tuning to eke out that final edge.

### 3. 🌐 Community Hub
- **Unified Creator Feed**: Twitch, TikTok, Discord—verified creators with performance badges  
- **Social Features**: Friend lists, bet‑history sharing, and reputation scores  
- **Odds Overlays**: Embed real‑time odds on social media videos (e.g., TikTok) to keep every discussion actionable

### 4. 💸 Creator Economy
- **Escrow Marketplace**: A safe, trustless place for creators to sell picks and users to transact  
- **Creator Certification**: Vet & certify talent based on historical performance and on‑chain validation  
- **Reputation & Trust**: Built‑in credibility scores spotlight proven winners and earn user confidence

---

> **Lambda Rim** will soon bridge social media, fantasy sports betting, and users—empowering everyone with built‑in analytical tools fueled by advanced machine learning & statistics.

---

## More About Me!

**Bryan Ramirez‑Gonzalez** – First‑gen Latino, Undergrad Honors CS @ USC '28, Hackathon‑addict, Aspiring Quant.\
*Let’s connect →*
- Website: [bryanram.com](http://bryanram.com) - Learn More about Me Here!
- Resume: [bryanram.com/resume.pdf](http://bryanram.com/resume.pdf)
- Email: [bryanram2024@gmail.com](mailto:bryanram2024@gmail.com)
- LinkedIn: [@bryanrg22](https://linkedin.com/in/bryanrg22)

<img width="250" height="100" alt="Image" src="https://github.com/user-attachments/assets/084cab6e-833e-4a68-a32c-2c66d9e2fbaf" />




[Python]:       https://img.shields.io/badge/python-3670A0?style=for-the-badge&logo=python&logoColor=ffdd54
[OCaml]:        https://img.shields.io/badge/OCaml-%23E98407.svg?style=for-the-badge&logo=ocaml&logoColor=white
[ChatGPT]:      https://img.shields.io/badge/chatGPT-74aa9c?style=for-the-badge&logo=openai&logoColor=white
[Flask]:        https://img.shields.io/badge/flask-%23000.svg?style=for-the-badge&logo=flask&logoColor=white
[React]:        https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB
[TailwindCSS]:  https://img.shields.io/badge/TailwindCSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white
[Firebase]:     https://img.shields.io/badge/firebase-ffca28?style=for-the-badge&logo=firebase&logoColor=black
[Pandas]:       https://img.shields.io/badge/pandas-%23150458.svg?style=for-the-badge&logo=pandas&logoColor=white
[Google Cloud]: https://img.shields.io/badge/GoogleCloud-%234285F4.svg?style=for-the-badge&logo=google-cloud&logoColor=white

