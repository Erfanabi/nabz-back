# Proposed Technology Stack

This document outlines the architectural and technology choices for the system, prioritizing offline synchronization, financial data integrity, modular AI integration, and local infrastructure compliance.

---

## 1. Client-Side
*   **Technology:** `React Native` + `TypeScript` (Excluding Flutter).
*   **Rationale:** By using a unified language (`TypeScript`), we can share the core "Financial Engine" logic between the client and the server. This guarantees identical computation results across all platforms, even in offline/serverless modes.

---

## 2. Backend
*   **Architecture & Framework:** `NestJS` as a **Modular Monolith**.
*   **Rationale:** Provides a highly structured and scalable environment. It enforces strict decoupling, ensuring that AI layers remain isolated from the core database and business logic.

---

## 3. Database & Data Management
*   **Server-Side:** `PostgreSQL`.
*   **Client-Side (Local):** `SQLite`.
*   **Financial Data Policy:** 
    *   All monetary values must be stored strictly as **Integers** (using Rials as the base unit).
    *   The use of floating-point numbers for financial calculations is strictly forbidden to prevent precision errors.

---

## 4. API Layer
*   **Protocol:** `REST` (as opposed to GraphQL).
*   **Rationale:** A limited, well-defined catalog of endpoints increases security and creates a predictable structure that can later be directly utilized as "Tools" or "Function Calls" for AI agents.

---

## 5. AI Architecture (Phase 3)
*   **Design:** Operates behind an isolated interface with **no direct access** to the database.
*   **Reliability:** Includes a **Deterministic Fallback** path to ensure the system remains functional if the AI service is unavailable or unresponsive.
*   **Deployment:** Preference for **Self-Hosted LLMs** to maintain strict data privacy and circumvent potential external access restrictions.

---

## 6. Infrastructure & Deployment
*   **Hosting:** Local/Iranian Cloud infrastructure.
*   **Rationale:** Ensures consistent service accessibility, lower latency for local users, and independence from international cloud service restrictions.
