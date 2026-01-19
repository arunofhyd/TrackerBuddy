const admin = require('firebase-admin');
const { Firestore } = require('@google-cloud/firestore');

// Configuration
const PROJECT_ID = 'trackerbuddyaoh';
const RECOVERY_DB_ID = 'recovered-db';
const DEST_DB_ID = '(default)'; // The live database
const TARGET_USER_ID = 'DFwvxqy4LBfCWlY76j3HWRgxMxN2';

// 1. Initialize access to the LIVE database (Destination)
// We use firebase-admin for the default app which connects to '(default)' by default
admin.initializeApp({
    projectId: PROJECT_ID
});
const destDb = admin.firestore();

// 2. Initialize access to the RECOVERED database (Source)
// We use the direct Firestore client to specify the databaseId
const sourceDb = new Firestore({
    projectId: PROJECT_ID,
    databaseId: RECOVERY_DB_ID
});

async function restoreUser() {
    console.log('=============================================');
    console.log(`Starting recovery for User ID: ${TARGET_USER_ID}`);
    console.log(`Source DB: ${RECOVERY_DB_ID}`);
    console.log(`Target DB: ${DEST_DB_ID}`);
    console.log('=============================================\n');

    try {
        // --- Step A: Read from Source ---
        const sourceUserRef = sourceDb.collection('users').doc(TARGET_USER_ID);
        const sourceUserDoc = await sourceUserRef.get();

        if (!sourceUserDoc.exists) {
            console.error(`[ERROR] User document ${TARGET_USER_ID} NOT FOUND in ${RECOVERY_DB_ID}.`);
            console.error('Please ensure the database restore (Step 1 in RECOVERY.md) completed successfully.');
            process.exit(1);
        }

        const userData = sourceUserDoc.data();
        console.log(`[SUCCESS] Found user data. Role: ${userData.role || 'N/A'}, Name: ${userData.displayName || 'N/A'}`);

        // --- Step B: Write to Destination ---
        const destUserRef = destDb.collection('users').doc(TARGET_USER_ID);

        // Optional: Check if we are overwriting
        const destUserDoc = await destUserRef.get();
        if (destUserDoc.exists) {
            console.warn(`[WARNING] User already exists in LIVE database. Overwriting...`);
        } else {
            console.log(`[INFO] Creating user in LIVE database...`);
        }

        await destUserRef.set(userData);
        console.log(`\n[COMPLETE] Successfully restored user ${TARGET_USER_ID} to live database.`);

        // --- Step C: Check for Team Summary (Optional but helpful) ---
        // If the user has a team, their summary in the team collection might also be missing.
        // This part is best effort based on the schema seen in functions/index.js
        if (userData.teamId) {
            console.log(`\n[INFO] User is part of Team ${userData.teamId}. Checking member summary...`);
            const sourceSummaryRef = sourceDb.collection('teams').doc(userData.teamId).collection('member_summaries').doc(TARGET_USER_ID);
            const sourceSummaryDoc = await sourceSummaryRef.get();

            if (sourceSummaryDoc.exists) {
                const summaryData = sourceSummaryDoc.data();
                const destSummaryRef = destDb.collection('teams').doc(userData.teamId).collection('member_summaries').doc(TARGET_USER_ID);
                await destSummaryRef.set(summaryData);
                console.log(`[SUCCESS] Restored member summary for Team ${userData.teamId}.`);
            } else {
                console.log(`[INFO] No member summary found in backup (or team structure changed). Skipping.`);
            }
        }

    } catch (error) {
        console.error('\n[FATAL ERROR] Restoration failed:', error);
        process.exit(1);
    }
}

restoreUser();
