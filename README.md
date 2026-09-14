# 🚗 NavAIgation

### AI/ML-Based Intelligent Dead Reckoning Navigation

**NavAIgation** is an intelligent navigation system designed to provide continuous vehicle positioning when **GNSS/GPS signals are weak or unavailable**.

The solution uses smartphone **IMU sensors (accelerometer, gyroscope, and magnetometer)** along with GNSS, AI/ML-based processing, sensor fusion, dead reckoning, and offline maps to estimate the vehicle's position during GNSS outages.

It is designed for environments such as **tunnels, dense forests, urban canyons, multi-level parking areas, and GNSS-denied zones**.

---

## 💡 Solution

The system operates in three main modes:

```text
GNSS Available
      ↓
GNSS + INS Fusion
      ↓
Accurate Position
```

When GNSS is lost:

```text
IMU Sensors
    ↓
AI/ML Processing
    ↓
Speed & Motion Estimation
    ↓
Dead Reckoning
    ↓
Map Matching
    ↓
Estimated Position
```

When GNSS becomes available again, the system switches back to **GNSS + INS** and corrects accumulated drift.

The core navigation calculations are designed to run **locally on the device**, allowing navigation to continue without an internet connection.

---

# 📱 Frontend

The mobile application is built using **React Native Expo**.

### Main Responsibilities

* Real-time navigation interface
* Offline map display
* Current vehicle position and routing
* GNSS availability/status
* Dead-reckoning status
* Estimated vehicle speed
* Route visualization
* Sensor data collection
* GNSS outage indication
* Display of estimated and recovered trajectories

### Frontend Technologies

* React Native
* Expo
* JavaScript / TypeScript
* React Navigation
* Device Sensor APIs
* OpenStreetMap Data
* Valhalla Routing

### Frontend Structure

```text
Frontend
├── assets/
├── scripts/
├── sihapp/
├── src/
├── best_speed_model2.pt
├── eas.json
├── expo-env.d.ts
├── gitignore
├── package.json
├── tsconfig.json
└── walking_speed_model.pt
```

---

# ⚙️ Backend

The backend is built using **Node.js and Express.js**.

It provides application-level services while the core dead-reckoning calculations can run locally on the smartphone.

### Backend Responsibilities

* User authentication
* User management
* Navigation session management
* Sensor-session metadata
* Route/session history
* Model/version information
* Application configuration
* Analytics
* REST APIs

### Backend Technologies

* Node.js
* Express.js
* REST API
* JWT Authentication
* Supabase
* PostgreSQL

### Backend Structure

```text
backend/
├── controllers/
├── routes/
├── middleware/
├── models/
├── services/
├── config/
├── server.js
└── package.json
```

---

# 🧠 AI/ML

AI/ML is used for:

* Vehicle speed estimation
* Motion classification
* IMU noise filtering
* Sensor error correction
* Fusion error prediction
* Improving dead-reckoning accuracy

Models can be trained using the **IO-VNBD dataset** and optimized for lightweight, on-device inference.

Technologies include:

* Python
* NumPy
* Pandas
* Scikit-learn
* PyTorch / TensorFlow
* ONNX / TensorFlow Lite

---

# 🏗️ System Architecture

```text
┌──────────────────────────────────┐
│       React Native + Expo        │
│                                  │
│  Map │ Navigation │ Sensor UI    │
│              │                   │
│       IMU + GNSS + AI/ML         │
└───────────────┬──────────────────┘
                │
                │ REST API
                ▼
┌──────────────────────────────────┐
│        Node.js + Express         │
│                                  │
│       Hashing │  Authentication  │
└───────────────┬──────────────────┘
                │
                ▼
          Supabase / PostgreSQL
```

---

# 🚀 Getting Started

## 1. Clone the Repository

```bash
git clone <repository-url>
cd Intelligent_Dead_Reckoning
```

---

## 2. Run the Backend

Navigate to the backend:

```bash
cd backend
```

Install dependencies:

```bash
npm install
```

Create a `.env` file inside the `backend` directory:

```env
PORT=5000

SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key

JWT_SECRET=your_jwt_secret
```

Start the development server:

```bash
node index.js
```

The backend will run on:

```text
http://localhost:5000
```

> If the Expo app is running on a physical phone, use your computer's local network IP instead of `localhost` when configuring the API URL.

---

# 📱 Run the React Native Expo App

Open a **new terminal** and navigate to the mobile application:

```bash
cd Frontend
```

Install dependencies:

```bash
npm install
```

Start Expo:

```bash
npx expo start
```

You can then run the application using the available Expo development options.

> Because the application uses device sensors and other native functionality, an **Expo Development Build** may be required instead of Expo Go.

---

# 🌟 Key Innovation

NavAIgation combines:

**Smartphone IMU + AI/ML + Sensor Fusion + Dead Reckoning + Map Matching + Offline Maps**

to provide a low-cost navigation solution that does not depend entirely on GNSS or specialized vehicle hardware.


---

## 👥 Project

**Project:** NavAIgation
**Problem:** SIH26168
**Domain:** AI/ML + Navigation + Mobile Computing
**Platform:** Smart India Hackathon
**Application:** Intelligent GNSS-Denied Navigation

**Credits:**  
* Avani Patel(AvaniPatel75) 
* Rishil Jani (RishilJani) 
* Milan Sinha (Jarvish1xyz) 
* Dhairy Mehta (Dhairy1287) 
* Rutvik Makvana  (rutvikmakwana7037)
* Saumya Radhanpara (MrSaumyaRadhanpara) 

---
