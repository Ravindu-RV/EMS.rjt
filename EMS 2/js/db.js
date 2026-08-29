// Initialize Dexie
const db = new Dexie("EMS_Database");

// Define schema
db.version(1).stores({
    users: '++id, name, role, email, phone, seniority_level, passwordHash',
    subjects: '++id, name, code, semester, lec_id, second_ex_id, exam_end_date, is_eis_approved, is_board_approved',
    trackings: '++id, subject_id, current_stage, status, updated_by, timestamp',
    files: '++id, subject_id, file_type, uploaded_by, timestamp', // file_data stored as blob/base64
    notifications: '++id, user_id, message, is_read, timestamp',
    complaints: '++id, subject_id, user_id, reason, timestamp'
});

// Helper to hash passwords (using CryptoJS)
function hashPassword(password) {
    return CryptoJS.SHA256(password).toString();
}

// Populate dummy data if empty
async function populateDummyData() {
    const userCount = await db.users.count();
    if (userCount === 0) {
        console.log("Populating dummy users...");
        const defaultPassword = hashPassword("123456");
        
        await db.users.bulkAdd([
            { name: "Dr. Perera (HoD)", role: "hod", email: "hod@rjt.ac.lk", phone: "0711111111", seniority_level: 10, passwordHash: defaultPassword },
            { name: "Mr. Silva (AR)", role: "ar", email: "ar@rjt.ac.lk", phone: "0712222222", seniority_level: 5, passwordHash: defaultPassword },
            { name: "Dr. Bandara (Lecturer)", role: "lec", email: "lec1@rjt.ac.lk", phone: "0713333333", seniority_level: 3, passwordHash: defaultPassword },
            { name: "Prof. Kumara (Senior Lecturer)", role: "lec", email: "lec2@rjt.ac.lk", phone: "0714444444", seniority_level: 8, passwordHash: defaultPassword },
            { name: "Dr. Fernando (External 2nd Ex)", role: "2nd_ex", email: "ext1@otheruni.ac.lk", phone: "0715555555", seniority_level: 0, passwordHash: defaultPassword }
        ]);
        
        // Add a dummy subject
        const lec = await db.users.where('email').equals('lec1@rjt.ac.lk').first();
        await db.subjects.add({
            name: "Data Structures",
            code: "CS201",
            semester: 2,
            lec_id: lec.id,
            second_ex_id: null,
            exam_end_date: Date.now() + (1000 * 60 * 60 * 24 * 7), // 7 days from now
            is_eis_approved: false,
            is_board_approved: false
        });
    }
}

// Cron Alternative - Check Deadlines
async function checkDeadlines() {
    console.log("Checking deadlines...");
    const subjects = await db.subjects.toArray();
    const now = Date.now();
    const THREE_MONTHS = 1000 * 60 * 60 * 24 * 90; // Approx 90 days

    for (let sub of subjects) {
        if (now > sub.exam_end_date && sub.is_board_approved === false) {
            const trackings = await db.trackings.where('subject_id').equals(sub.id).toArray();
            
            // Check Phase 2: Lecturer collected papers
            const collectionStage = trackings.find(t => t.current_stage === 'collected_by_lec');
            if (!collectionStage && now > sub.exam_end_date + (1000 * 60 * 60 * 24 * 60)) { // 2 months to collect
                await generateComplaint(sub.id, sub.lec_id, "Lecturer failed to collect papers within 2 months.");
            }

            // Check Phase 3: Lecturer submitted marks
            const submissionStage = trackings.find(t => t.current_stage === 'submitted_marks_by_lec');
            if (collectionStage && !submissionStage && now > sub.exam_end_date + THREE_MONTHS) {
                await generateComplaint(sub.id, sub.lec_id, "Lecturer failed to submit marks within 3 months.");
            }
        }
    }
}

async function generateComplaint(subject_id, user_id, reason) {
    // Check if complaint already exists to prevent spam
    const existing = await db.complaints.where({subject_id: subject_id, user_id: user_id, reason: reason}).first();
    if(!existing) {
        await db.complaints.add({
            subject_id, user_id, reason, timestamp: Date.now()
        });
        // Notify HoD
        const hod = await db.users.where('role').equals('hod').first();
        if (hod) {
            await db.notifications.add({
                user_id: hod.id,
                message: `New Complaint: ${reason}`,
                is_read: false,
                timestamp: Date.now()
            });
        }
    }
}

// Initialize on load
document.addEventListener("DOMContentLoaded", async () => {
    await populateDummyData();
});
