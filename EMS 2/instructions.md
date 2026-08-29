# Project Specifications: Rajarata University Examination Monitoring System

## 1. Project Overview
This project is an Examination Monitoring and Tracking System for Rajarata University. It digitizes the workflow of exam paper handling, marking, 2nd examiner verifications, final marks sheet generation, and payment processing. 
**Core Tech Stack:** HTML5, CSS3, Vanilla JavaScript, Tailwind CSS, Dexie.js (IndexedDB).

---

## 2. User Roles & Permissions (Access Control)
1. **HoD (Head of Department):** Master overseer. Approves marks, edits EIS (External Information System), approves payments, tracks all statuses, receives complaints. Becomes a "Viewer" only after Final Exam Board approval.
2. **AR (Assistant Registrar):** Handles physical paper bundles, manages courier details, finalizes payments, verifies physical handovers via OTP.
3. **1st Examiner (Lecturer in Charge):** Marks papers first, creates Detail Marks Sheet, creates Final Marks Sheet, selects 2nd Examiner. Becomes "Viewer" after HoD approves EIS.
4. **2nd Examiner (Internal/External):** Verifies marks, creates 2nd Examiner Report. Restricted to maximum 4 subjects. Becomes "Viewer" after HoD approves EIS.

---

## 3. Business Requirements (Workflow Scenarios)

### Phase 1: Semester Initialization & 2nd Examiner Selection
*   **Subject Assignment:** Department assigns subjects and 1st Examiners (Lecturers) at the start of the semester.
*   **2nd Examiner Selection:** 1st Examiner selects the 2nd Examiner.
    *   *Rule 1:* If Internal, the 2nd Examiner MUST be senior to the 1st Examiner.
    *   *Rule 2:* A person can be a 2nd Examiner for a **Maximum of 4 subjects only**.
    *   *Data Collection:* System captures: Name with initials, Designation/Resignation, University, Department, Address, Email, Contact Number via a document/form.

### Phase 2: Exam Period (Months 0 - 2) & Bundle Collection
*   **System Alert:** Exactly when a subject's exam ends, the system automatically alerts the Lecturer & HoD: *"Your Exam end. Please be ready to collect your paper bundle from AR."* (System logs date & time).
*   **AR Receives Papers:** AR logs into the system and updates that the paper bundle is received. (Alerts Lecturer & HoD).
*   **Lecturer Collects Papers:** Lecturer must collect papers from AR before the end date of the 2-month examination period.
    *   *Security:* Requires **OTP** from the Lecturer.
    *   *Update:* AR updates the system. (Alerts Lecturer & HoD).
    *   *Exception (Complain):* If Lecturer fails to collect before the exam period ends, system automatically generates a **Complain to the HoD**.

### Phase 3: 1st Marking Phase (3 Months Limit)
*   **Time Limit:** Lecturer has exactly 3 months from the exam end date to mark papers.
*   **Submission:** Lecturer uploads `Detail Marks Sheet.pdf` (end exam marks only) to the system and physically hands the bundle to the AR.
    *   *Security:* Requires **OTP** from Lecturer. AR updates the system.
    *   *Alerts:* 2nd Examiner, Lecturer, and HoD.
    *   *Exception (Complain):* If not submitted within 3 months, system automatically generates a **Complain to the HoD**.

### Phase 4: 2nd Examiner Handoff & Marking (1 Month Limit)
*   **Handing over to 2nd Examiner:**
    *   *If Internal:* 2nd Examiner visits AR, provides **OTP**, collects bundle. AR updates system. (Alerts Lecturer, HoD).
    *   *If External:* AR couriers the bundle. AR uploads courier receipt + Tracking Number. (Alerts 2nd Examiner, Lecturer, HoD).
*   **Receipt & Marking:**
    *   2nd Examiner updates system upon receiving the bundle. (Alerts Lecturer, HoD).
    *   2nd Examiner downloads the `Detail Marks Sheet.pdf`.
    *   Has exactly **1 month** to check papers and create the `2nd Examiner's Report`.
*   **Returning the Bundle:**
    *   *If External:* 2nd Examiner couriers bundle back, uploads 2nd Examiner's Report, Courier Receipt, and Tracking Number. (Alerts Lecturer, AR, HoD). AR updates system upon physical receipt (Alerts 2nd Examiner, Lecturer, HoD).
    *   *If Internal:* Hands bundle directly to AR with **OTP**. AR updates system. (Alerts HoD, Lecturer).
    *   *Exception (Complain):* If not completed within 1 month, system generates a **Complain to the HoD**.

### Phase 5: Final Marks Processing
*   **Collection:** Lecturer collects bundle + 2nd Examiner Report from AR. AR updates system. (Alerts Lecturer, HoD).
*   **Correction:** Lecturer downloads 2nd Examiner Report, corrects the Detail Mark Sheet, adds Continuous Assessment marks, and creates the `Final Mark Sheet`.
*   **Upload:** Lecturer uploads Final Mark Sheet to system and enters marks into EIS. (Alerts HoD).

