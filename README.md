<div align="center">

# ASTRAM — Traffic Intelligence Platform

**Event-driven congestion control for Bengaluru Traffic Police**

*Built for the Flipkart × BTP Hackathon 2025*

![Python](https://img.shields.io/badge/Python-3.9%2B-blue?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![scikit-learn](https://img.shields.io/badge/scikit--learn-1.6-F7931E?logo=scikit-learn&logoColor=white)

</div>

---

## What is ASTRAM?

ASTRAM is a real-time traffic event management platform trained on the **ASTRAM dataset** — anonymized Bengaluru Traffic Police (BTP) incident records covering thousands of events across the city's road network.

Given any traffic incident (breakdown, protest, VIP movement, procession, etc.), ASTRAM:

1. Predicts **how severe** it will be and how long it will last
2. Decides the **right police response** (monitor → add manpower → barricades → full diversion)
3. Calculates **exact officer count** from corridor history and crowd size
4. Plans **alternate routes** that avoid known congestion hotspots
5. Recommends the **nearest police stations** ranked by current load

---

## Features

| Module | What it does |
|--------|-------------|
| **ML Severity Engine** | ExtraTreesRegressor pipeline predicts road closure duration → maps to 0–100 severity score with `Low / Medium / High / Critical` labels |
| **Police Protocol System** | Rule-based thresholds translate severity into action: monitor, increase manpower, deploy barricades, or activate diversion |
| **Officer Deployment** | Formula accounts for corridor historical density, event type bonus, and crowd size |
| **Barricade Intelligence** | Logistic regression classifier (with heuristic fallback) predicts barricade necessity; places them at corridor endpoint junctions |
| **Congestion Hotspot Detection** | DBSCAN clustering (eps=800 m, min\_samples=4) on the events dataset; results shown as pixel-stable markers on the live map |
| **Cascade-Aware Routing** | Yen's k-shortest-paths on a Bengaluru road graph (16 junctions, 23 corridors); hotspot-penalised edges prevent routing into secondary jams |
| **OSRM Road Geometry** | Real road polylines fetched from the public OSRM API for turn-by-turn accuracy |
| **Station Load Balancing** | In-memory load counters per station (rolling 1-hour window) bias recommendations toward under-utilised stations |
| **Live Retraining** | One-click pipeline re-run from the UI: triggers feature engineering → model training → hot model reload without a server restart |
| **Learning Dashboard** | Model MAE, R², prediction error by corridor, cause-volume bar chart, and day-of-week × hour event heatmap |

---

## Police Protocol Thresholds

| Severity | Score | Action | Response |
|----------|-------|--------|----------|
| **Low** | < 35 | Monitor only | No active intervention needed |
| **Medium** | 35–69 | Increase manpower | Additional officers at key junctions |
| **High** | 70–89 | Deploy barricades | Restrict entry points to prevent gridlock |
| **Critical** | 90–100 | Active diversion | Immediate rerouting of incoming traffic |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  React / Vite SPA                    │
│  ┌────────────┐ ┌──────────────┐ ┌────────────────┐ │
│  │ EventForm  │ │ DiversionMap │ │LearningDashboard│ │
│  │ (incident  │ │ (Leaflet +   │ │ (Recharts:     │ │
│  │  inputs)   │ │  OSRM routes)│ │  model stats)  │ │
│  └────────────┘ └──────────────┘ └────────────────┘ │
│  ┌────────────┐ ┌──────────────┐ ┌────────────────┐ │
│  │ Severity   │ │ResourcePanel │ │ ProtocolPanel  │ │
│  │   Gauge    │ │(officers,    │ │(recommended    │ │
│  │ (0–100)    │ │ barricades,  │ │  action)       │ │
│  │            │ │ stations)    │ │                │ │
│  └────────────┘ └──────────────┘ └────────────────┘ │
└────────────────────┬────────────────────────────────┘
                     │ HTTP / JSON
┌────────────────────▼────────────────────────────────┐
│                FastAPI Backend                       │
│  ┌──────────┐ ┌──────────────┐ ┌─────────────────┐  │
│  │severity  │ │  manpower    │ │diversion_route  │  │
│  │.py       │ │  .py         │ │_planner.py      │  │
│  │          │ │              │ │                 │  │
│  │ExtraTrees│ │Officer count │ │Graph + DBSCAN   │  │
│  │Regressor │ │Barricade ML  │ │Yen's k-paths    │  │
│  │→ 0-100   │ │Station rank  │ │OSRM geometry    │  │
│  └──────────┘ └──────────────┘ └─────────────────┘  │
│                                                      │
│  Trained on: ASTRAM BTP anonymized event dataset     │
└─────────────────────────────────────────────────────┘
```

---

## Tech Stack

**Backend**

| Library | Version | Role |
|---------|---------|------|
| Python | 3.9+ | Runtime |
| FastAPI | 0.115 | REST API framework |
| uvicorn | 0.34 | ASGI server |
| scikit-learn | 1.6.1 | ML pipelines, ExtraTrees, LogisticRegression |
| LightGBM | 4.6 | Gradient boosting (trained, compared vs ExtraTrees) |
| NetworkX | 3.2.1 | Road graph + Yen's k-shortest-paths |
| pandas / numpy | 2.2 / 2.0 | Data processing |
| joblib | 1.5 | Model serialization |
| folium | 0.20 | Server-side map rendering |
| requests | 2.32 | OSRM API calls |

**Frontend**

| Library | Role |
|---------|------|
| React 18 | UI framework |
| Vite | Build tool / dev server |
| react-leaflet / Leaflet | Interactive map |
| Framer Motion | View transitions |
| Recharts | Learning dashboard charts |
| lucide-react | Icons |

---

## Road Network

16 major Bengaluru junctions connected by 23 named corridors, each weighted by historical event density from the ASTRAM dataset:

```
Yelahanka ──── Hebbal ──── Mekhri Circle ──── CBD
    │             │                             │
    │         Nagavara ── KR Puram ─ Whitefield │
    │             │           │                 │
Jalahalli ─ Yeshwanthpura  Koramangala      Jayanagar
    │             │           │                 │
Kengeri ─── Vijayanagar    Silk Board ─ Electronic City
                               │
                           Bannerghatta
```

High-traffic corridors (Mysore Road 743 events, Bellary Road 610, Tumkur Road 458) get higher officer multipliers automatically.

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/state` | Full graph state: nodes, edges, hotspots, active station loads |
| `GET` | `/api/scenario/{index}` | Pre-built demo scenarios (0=Breakdown, 1=VIP Movement, 2=Procession) |
| `GET` | `/api/corridors` | Sorted list of all named corridors |
| `GET` | `/api/nodes` | Junction id → display name map |
| `POST` | `/api/event` | Full analysis: severity + officers + barricades + diversion route |
| `POST` | `/api/reset-load` | Reset in-memory station load counters |
| `GET` | `/api/learning/overview` | Model MAE, R², dataset stats |
| `GET` | `/api/learning/error-by-corridor` | Mean prediction error per corridor |
| `GET` | `/api/learning/cause-volume` | Event count vs median closure duration by cause |
| `GET` | `/api/learning/time-heatmap` | Day-of-week × hour event volume matrix |
| `POST` | `/api/retrain` | Re-run feature engineering + training, hot-reload model |

### POST `/api/event` — Request Body

```json
{
  "event_cause": "procession",
  "corridor": "Mysore Road",
  "zone": "West",
  "priority": "High",
  "requires_road_closure_bool": 1,
  "hour": 18,
  "dow": 4,
  "latitude": 12.9617,
  "longitude": 77.5213,
  "crowd_size": 5000,
  "junction": "Vijayanagar",
  "blocked_corridor": "Mysore Road",
  "origin": "Kengeri",
  "destination": "CBD"
}
```

### POST `/api/event` — Response

```json
{
  "predicted_closure_min": 187.4,
  "severity_score": 74,
  "severity_label": "High",
  "requires_diversion": true,
  "confidence": "Medium",
  "officers_needed": 22,
  "barricade_needed": true,
  "barricade_confidence": 0.71,
  "estimated_barricade_points": 2,
  "barricade_locations": [...],
  "recommended_stations": [...],
  "police_protocol": {
    "action": "Deploy barricades",
    "reason": "Congestion nearing critical levels...",
    "requires_action": true
  },
  "human_instruction": "Deploy 22 officers from Vijayanagar PS to Mysore Road...",
  "diversion": { "primary": [...], "secondary": [...] }
}
```

---

## ML Models

### Severity Regressor (`best_congestion_pipeline.pkl`)

Predicts road closure duration in minutes, converted to a 0–100 score via exponential normalization.

**Features used:**
- `event_cause`, `corridor`, `zone`, `priority` (categorical, one-hot encoded)
- `requires_road_closure_bool`
- `hour_sin`, `hour_cos`, `dow_sin`, `dow_cos` (cyclical time encoding)
- `is_weekend`
- `latitude`, `longitude`
- `distance_to_cbd` (haversine from MG Road)
- `historical_corridor_density`, `historical_zone_density`

**Training:** `eda_and_feature_engineering.py` → `train_regressors.py`
Multiple regressors evaluated (ExtraTrees, RandomForest, LightGBM, XGBoost); best by MAE is saved.

### Barricade Classifier (`barricade_pipeline.pkl`)

LogisticRegression on `event_cause + severity_score` → probability of road closure required.
Threshold: `confidence ≥ 0.4` → barricades needed.
Falls back to a calibrated heuristic (based on historical closure rates per cause) if the pkl is unavailable or version-mismatched.

---

## File Structure

```
Flipkart-round-2/
│
├── server.py                      # FastAPI app — all 11 endpoints
├── config.py                      # Constants: DATA_FILE, CBD coords, PROTOCOL_THRESHOLDS
├── graph_config.py                # 16 junctions + 23 corridor edges with event counts
├── severity.py                    # Loads pipeline, predict_severity()
├── manpower.py                    # Officers, barricade ML/heuristic, station ranking
├── diversion_route_planner.py     # Graph build, DBSCAN hotspots, Yen's paths, OSRM
│
├── eda_and_feature_engineering.py # EDA + feature matrix generation → engineered_features.csv
├── train_regressors.py            # Model comparison + training → best_congestion_pipeline.pkl
├── train_barricade_classifier.py  # Trains barricade_pipeline.pkl
├── test_phase1_routing.py         # Route planner integration tests
│
├── best_congestion_pipeline.pkl   # Trained severity regressor
├── barricade_pipeline.pkl         # Trained barricade classifier
├── model_metadata.json            # MAE, R², training timestamp
├── engineered_features.csv        # Feature matrix (generated)
├── density_mappings.json          # Corridor/zone density lookup
│
├── requirements.txt
│
└── frontend/
    ├── src/
    │   ├── App.jsx                # Root: routing, state, API calls
    │   ├── index.css              # Global styles + mobile layout
    │   └── components/
    │       ├── DiversionMap.jsx   # Leaflet map: routes, hotspots, protocol strip
    │       ├── EventForm.jsx      # Incident input form + scenario cards
    │       ├── SeverityGauge.jsx  # 0–100 arc gauge
    │       ├── ResourcePanel.jsx  # Officers, barricades, station table
    │       ├── ProtocolPanel.jsx  # Protocol action card
    │       └── LearningDashboard.jsx # Charts: MAE, error by corridor, heatmap
    ├── package.json
    └── vite.config.js
```

---

## Setup & Running

### Prerequisites

- Python 3.9+
- Node.js 18+

### 1 — Python dependencies

```bash
pip install -r requirements.txt
```

### 2 — Train the models

```bash
python eda_and_feature_engineering.py   # generates engineered_features.csv
python train_regressors.py              # generates best_congestion_pipeline.pkl
```

Check printed MAE and R² before continuing. Optionally train the barricade classifier:

```bash
python train_barricade_classifier.py    # generates barricade_pipeline.pkl
```

### 3 — Frontend dependencies

```bash
cd frontend && npm install
```

### 4 — Run

**Terminal 1 — backend**
```bash
python server.py
# API live at http://127.0.0.1:8000
```

**Terminal 2 — frontend**
```bash
cd frontend && npm run dev
# App live at http://localhost:5173
```

---

## Demo Flow

1. Open the app. Three scenario cards load automatically (Breakdown, VIP Movement, Procession).
2. Click a card or fill the form manually → **Analyze**.
3. The **Analyze Event** tab shows severity score, officers needed, barricade assessment, and the recommended protocol action.
4. Switch to **Route Map** to see the primary and secondary diversion routes with OSRM-accurate geometry, congestion hotspot markers, and the protocol strip overlay.
5. Switch to **Model Performance** to inspect prediction accuracy, error patterns by corridor, and cause-volume trends.
6. Click **Retrain** in the dashboard to re-run the full pipeline against the latest data — the model hot-reloads without restarting the server.

### Resetting station load between runs

```bash
curl -X POST http://127.0.0.1:8000/api/reset-load
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Backend won't start | `best_congestion_pipeline.pkl` is missing — run `python train_regressors.py` |
| `InconsistentVersionWarning` on startup | Retrain with `python train_regressors.py` using your installed scikit-learn version |
| "Cannot connect to server" in UI | Confirm backend is running on port 8000 (`lsof -ti:8000`) |
| Port 8000 already in use | `lsof -ti:8000 \| xargs kill -9` |
| Severity score always 100 | Outliers in data — re-run `eda_and_feature_engineering.py` then retrain |
| Barricade model warning | `barricade_pipeline.pkl` was trained on a different sklearn version — server falls back to calibrated heuristic automatically |

---

## Dataset

**ASTRAM Event Data (anonymized)** — Bengaluru Traffic Police incident records.
Columns include: `event_cause`, `corridor`, `zone`, `latitude`, `longitude`, `start_datetime`, `closed_datetime`, `priority`, `requires_road_closure`, `police_station`, and more.

The dataset is loaded at server startup, filtered to the Bengaluru bounding box (12.7–13.2°N, 77.3–77.9°E), and used for:
- Training the severity regressor and barricade classifier
- Computing DBSCAN congestion hotspots
- Deriving per-corridor officer multipliers
- Building station coordinate maps
