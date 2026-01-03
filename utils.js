const admin = require("firebase-admin");
const { HttpsError } = require("firebase-functions/v2/https");

// Helper function to get super admins from Firestore config
async function getSuperAdmins(db) {
  try {
    const doc = await db.collection("config").doc("app_config").get();
    if (doc.exists && doc.data().superAdmins) {
      return doc.data().superAdmins;
    }
    return [];
  } catch (error) {
    console.error("Error fetching super admins:", error);
    return [];
  }
}

/**
 * Asserts that the caller is authorized (Super Admin or Co-Admin).
 * @param {Object} context - The callable request context (contains auth).
 * @param {Object} db - The Firestore database instance.
 * @returns {Promise<boolean>} - Returns true if authorized (is Super Admin).
 * @throws {HttpsError} - Throws permission-denied if not authorized.
 */
async function assertAuthorized(context, db) {
    if (!context.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in.");
    }

    const callerEmail = context.auth.token.email;
    const callerUid = context.auth.uid;
    const superAdmins = await getSuperAdmins(db);
    const isSuperAdmin = superAdmins.includes(callerEmail);

    if (isSuperAdmin) {
        return true; // Is Super Admin
    }

    // Check if Co-Admin
    const callerDoc = await db.collection("users").doc(callerUid).get();
    if (callerDoc.exists && callerDoc.data().role === 'co-admin') {
        return false; // Is Co-Admin (not Super Admin)
    }

    throw new HttpsError("permission-denied", "Not authorized.");
}

module.exports = {
    getSuperAdmins,
    assertAuthorized
};