### Phase 6: HoD Verification & EIS Integration
*   HoD downloads Final Mark Sheet and cross-checks with EIS.
*   **Scenario A: Perfect Match (Accept)**
    *   HoD accepts via system. (Alerts Lecturer, Notifies EIS).
*   **Scenario B: Minor Error**
    *   HoD corrects EIS marks directly, inputs details of corrected marks into the system, and approves. (Alerts Lecturer with correction details).
*   **Scenario C: Drastic Mistakes (Reject)**
    *   HoD rejects. (Alerts Lecturer). Lecturer must repeat Phase 5 (re-check, correct EIS, re-upload Final results).
*   **Post-Approval Lock:** Once HoD approves, Lecturers and 2nd Examiners become **Viewers** (Cannot upload/edit).
*   **Post-Approval Corrections:** If Lecturer needs a change later, they submit a data request via system (Alerts HoD). HoD checks, edits EIS, re-corrects Final Mark Sheet, and re-uploads. (Alerts Lecturer).

### Phase 7: Payment Processing
*   Lecturers and 2nd Examiners upload Payment Claim Sheets. (Alerts HoD).
*   HoD reviews claims against system timelines and Complaints (late submissions).
    *   HoD Accepts or Rejects. (Alerts AR, Lecturers, 2nd Examiner).
*   If Accepted, AR downloads claim sheets, processes physical payment, and updates system. (Alerts HoD, 2nd Examiner, Lecturer).

### Phase 8: Final Closure
*   HoD approves the final status to the Exam Board.
*   **System Lock:** HoD becomes a **Viewer**. No further changes or uploads are permitted by any role.

---

## 4. Technical Requirements

### 4.1 Frontend Architecture (UI/UX)
*   **Frameworks:** HTML5, CSS3, Vanilla JavaScript, Tailwind CSS (via CDN or Node setup).
*   **Views needed:**
    *   Login/Auth Page.
    *   Role-based Dashboards (HoD Dashboard, AR Dashboard, Lecturer Dashboard, 2nd Ex Dashboard).
    *   Paper Bundle Tracking Timeline (Visual tracker like courier tracking).
    *   Notifications/Alerts Drawer.
    *   Forms (Subject Assignment, 2nd Ex Registration, OTP verification modals, File Uploads).

### 4.2 Database (Dexie.js / IndexedDB Structure)
Since this is entirely client-side using Dexie.js, database schemas must be strict:
*   `Users`: id, name, role (hod, ar, lec, 2nd_ex), email, phone, seniority_level.
*   `Subjects`: id, name, code, semester, lec_id, 2nd_ex_id, exam_end_date.
*   `Trackings`: id, subject_id, current_stage, status (pending, completed, delayed), updated_by, timestamp.
*   `Files`: id, subject_id, file_type (detail_marks, 2nd_ex_report, final_marks, claim_sheet, courier_receipt), file_data (Base64/Blob), uploaded_by.
*   `Notifications`: id, user_id, message, is_read, timestamp.
*   `Complaints`: id, subject_id, user_id (who defaulted), reason (late pickup/marking), timestamp.

### 4.3 High Security Implementation
As requested, security is paramount even in a Dexie.js environment:
1.  **Authentication Simulation:** Passwords must be hashed using a JS Crypto library (e.g., CryptoJS) before saving to Dexie. Session tokens saved in `sessionStorage` (cleared on tab close) to prevent unauthorized access.
2.  **Role-Based Access Control (RBAC):** UI elements (Upload buttons, Approve buttons) must be conditionally rendered based on the logged-in user's role.
3.  **State Machine Locking:**
    *   Use status flags (`is_eis_approved = true`, `is_board_approved = true`).
    *   If `is_eis_approved` is true, the JS logic MUST block any `put`/`update` queries from Lecturers to the database.
4.  **OTP Verification:**
    *   Since there's no SMS backend, generate a 6-digit random code, save it to Dexie temporarily, and display it on the Lecturer/2nd Examiner's screen. The AR must type *that exact code* into their screen to validate the physical handover.
5.  **Data Integrity:** 
    *   Validate files before Base64 conversion (Accept only `.pdf` for marks, `.jpg/.png/.pdf` for receipts). Max file size limits (e.g., 5MB).
    *   Prevent DOM manipulation bypassing: Always verify the user's role from the active session token/Dexie user object before executing a database write, not just by un-hiding a button.

### 4.4 Automated Triggers & Date Checking (Cron Alternative)
Since JavaScript in the browser doesn't run backend Cron jobs, simulate it:
*   Create a global `checkDeadlines()` function that runs every time *any* user logs in or every hour while the app is open.
*   It compares `exam_end_date` against `Date.now()`.
*   If `Date.now() > exam_end_date + 3 months` and `Tracking.stage !== 'submitted_to_ar'`, it automatically writes a record to the `Complaints` table and pushes a `Notification` to the HoD.