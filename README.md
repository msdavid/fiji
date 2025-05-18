# Project Fiji

> **Quick Start:** If you have already set up your environment, jump to the [Running the Application Locally](#running-the-application-locally) section.

Project Fiji is a web application designed to manage volunteer activities, events, working groups, and donations. It aims to streamline administrative tasks, facilitate communication, and improve overall operational efficiency.

This system provides tools for volunteer registration, profile management, event and activity coordination, working group assignments, donation tracking, and reporting.

## Documentation

For detailed information about the project, please refer to the following documents:

*   **Functional Specifications:** [docs/functional-specs.md](./docs/functional-specs.md)
    *   Outlines the functional requirements, core functionalities (such as volunteer management, event management, working groups, donation tracking), user roles and permissions, and reporting capabilities of Project Fiji.

*   **Technical Specifications (Software Requirements Specification):** [docs/technical-specs.md](./docs/technical-specs.md)
    *   Defines the software requirements, system architecture, technology stack, data model, external interfaces, and deployment strategy.

## Development Environment Setup

This section guides you through setting up your local development environment and configuring the necessary cloud services (Google Cloud Platform and Firebase) from scratch.

### 1. Prerequisites

*   **Google Cloud SDK (gcloud CLI):** [Installation Guide](https://cloud.google.com/sdk/docs/install)
*   **Node.js and npm:** (Frontend) [Download Node.js](https://nodejs.org/) (LTS version recommended)
*   **Python & uv:** (Backend) Python 3.10+ and `uv` for package management.
    *   Install `uv`: `pip install uv` (or see [uv installation guide](https://github.com/astral-sh/uv))
*   **Git:** For version control.
*   **A Google Account:** For GCP and Firebase.

### 2. Google Cloud Platform (GCP) and Firebase Project Setup

This assumes you are starting with a new GCP project.

1.  **Create a new GCP Project:**
    *   Go to the [GCP Console - Project Selector](https://console.cloud.google.com/projectselector2/home/dashboard).
    *   Click "CREATE PROJECT".
    *   Enter a "Project name" (e.g., "Fiji App"). Note the "Project ID" (e.g., `fiji-app-12345`). This ID is globally unique.
    *   Select a "Billing account" (required for most services beyond the free tier).
    *   Select an "Organization" and "Location" if applicable.
    *   Click "CREATE".

2.  **Enable Required GCP APIs:**
    *   Ensure your new project is selected in the GCP console.
    *   Navigate to "APIs & Services" > "Library".
    *   Search for and enable the following APIs for your project:
        *   **Cloud Firestore API** (for the database)
        *   **Identity Platform API** (Firebase Authentication relies on this; enabling Firebase Auth often handles this)
        *   **Cloud Storage API** (Firebase Storage relies on this. Also ensure "Cloud Storage for Firebase API" is enabled, usually handled by Firebase setup)
        *   **Cloud Run API** (for deploying the backend/frontend as services)
        *   **Cloud Build API** (for automated CI/CD pipelines)
        *   **Artifact Registry API** (if you plan to store Docker images in GCP)

3.  **Set up Firebase in your GCP Project:**
    *   Go to the [Firebase Console](https://console.firebase.google.com/).
    *   Click "Add project".
    *   From the "Project name" dropdown, select your newly created GCP project.
    *   Click "Continue".
    *   Decide whether to enable Google Analytics for this Firebase project (optional for development, can be added later). Click "Continue".
    *   Review the terms and click "Add Firebase". This links Firebase services to your existing GCP project.

4.  **Configure Firebase Authentication:**
    *   In the Firebase Console, navigate to "Authentication" (under "Build" in the left menu).
    *   Click "Get started".
    *   Under the "Sign-in method" tab, enable the "Email/Password" provider. Click "Save".
    *   (Optional) Enable any other sign-in providers you intend to use (e.g., Google, Facebook).

5.  **Configure Firestore Database:**
    *   In the Firebase Console, navigate to "Firestore Database" (under "Build" in the left menu).
    *   Click "Create database".
    *   Choose "Start in **production mode**". This sets up more secure default security rules.
    *   Select a Cloud Firestore location (e.g., `us-central`, `europe-west`). **This choice is permanent for the project.** Choose a location close to your users.
    *   Click "Enable".
    *   **Initial Security Rules:** For development, you might want to allow reads/writes if a user is authenticated. Go to the "Rules" tab in Firestore. A common starting point for development (replace with more granular rules for production):
        ```firestore-rules
        rules_version = '2';
        service cloud.firestore {
          match /databases/{database}/documents {
            // Allow read/write access only to authenticated users.
            // Restrict further based on your application's needs for specific collections.
            match /{document=**} {
              allow read, write: if request.auth != null;
            }
          }
        }
        ```
        Click "Publish" to save the rules.

6.  **Configure Firebase Storage:**
    *   **Navigate to Storage:** In the Firebase Console, find "Storage" in the left-hand navigation menu (usually under the "Build" category, alongside Firestore Database and Authentication). Click on it.
    *   **Get Started:** If this is your first time setting up Storage for this project, you'll see a "Get started" button. Click it.
    *   **Security Rules Modal:** A dialog box will appear explaining the default security rules for Cloud Storage. These rules, by default, deny all read and write access to unauthenticated users. For development, you'll likely adjust these later. Click "Next" (or "Got it" depending on the UI version).
    *   **Choose Location:** You'll be prompted to select a location for your default Cloud Storage bucket.
        *   **Important:** It's highly recommended to choose the **same location as your Cloud Firestore database** to minimize latency and costs.
        *   This location choice is **permanent** for the default bucket.
        *   Select your desired location from the dropdown (e.g., `us-central1`, `europe-west1`).
    *   Click "Done". Firebase will provision your default Storage bucket. This might take a moment.
    *   **Review/Edit Security Rules:** Once the bucket is created, you'll be taken to the Storage dashboard (Files tab).
        *   Navigate to the "**Rules**" tab within the Storage section.
        *   The initial rules will look something like this (denying access):
            ```storage-rules
            rules_version = '2';
            service firebase.storage {
              match /b/{bucket}/o {
                match /{allPaths=**} {
                  allow read, write: if false; // Or if request.auth != null && request.auth.uid == <some_condition>;
                }
              }
            }
            ```
        *   **For development purposes**, you might want to allow authenticated users to read and write files. A common starting point (be sure to secure this properly for production):
            ```storage-rules
            rules_version = '2';
            service firebase.storage {
              match /b/{bucket}/o {
                // Allow read and write access to all paths for authenticated users
                // For production, restrict by path (e.g., /users/{userId}/), file type, size, etc.
                match /{allPaths=**} {
                  allow read, write: if request.auth != null;
                }
              }
            }
            ```
        *   Modify the rules as needed and click "**Publish**".
    *   The `storageBucket` URL (e.g., `your-project-id.appspot.com`) is automatically configured for your Firebase project and will be part of the `firebaseConfig` object used by your frontend (see next step).

7.  **Create a Web App in Firebase (for Frontend Configuration):**
    *   In the Firebase Console, go to "Project Overview" (click the Firebase icon or project name at the top).
    *   In the center, under "Get started by adding Firebase to your app", click the Web icon (`</>`).
    *   Enter an "App nickname" (e.g., "Fiji Frontend"). This is for your reference.
    *   Optional: Set up Firebase Hosting if you plan to use it. You can skip this for now if deploying elsewhere.
    *   Click "Register app".
    *   Firebase will display the `firebaseConfig` object. **Copy these values carefully.** You will need them for the frontend's `.env.local` file. It will look like:
        ```javascript
        const firebaseConfig = {
          apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXX",
          authDomain: "your-project-id.firebaseapp.com",
          projectId: "your-project-id", // Should match your GCP Project ID
          storageBucket: "your-project-id.appspot.com", // This is your Firebase Storage bucket
          messagingSenderId: "123456789012",
          appId: "1:123456789012:web:abcdef1234567890abcd",
          // measurementId: "G-XXXXXXXXXX" // Optional, if you enabled Analytics
        };
        ```
    *   Click "Continue to console". You can always find this config again in Project Settings > General > Your apps.

8.  **Configure Application Default Credentials (ADC) for Local Backend Development:**
    *   ADC allows your local backend server to authenticate with GCP services (like Firestore and Storage) using your user credentials, without needing service account keys for local dev.
    *   Ensure you have the gcloud CLI installed and initialized (`gcloud init`).
    *   Log in with your Google account that has access to the GCP project:
        ```bash
        gcloud auth login
        ```
    *   Set up Application Default Credentials by logging in with your user credentials for this purpose:
        ```bash
        gcloud auth application-default login
        ```
        This command will open a browser window for authentication.
    *   Set your current GCP project for the gcloud CLI to ensure commands target the correct project:
        ```bash
        gcloud config set project YOUR_GCP_PROJECT_ID
        ```
        Replace `YOUR_GCP_PROJECT_ID` with the actual ID of your GCP project (e.g., `fiji-app-12345`).

### 3. Backend Setup

1.  **Clone the Repository (if not already done):**
    ```bash
    git clone <your-repository-url>
    cd project-fiji # Or your repository's root directory
    ```

2.  **Navigate to Backend Directory:**
    ```bash
    cd backend
    ```

3.  **Create `.env` file for Backend:**
    *   In the `backend/` directory, create a file named `.env`.
    *   Add the following environment variable, replacing `YOUR_GCP_PROJECT_ID` with your actual GCP Project ID:
        ```env
        # backend/.env
        GOOGLE_CLOUD_PROJECT=YOUR_GCP_PROJECT_ID
        # Optional: If you need to specify the storage bucket for the backend Admin SDK
        # FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com 
        ```
        *Note: The Firebase Admin SDK (used in the backend) can usually auto-discover the default Storage bucket associated with the project if `GOOGLE_CLOUD_PROJECT` is set and ADC is configured. Explicitly setting `FIREBASE_STORAGE_BUCKET` might be needed in some complex scenarios or if using a non-default bucket.*

4.  **Set up Python Virtual Environment and Install Dependencies using `uv`:**
    *   Ensure `uv` is installed (`pip install uv`).
    *   From the `backend/` directory, create and activate a virtual environment (uv creates `.venv` by default):
        ```bash
        uv venv
        ```
    *   Install dependencies from `pyproject.toml` (or `requirements.txt` if that's used):
        ```bash
        uv pip sync 
        # If you have a requirements.txt and not using pyproject.toml for dependencies:
        # uv pip install -r requirements.txt
        ```

### 4. Frontend Setup

1.  **Navigate to Frontend Directory:**
    ```bash
    # From project root:
    cd frontend
    # Or from backend/ directory:
    # cd ../frontend 
    ```

2.  **Create `.env.local` file for Frontend Secrets:**
    *   In the `frontend/` directory, create a file named `.env.local`.
    *   Add the Firebase configuration values you copied when creating the web app in Firebase (Step 2.7). **Prefix each key with `NEXT_PUBLIC_`**:
        ```env
        # frontend/.env.local
        NEXT_PUBLIC_FIREBASE_API_KEY="YOUR_API_KEY_FROM_FIREBASE_CONFIG"
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="YOUR_AUTH_DOMAIN_FROM_FIREBASE_CONFIG"
        NEXT_PUBLIC_FIREBASE_PROJECT_ID="YOUR_PROJECT_ID_FROM_FIREBASE_CONFIG"
        NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="YOUR_STORAGE_BUCKET_FROM_FIREBASE_CONFIG"
        NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="YOUR_MESSAGING_SENDER_ID_FROM_FIREBASE_CONFIG"
        NEXT_PUBLIC_FIREBASE_APP_ID="YOUR_APP_ID_FROM_FIREBASE_CONFIG"
        # NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="YOUR_MEASUREMENT_ID" # Optional

        # Backend URL for the frontend to connect to
        # Ensure this port matches where your local backend is running
        NEXT_PUBLIC_BACKEND_URL="http://localhost:6001" 
        ```
    *   **Important:** This `.env.local` file is ignored by Git (due to `.gitignore`) and should **not** be committed.

3.  **Install Frontend Dependencies:**
    *   From the `frontend/` directory:
        ```bash
        npm install
        ```

### 5. Initial Data Setup (First-time Admin User & Invitation)

To fully use the application, you'll need an administrative user and roles defined.

1.  **Initialize Firestore with Sysadmin Role (using `backend/utils/initialize_firestore.py`):**
    *   This script creates/updates the `sysadmin` role in your Firestore `roles` collection. The script uses the `GOOGLE_CLOUD_PROJECT` environment variable defined in `backend/.env`.
    *   Navigate to the `backend/` directory in your terminal.
    *   Ensure your Application Default Credentials (ADC) are set up and `GOOGLE_CLOUD_PROJECT` is correctly configured in `backend/.env`.
    *   Run the script:
        ```bash
        # In backend/ directory
        uv run python utils/initialize_firestore.py
        ```
    *   The script should confirm successful creation/update of the `sysadmin` role. The Document ID for this role will be `sysadmin`.

2.  **Create the First Admin User (using `backend/utils/add-admin-user.py`):**
    *   This script creates a user in Firebase Authentication and then creates a corresponding user profile in Firestore, assigning them the "sysadmin" role.
    *   Navigate to the `backend/` directory in your terminal.
    *   Run the script, using `sysadmin` as the role ID (as defined by `initialize_firestore.py`):
        ```bash
        # In backend/ directory
        uv run python utils/add-admin-user.py your-admin-email@example.com YourAdminPassword sysadmin
        ```
        Replace `your-admin-email@example.com` with the desired admin email and `YourAdminPassword` with a strong password.
    *   This script should confirm user creation in Firebase Auth and Firestore.

3.  **Create an Invitation (using `backend/utils/create-invitation.py`):**
    *   This script allows an existing sysadmin user (identified by their role) to generate an invitation token for a new user.
    *   Ensure a sysadmin user exists in Firestore (created in Step 5.2).
    *   Run the script from the `backend/` directory:
        ```bash
        # In backend/ directory
        uv run python utils/create-invitation.py newuser@example.com [--roles ROLE_ID_TO_ASSIGN_1,ROLE_ID_TO_ASSIGN_2]
        ```
        Replace `newuser@example.com` with the email of the user you want to invite.
        Optionally, use `--roles` followed by a comma-separated list of Role Document IDs (e.g., `sysadmin` or other custom role IDs) to assign to the user upon registration. If omitted, `rolesToAssignOnRegistration` will be empty.
    *   The script will output an invitation token. This token can be used with the frontend registration page (e.g., `http://localhost:3002/register?token=THE_GENERATED_TOKEN`).

### 6. Key Configuration Files and Secrets Management

*   **Backend (`backend/`):**
    *   `.env`: Stores `GOOGLE_CLOUD_PROJECT` and optionally `FIREBASE_STORAGE_BUCKET`. This file is typically simple and may not contain highly sensitive secrets if ADC is used for local development.
    *   **Local Development Authentication:** Relies on Application Default Credentials (ADC) via `gcloud auth application-default login`. This allows the backend to securely access GCP services (like Firestore and Storage) using your logged-in gcloud user credentials, avoiding the need to manage service account keys locally.
*   **Frontend (`frontend/`):**
    *   `.env.local`: Stores Firebase client SDK configuration (API keys, project ID, storage bucket, etc.) and the `NEXT_PUBLIC_BACKEND_URL`. **This file is critical for frontend operation and MUST NOT be committed to Git.** It is correctly listed in `frontend/.gitignore` (via `.env*`).
    *   All keys in `.env.local` that need to be accessible in browser-side JavaScript code **must** be prefixed with `NEXT_PUBLIC_`.
*   **Deployment:**
    *   When deploying to services like Google Cloud Run (for the backend) or Vercel/Netlify (for the frontend), the environment variables defined in `backend/.env` and `frontend/.env.local` (and any other necessary runtime configurations) **must be configured directly in the respective hosting service's environment variable settings panel.** They are not deployed from your local `.env*` files.
    *   For services deployed on GCP (like Cloud Run), it's recommended to use Service Accounts with appropriate IAM permissions for authentication, rather than relying on user credentials or ADC in a production environment. The environment variables for the deployed service would then point to these configurations or use built-in identity.

## Technology Stack Overview

*   **Backend:** Python, FastAPI, Uvicorn
*   **Frontend:** Next.js (React), TypeScript, Tailwind CSS
*   **Database:** Google Cloud Firestore
*   **File Storage:** Firebase Storage
*   **Authentication:** Firebase Authentication
*   **Package Management:** `uv` (backend), `npm` (frontend)
*   **Deployment (Planned):** Google Cloud Run (Dockerized applications)
*   **CI/CD (Planned):** Google Cloud Build

## Project Structure

This project is organized as a monorepo with the following key directories:

*   `backend/`: Contains the Python FastAPI backend application.
*   `frontend/`: Contains the Next.js frontend application.
*   `docs/`: Contains project documentation, including functional and technical specifications.
*   `.Q/`: Contains AI agent interaction logs and project context.

Refer to the `README.md` files within the `backend/` and `frontend/` subdirectories if they exist for more specific, component-level details.

## Running the Application Locally

You'll need two separate terminal windows to run the backend and frontend simultaneously.

1.  **Run the Backend (FastAPI with Uvicorn):**
    *   Open a terminal and navigate to the `backend/` directory.
    *   Ensure your Python virtual environment (e.g., `.venv`) is active if you're not using `uv run` directly.
    *   Start the server (we've been using port 6001; adjust if needed):
        ```bash
        # In backend/ directory
        uv run uvicorn main:app --reload --port 6001
        ```
    *   The backend API should be accessible at `http://localhost:6001`. Check terminal output for confirmation.

2.  **Run the Frontend (Next.js):**
    *   Open another terminal and navigate to the `frontend/` directory.
    *   Start the Next.js development server:
        ```bash
        # In frontend/ directory
        npm run dev
        ```
    *   The frontend application should be accessible at `http://localhost:3000` (or another port like 3002 if 3000 is in use). Check the terminal output for the exact URL.
    *   To run the frontend on a different port (e.g., 3001), use the `--port` flag (or `-p`). When using `npm run dev`, you need to pass arguments to the `next dev` script using `--`:
        ```bash
        # In frontend/ directory, to run on port 3001
        npm run dev -- --port 3001
        ```