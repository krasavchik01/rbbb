# SOFTWARE TECHNICAL SPECIFICATION
## "SUITE-A" (v1.0.2)

### 1. GENERAL INFORMATION
**Name:** SUITE-A  
**Version:** 1.0.2  
**Developer and Copyright Holder:** Aidos Tazhbenov  
**Release Year:** 2026

### 2. PURPOSE OF THE SOFTWARE
"SUITE-A" is a comprehensive ERP/BPM platform designed to automate business processes for professional services groups (audit, consulting, valuation).

The system provides a full project management lifecycle — from initial request and approval to final bonus calculation and reporting, utilizing a granular role-based access model.

### 3. FUNCTIONAL CAPABILITIES
The software includes the following key modules:

#### 3.1. Project Management
*   Flexible project lifecycle (Creation, Approval, Planning, Execution, Completion).
*   Methodology constructor and procedure templates.
*   Quality control system and multi-level work approval workflows.
*   Employee availability tracking and resource planning.

#### 3.2. Financial Management & Bonuses
*   Automated royalty and bonus calculations based on KPI metrics.
*   Gross profit and project profitability tracking across group companies.
*   Contractor (GPH) expense management and pre-expense tracking.
*   Consolidated executive analytics (CEO Dashboard).

#### 3.3. HR & Operations
*   Time-tracking and automated timesheets.
*   Attendance monitoring with GPS geolocation verification (Office Check-in).
*   Team evaluation system for peer-to-peer assessments.
*   KPI tracking and professional development records.

#### 3.4. Internal Communication (Service Memos)
*   Electronic service memo module with intelligent routing across departments (IT, Procurement, HR, etc.).
*   Approval history and document archiving.

### 4. TECHNICAL STACK
*   **Frontend:** React 18, TypeScript, Vite.
*   **Styling:** Tailwind CSS, Shadcn/UI (utilizing a custom design system).
*   **State & Data:** React Query, Context API.
*   **Backend & Infrastructure:** Supabase (PostgreSQL, Realtime, Auth, Storage), Node.js (REST API).
*   **Containerization:** Docker, Docker Compose.

### 5. ARCHITECTURE AND SECURITY
The system is built on a modern microservices-ready architecture with clear separation between representation and data layers.
*   **Security:** Implemented restricted Role-Based Access Control (RBAC). Each group company has an isolated data environment.
*   **Auditing:** Comprehensive logging of all critical user actions.
*   **Data Protection:** Utilizes SSL encrypted connections and Row Level Security (RLS) policies within the database.

### 6. SYSTEM REQUIREMENTS
*   **Server Side:** Node.js v18+, Docker.
*   **Client Side:** Any modern web browser (Chrome, Firefox, Safari, Edge).

---
**Developer:** Aidos Tazhbenov  
**Signature:** ____________________
