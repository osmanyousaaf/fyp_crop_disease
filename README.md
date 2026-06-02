# Crop Disease Prediction (Expo + Flask)

This repo contains:

- **Backend (Flask API)**: `backend/` (image prediction + auth + health endpoint)
- **Mobile app (Expo / React Native)**: `frontCrops/` (camera/gallery upload → calls backend `/api/predict`)

## Prerequisites

### Required

- **Git**
- **Python 3.10+** (recommended)
- **Node.js 18+** (recommended) + **npm**
- **Expo Go app** on your Android/iOS phone (from Play Store / App Store)

### Optional (for best Expo experience)

- Install Expo CLI (not strictly required):

```bash
npm install -g expo
```

## 1) Clone and open the project

If you already have the repo, skip.

```bash
git clone https://github.com/osmanyousaaf/fyp_crop_disease.git
cd fyp_crop_disease
```

## 2) Run the Backend (Flask)

The backend is inside `backend/`. It runs a Flask server and exposes:

- `GET /api/health` (or `/`) → backend + model readiness
- `POST /api/predict` → takes JSON `{ image: "<base64 or dataURL>", sector?: "orchard_canopy|field_core" }`

### 2.1 Create a virtual environment (Windows PowerShell)

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

If PowerShell blocks activation, run PowerShell as Admin once:

```bash
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

### 2.2 Install Python dependencies

```bash
pip install -r requirements.txt
```

### 2.3 Start the backend (recommended port: 5020)

The Expo app example config expects the API at `http://127.0.0.1:5020`.

```bash
$env:PORT=5020
python app.py
```

You should see Flask running, then test it:

```bash
curl http://127.0.0.1:5020/api/health
```

### 2.4 Models / artifacts (important)

This backend tries to load model artifacts from these folders (relative to repo root):

- `FYP_PlantDisease/` (Canopy Lab / PlantVillage style)
- `crop leaves  2nd models saved/` (AgriCore / staple crops)

If the folders are missing or incomplete, `/api/health` will show `"ready": false` and `/api/predict` may return `503`.

You can override the model directories using environment variables:

```bash
# Example: point to a different folder for models
$env:FYP_MODEL_DIR_GARDEN="C:\path\to\FYP_PlantDisease"
$env:FYP_MODEL_DIR_STAPLE="C:\path\to\crop leaves  2nd models saved"
python app.py
```

## 3) Run the Frontend (Expo)

The Expo app is inside `frontCrops/`.

### 3.1 Install Node dependencies

Open a **new terminal** (keep backend running), then:

```bash
cd frontCrops
npm install
```

### 3.2 Configure API base URL

The app reads `EXPO_PUBLIC_API_URL`.

1) Copy the example env file:

```bash
copy .env.example .env.local
```

2) Ensure it matches your backend:

```bash
# in frontCrops/.env.local
EXPO_PUBLIC_API_URL=http://127.0.0.1:5020
```

### 3.3 Start Expo (development server)

```bash
npx expo start
```

You’ll see a QR code + options in the terminal.

## 4) Use Expo Go on your phone (real device)

### Option A (best): Same Wi‑Fi / LAN mode

- Connect your **PC** and **phone** to the **same Wi‑Fi**
- Run:

```bash
npx expo start
```

- In the Expo terminal UI, pick **LAN** (default in many setups)
- Open **Expo Go** on your phone and **scan the QR**

### Option B: Tunnel mode (works even on different networks)

If LAN doesn’t work (network restrictions, different Wi‑Fi, etc.):

- Start Expo and choose **Tunnel** in the Expo options (or press `t` in the Expo terminal UI)
- Scan the new QR in Expo Go

### Important: API URL when using a real phone

`http://127.0.0.1:5020` works only on your PC itself.

If you use a real phone, set `EXPO_PUBLIC_API_URL` to your **PC’s LAN IP**, e.g.:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.50:5020
```

To find your PC IP on Windows:

```bash
ipconfig
```

Then restart Expo after changing `.env.local`:

```bash
npm run start:clear
```

## 5) Typical “run everything” commands (copy/paste)

### Terminal 1 (backend)

```bash
cd fyp_crop_disease\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:PORT=5020
python app.py
```

### Terminal 2 (expo app)

```bash
cd fyp_crop_disease\frontCrops
npm install
copy .env.example .env.local
npx expo start
```

## 6) Troubleshooting

### Expo app says “EXPO_PUBLIC_API_URL is not set”

- Make sure you created `frontCrops/.env.local`
- Make sure it contains `EXPO_PUBLIC_API_URL=...`
- Restart Expo (`npm run start:clear`)

### App can’t reach backend from phone

- Use your **PC LAN IP** in `EXPO_PUBLIC_API_URL` (not `127.0.0.1`)
- Make sure Windows Firewall allows inbound connections to your chosen `PORT` (e.g. 5020)

### Backend returns 503 “Model … is not deployed yet”

- Check `GET /api/health` to see which sector is not ready
- Ensure the model artifact folders exist and contain required files
