# Project Fiji

Project Fiji is a web application designed to manage volunteer activities, events, working groups, and donations. It aims to streamline administrative tasks, facilitate communication, and improve overall operational efficiency.

This system provides tools for volunteer registration, profile management, event and activity coordination, working group assignments, donation tracking, and reporting.

## Documentation

For detailed information about the project, please refer to the following documents:

*   **Functional Specifications:** [docs/functional-specs.md](./docs/functional-specs.md)
    *   Outlines the functional requirements, core functionalities (such as volunteer management, event management, working groups, donation tracking), user roles and permissions, and reporting capabilities of Project Fiji.

*   **Technical Specifications (Software Requirements Specification):** [docs/technical-specs.md](./docs/technical-specs.md)
    *   Defines the software requirements, system architecture, technology stack, data model, external interfaces, and deployment strategy.

## Technology Stack Overview

*   **Backend:** Python, FastAPI
*   **Frontend:** Next.js, Tailwind UI
*   **Database:** Google Firestore
*   **Authentication:** Firebase Authentication
*   **Deployment:** Google Cloud Run (Dockerized applications)
*   **CI/CD:** Google Cloud Build
*   **Repository Structure:** Monorepo (one repository, separate directories for backend and frontend under the fiji repo)

## Project Structure

This project is organized as a monorepo with the following key directories:

*   `backend/`: Contains the Python FastAPI backend application.
*   `frontend/`: Contains the Next.js frontend application.
*   `docs/`: Contains project documentation, including functional and technical specifications.

Refer to the `README.md` files within the `backend/` and `frontend/` directories for specific setup and development instructions for each service.
