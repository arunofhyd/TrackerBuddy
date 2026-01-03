const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { beforeUserCreated } = require("firebase-functions/v2/identity");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// Helper function to get super admins from Firestore config
async function getSuperAdmins() {
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

// Helper function to delete all documents in a collection or subcollection
async function deleteCollection(collectionPath, batchSize = 500) {
    const collectionRef = db.collection(collectionPath);
    const query = collectionRef.orderBy('__name__').limit(batchSize);

    while (true) {
        const snapshot = await query.get();
        if (snapshot.size === 0) {
            return;
        }

        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
    }
}

// Helper function to calculate and save member summary
async function calculateAndSaveMemberSummary(userId, teamId, userData, memberInfo) {
    if (!userData || !teamId || !memberInfo) {
        console.log(`Missing data for summary calculation for user ${userId}`);
        return;
    }

    let yearlyData = userData.yearlyData ? JSON.parse(JSON.stringify(userData.yearlyData)) : {};

    if (userData.activities && Object.keys(userData.activities).length > 0) {
        const currentYear = new Date().getFullYear().toString();
        if (!yearlyData.hasOwnProperty(currentYear)) {
            yearlyData[currentYear] = {
                activities: userData.activities ? JSON.parse(JSON.stringify(userData.activities)) : {},
                leaveOverrides: {}
            };
        }
    }

    const summaryRef = db.collection("teams").doc(teamId).collection("member_summaries").doc(userId);
    const leaveTypes = userData.leaveTypes || [];
    const LEAVE_DAY_TYPES = { FULL: "full", HALF: "half" };

    const yearlyLeaveBalances = {};
    const systemYear = new Date().getFullYear().toString();

    const relevantYears = new Set(Object.keys(yearlyData));
    if (leaveTypes.length > 0 && !relevantYears.has(systemYear)) {
        relevantYears.add(systemYear);
    }

    for (const year of relevantYears) {
        const yearData = yearlyData[year] || {};
        const activities = yearData.activities || {};
        const overrides = yearData.leaveOverrides || {};

        const leaveCounts = {};
        leaveTypes.forEach(lt => {
            leaveCounts[lt.id] = 0;
        });

        Object.values(activities).forEach(dayData => {
            if (dayData && dayData.leave && typeof dayData.leave === 'object' && dayData.leave.typeId) {
                const leaveInfo = dayData.leave;
                const leaveValue = leaveInfo.dayType === LEAVE_DAY_TYPES.HALF ? 0.5 : 1;
                if (leaveCounts.hasOwnProperty(leaveInfo.typeId)) {
                    leaveCounts[leaveInfo.typeId] += leaveValue;
                }
            }
        });

        const leaveBalancesForYear = {};
        leaveTypes.forEach(lt => {
            if (overrides[lt.id]?.hidden) return;
            const totalDays = overrides[lt.id]?.totalDays ?? lt.totalDays;
            const used = leaveCounts[lt.id] || 0;

            if (totalDays > 0 || overrides[lt.id]) {
                leaveBalancesForYear[lt.id] = {
                    name: lt.name,
                    color: lt.color,
                    total: totalDays,
                    used: parseFloat(used.toFixed(2)),
                    balance: parseFloat((totalDays - used).toFixed(2)),
                };
            }
        });

        if (Object.keys(leaveBalancesForYear).length > 0) {
            yearlyLeaveBalances[year] = leaveBalancesForYear;
        }
    }

    const summaryData = {
        userId: userId,
        displayName: memberInfo.displayName,
        role: memberInfo.role,
        yearlyLeaveBalances: yearlyLeaveBalances,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    };

    try {
        await summaryRef.set(summaryData, { merge: true });
    } catch (error) {
        console.error("Error setting summary for user:", error);
        throw error;
    }
}

async function deleteMemberSummary(userId, teamId) {
    if (!userId || !teamId) return;
    const summaryRef = db.collection("teams").doc(teamId).collection("member_summaries").doc(userId);
    try {
        await summaryRef.delete();
    } catch (error) {
        console.error("Error deleting summary:", error);
    }
}

exports.createTeam = onCall({ region: "asia-south1", maxInstances: 10 }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in to create a team.");
  }

  const { teamName, displayName } = request.data;
  const userId = request.auth.uid;
  const userEmail = request.auth.token.email;

  if (!teamName || !displayName) {
    throw new HttpsError("invalid-argument", "Please provide a valid team name and display name.");
  }

  const generateRoomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const roomCode = generateRoomCode();
  const teamRef = db.collection("teams").doc(roomCode);
  const userRef = db.collection("users").doc(userId);

  try {
    const userDoc = await userRef.get();
    const userData = userDoc.exists ? userDoc.data() : {};

    let userRole = userData.role || 'standard';
    const superAdmins = await getSuperAdmins();
    const isSuperAdmin = superAdmins.includes(userEmail);

    if (userRole === 'pro' && userData.proExpiry) {
        const expiryDate = userData.proExpiry.toDate();
        if (expiryDate < new Date()) {
            userRole = 'standard';
        }
    }

    const isPro = userRole === 'pro' || userRole === 'co-admin' || (userRole === 'standard' && userData.isPro === true);

    if (!isPro && !isSuperAdmin) {
        throw new HttpsError("permission-denied", "This feature is locked for Pro users.");
    }

    await db.runTransaction(async (transaction) => {
      const tUserDoc = await transaction.get(userRef);
      if (tUserDoc.exists && tUserDoc.data().teamId) {
        throw new HttpsError("already-exists", "You are already in a team.");
      }

      const memberInfo = {
        userId: userId,
        displayName: displayName,
        role: "admin",
        joinedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      transaction.set(teamRef, {
        name: teamName,
        roomCode: roomCode,
        adminId: userId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        members: {
          [userId]: memberInfo,
        },
      });

      transaction.set(userRef, {
        teamId: roomCode,
        teamRole: "admin",
      }, { merge: true });
    });

    const memberInfo = {
        userId: userId,
        displayName: displayName,
        role: "admin"
    };
    await calculateAndSaveMemberSummary(userId, roomCode, userData, memberInfo);

    return { status: "success", message: "Successfully created the team!", roomCode: roomCode };
  } catch (error) {
    console.error("Error creating team:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "An unexpected error occurred. Please try again.");
  }
});

exports.joinTeam = onCall({ region: "asia-south1", maxInstances: 10 }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in to join a team.");
  }

  const { roomCode, displayName } = request.data;
  const userId = request.auth.uid;
  const userEmail = request.auth.token.email;

  if (!roomCode || roomCode.length !== 8 || !displayName) {
    throw new HttpsError("invalid-argument", "Please provide a valid room code and display name.");
  }

  const teamRef = db.collection("teams").doc(roomCode);
  const userRef = db.collection("users").doc(userId);

  try {
    const userDoc = await userRef.get();
    const userData = userDoc.exists ? userDoc.data() : {};

    let userRole = userData.role || 'standard';
    const superAdmins = await getSuperAdmins();
    const isSuperAdmin = superAdmins.includes(userEmail);

    if (userRole === 'pro' && userData.proExpiry) {
        const expiryDate = userData.proExpiry.toDate();
        if (expiryDate < new Date()) {
            userRole = 'standard';
        }
    }

    const isPro = userRole === 'pro' || userRole === 'co-admin' || (userRole === 'standard' && userData.isPro === true);

    if (!isPro && !isSuperAdmin) {
        throw new HttpsError("permission-denied", "This feature is locked for Pro users.");
    }

    await db.runTransaction(async (transaction) => {
      const tUserDoc = await transaction.get(userRef);
      if (tUserDoc.exists && tUserDoc.data().teamId) {
         throw new HttpsError("already-exists", "You are already in a team.");
      }

      const teamDoc = await transaction.get(teamRef);
      if (!teamDoc.exists) {
        throw new HttpsError("not-found", "Team not found.");
      }

      const teamData = teamDoc.data();
      const currentMembers = teamData.members || {};
      if (currentMembers[userId]) {
        throw new HttpsError("already-exists", "You are already a member of this team.");
      }

      const memberInfo = {
          userId: userId,
          displayName: displayName,
          role: "member",
          joinedAt: new Date(),
      };

      transaction.update(teamRef, {
        [`members.${userId}`]: memberInfo,
      });

      transaction.set(userRef, {
        teamId: roomCode,
        teamRole: "member",
      }, { merge: true });
    });

    const memberInfo = {
        userId: userId,
        displayName: displayName,
        role: "member"
    };
    await calculateAndSaveMemberSummary(userId, roomCode, userData, memberInfo);

    return { status: "success", message: "Successfully joined the team!" };
  } catch (error) {
    console.error("Error joining team:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "An unexpected error occurred. Please try again.");
  }
});

exports.editDisplayName = onCall({ region: "asia-south1", maxInstances: 10 }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const { newDisplayName, teamId } = request.data;
  const userId = request.auth.uid;

  if (!newDisplayName || !teamId) {
    throw new HttpsError("invalid-argument", "Missing required data.");
  }

  const teamRef = db.collection("teams").doc(teamId);
  const teamDoc = await teamRef.get();

  if (!teamDoc.exists) {
    throw new HttpsError("not-found", "Team not found.");
  }

  const members = teamDoc.data().members || {};
  if (!members[userId]) {
    throw new HttpsError("permission-denied", "You are not a member of this team.");
  }

  await teamRef.update({
    [`members.${userId}.displayName`]: newDisplayName
  });

  return { status: "success", message: "Display name updated!" };
});

exports.editTeamName = onCall({ region: "asia-south1", maxInstances: 10 }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in.");
    }

    const { newTeamName, teamId } = request.data;
    const userId = request.auth.uid;

    if (!newTeamName || !teamId) {
        throw new HttpsError("invalid-argument", "Missing required data.");
    }

    const teamRef = db.collection("teams").doc(teamId);
    const teamDoc = await teamRef.get();

    if (!teamDoc.exists) {
        throw new HttpsError("not-found", "Team not found.");
    }

    if (teamDoc.data().adminId !== userId) {
        throw new HttpsError("permission-denied", "Only the team admin can change the team name.");
    }

    await teamRef.update({
        name: newTeamName
    });

    return { status: "success", message: "Team name updated!" };
});

exports.leaveTeam = onCall({ region: "asia-south1", maxInstances: 10 }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const { teamId } = request.data;
  const userId = request.auth.uid;

  if (!teamId) {
      throw new HttpsError("invalid-argument", "Team ID is required.");
  }

  const teamRef = db.collection("teams").doc(teamId);
  const userRef = db.collection("users").doc(userId);

  const teamDoc = await teamRef.get();
  if (!teamDoc.exists) {
      throw new HttpsError("not-found", "Team not found.");
  }

  if (teamDoc.data().adminId === userId) {
      throw new HttpsError("permission-denied", "Admin cannot leave the team, must delete it instead.");
  }

  const batch = db.batch();
  batch.update(teamRef, {
    [`members.${userId}`]: admin.firestore.FieldValue.delete()
  });
  batch.set(userRef, {
    teamId: null,
    teamRole: null
  }, { merge: true });

  await batch.commit();
  await deleteMemberSummary(userId, teamId);

  return { status: "success", message: "You have left the team." };
});

exports.deleteTeam = onCall({ region: "asia-south1", maxInstances: 10 }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in.");
    }

    const { teamId } = request.data;
    const userId = request.auth.uid;

    if (!teamId) {
        throw new HttpsError("invalid-argument", "Team ID is required.");
    }

    const teamRef = db.collection("teams").doc(teamId);
    const teamDoc = await teamRef.get();

    if (!teamDoc.exists) {
        throw new HttpsError("not-found", "Team not found.");
    }

    if (teamDoc.data().adminId !== userId) {
        throw new HttpsError("permission-denied", "Only the team admin can delete the team.");
    }

    const summaryCollectionPath = `teams/${teamId}/member_summaries`;
    await deleteCollection(summaryCollectionPath);

    const members = teamDoc.data().members || {};
    const finalBatch = db.batch();

    Object.keys(members).forEach(memberId => {
        const userRef = db.collection("users").doc(memberId);
        finalBatch.set(userRef, { teamId: null, teamRole: null }, { merge: true });
    });

    finalBatch.delete(teamRef);

    await finalBatch.commit();
    return { status: "success", message: "Team deleted successfully." };
});

exports.kickTeamMember = onCall({ region: "asia-south1", maxInstances: 10 }, async (request) => {
    const { teamId, memberId } = request.data;
    const callerId = request.auth?.uid;

    if (!callerId) {
        throw new HttpsError("unauthenticated", "You must be logged in to perform this action.");
    }
    if (!teamId || !memberId) {
        throw new HttpsError("invalid-argument", "Missing required parameters: teamId or memberId.");
    }

    const teamRef = db.collection("teams").doc(teamId);
    const memberRef = db.collection("users").doc(memberId);

    try {
        const teamDoc = await teamRef.get();
        if (!teamDoc.exists) {
            throw new HttpsError("not-found", "The specified team does not exist.");
        }

        const teamData = teamDoc.data();
        const adminId = teamData.adminId;

        if (callerId !== adminId) {
            throw new HttpsError("permission-denied", "Only the team admin can kick members.");
        }
        if (memberId === adminId) {
            throw new HttpsError("invalid-argument", "The team admin cannot kick themselves.");
        }

        const batch = db.batch();
        batch.update(teamRef, {
            [`members.${memberId}`]: admin.firestore.FieldValue.delete()
        });
        batch.set(memberRef, {
            teamId: null,
            teamRole: null
        }, { merge: true });

        await batch.commit();
        await deleteMemberSummary(memberId, teamId);

        return { success: true, message: "Team member successfully kicked." };

    } catch (error) {
        console.error(`Error kicking member ${memberId} from team ${teamId}:`, error);
        if (error instanceof HttpsError) {
            throw error;
        } else {
            throw new HttpsError("internal", "An unexpected error occurred while trying to kick the team member.");
        }
    }
});

exports.syncTeamMemberSummary = onCall({ region: "asia-south1", maxInstances: 10 }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in.");
    }

    const userId = request.auth.uid;
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
        throw new HttpsError("not-found", "User data not found.");
    }

    const userData = userDoc.data();
    const teamId = userData.teamId;

    if (!teamId) {
        return { status: "no-team", message: "User is not in a team." };
    }

    const teamDoc = await db.collection("teams").doc(teamId).get();
    if (!teamDoc.exists) {
        return { status: "team-missing", message: "Team not found." };
    }

    const memberInfo = teamDoc.data()?.members?.[userId];
    if (!memberInfo) {
        return { status: "not-member", message: "User not in team members list." };
    }

    await calculateAndSaveMemberSummary(userId, teamId, userData, memberInfo);
    return { status: "success", message: "Summary synced." };
});

exports.updateMemberSummaryOnTeamChange = onDocumentWritten({ document: "teams/{teamId}", region: "asia-south1", maxInstances: 10 }, async (event) => {
    const teamId = event.params.teamId;
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();

    if (!afterData) {
        console.log(`Team ${teamId} deleted.`);
        return;
    }

    const beforeMembers = beforeData?.members || {};
    const afterMembers = afterData.members || {};

    const updatedMembers = [];
    for (const memberId in afterMembers) {
        const beforeMember = beforeMembers[memberId];
        const afterMember = afterMembers[memberId];
        if (!beforeMember || beforeMember.displayName !== afterMember.displayName || beforeMember.role !== afterMember.role) {
            updatedMembers.push(memberId);
        }
    }

    if (updatedMembers.length === 0) {
        return;
    }

    const summaryCollection = db.collection("teams").doc(teamId).collection("member_summaries");
    const promises = updatedMembers.map(async (memberId) => {
        const memberData = afterMembers[memberId];
        const summaryRef = summaryCollection.doc(memberId);
        try {
            await summaryRef.set({
                displayName: memberData.displayName,
                role: memberData.role,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            console.log(`Updated summary for member ${memberId} in team ${teamId} due to team doc change.`);
        } catch (error) {
            console.error(`Error updating summary for member ${memberId}:`, error);
        }
    });

    await Promise.all(promises);
});

// --- ADMIN FUNCTIONS ---

exports.getAllUsers = onCall({ region: "asia-south1", maxInstances: 10 }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in.");
    }

    const callerEmail = request.auth.token.email;
    const callerUid = request.auth.uid;
    const superAdmins = await getSuperAdmins();
    let isAuthorized = superAdmins.includes(callerEmail);

    if (!isAuthorized) {
        const callerDoc = await db.collection("users").doc(callerUid).get();
        if (callerDoc.exists && callerDoc.data().role === 'co-admin') {
            isAuthorized = true;
        }
    }

    if (!isAuthorized) {
        throw new HttpsError("permission-denied", "Not authorized.");
    }

    try {
        const listUsersResult = await admin.auth().listUsers(1000);
        const users = listUsersResult.users.map(u => ({
            uid: u.uid,
            email: u.email,
            displayName: u.displayName,
            photoURL: u.photoURL,
            creationTime: u.metadata.creationTime,
            lastSignInTime: u.metadata.lastSignInTime
        }));

        const usersSnapshot = await db.collection("users").get();
        const firestoreData = {};
        usersSnapshot.forEach(doc => {
            firestoreData[doc.id] = doc.data();
        });

        // 1. Fetch Whitelisted Users
        const whitelistSnapshot = await db.collection("pro_whitelist").get();
        const whitelistData = [];
        whitelistSnapshot.forEach(doc => {
            whitelistData.push(doc.data());
        });

        // 2. Map Existing Users
        const combined = users.map(u => {
            const data = firestoreData[u.uid] || {};
            return {
                ...u,
                role: data.role || 'standard',
                isPro: data.isPro || false,
                teamId: data.teamId,
                proSince: data.proSince ? data.proSince.toDate().toISOString() : null,
                proExpiry: data.proExpiry ? data.proExpiry.toDate().toISOString() : null,
                status: 'active'
            };
        });

        // 3. Merge Whitelisted (Pending) Users
        const existingEmails = new Set(combined.map(u => u.email));
        whitelistData.forEach(w => {
            if (!existingEmails.has(w.email)) {
                combined.push({
                    uid: `pending_${w.email}`, // Dummy UID for frontend keys
                    email: w.email,
                    displayName: 'Pending Signup',
                    role: w.role,
                    proSince: w.addedAt ? w.addedAt.toDate().toISOString() : null,
                    status: 'pending'
                });
            }
        });

        return { users: combined };

    } catch (error) {
        console.error("Error fetching users:", error);
        throw new HttpsError("internal", "Failed to fetch users.");
    }
});

exports.updateUserRole = onCall({ region: "asia-south1", maxInstances: 10 }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in.");
    }

    const callerEmail = request.auth.token.email;
    const callerUid = request.auth.uid;
    const superAdmins = await getSuperAdmins();
    const isSuperAdmin = superAdmins.includes(callerEmail);
    let isAuthorized = isSuperAdmin;

    if (!isAuthorized) {
        const callerDoc = await db.collection("users").doc(callerUid).get();
        if (callerDoc.exists && callerDoc.data().role === 'co-admin') {
            isAuthorized = true;
        }
    }

    if (!isAuthorized) {
        throw new HttpsError("permission-denied", "Not authorized.");
    }

    const { targetUserId, newRole, proExpiry } = request.data;

    if (!['standard', 'pro', 'co-admin'].includes(newRole)) {
        throw new HttpsError("invalid-argument", "Invalid role.");
    }

    if (!isSuperAdmin) {
        try {
            const targetUserRecord = await admin.auth().getUser(targetUserId);
            if (superAdmins.includes(targetUserRecord.email)) {
                throw new HttpsError("permission-denied", "Co-Admins cannot modify Super Admins.");
            }
        } catch (error) {
            if (error.code !== 'auth/user-not-found') {
                 throw new HttpsError("internal", "Error verifying target user permissions.");
            }
        }
    }

    try {
        const updateData = {
            role: newRole,
            isPro: (newRole === 'pro' || newRole === 'co-admin')
        };

        if (newRole === 'pro') {
            updateData.proSince = admin.firestore.FieldValue.serverTimestamp();
            updateData.proExpiry = proExpiry ? admin.firestore.Timestamp.fromDate(new Date(proExpiry)) : null;
        } else if (newRole === 'standard') {
            updateData.proSince = admin.firestore.FieldValue.delete();
            updateData.proExpiry = admin.firestore.FieldValue.delete();
        }

        await db.collection("users").doc(targetUserId).set(updateData, { merge: true });

        return { success: true };
    } catch (error) {
        console.error("Error updating user role:", error);
        throw new HttpsError("internal", "Failed to update role.");
    }
});

exports.grantProByEmail = onCall({ region: "asia-south1", maxInstances: 10 }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in.");
    }

    const callerEmail = request.auth.token.email;
    const callerUid = request.auth.uid;
    const superAdmins = await getSuperAdmins();
    let isAuthorized = superAdmins.includes(callerEmail);

    if (!isAuthorized) {
        const callerDoc = await db.collection("users").doc(callerUid).get();
        if (callerDoc.exists && callerDoc.data().role === 'co-admin') {
            isAuthorized = true;
        }
    }

    if (!isAuthorized) {
        throw new HttpsError("permission-denied", "Not authorized.");
    }

    const email = request.data.email;
    if (!email) {
        throw new HttpsError("invalid-argument", "Email is required.");
    }

    try {
        // Try to find the user in Auth
        let userRecord;
        try {
            userRecord = await admin.auth().getUserByEmail(email);
        } catch (e) {
            if (e.code !== 'auth/user-not-found') {
                throw e;
            }
        }

        if (userRecord) {
            // User exists, update their doc
            await db.collection("users").doc(userRecord.uid).set({
                role: 'pro',
                isPro: true,
                proSince: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            return { message: "Existing user upgraded to Pro." };
        } else {
            // User does not exist, add to whitelist
            await db.collection("pro_whitelist").doc(email).set({
                email: email,
                role: 'pro',
                addedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            return { message: "User not found. Added to Pro whitelist for when they sign up." };
        }

    } catch (error) {
        console.error("Error granting pro by email:", error);
        throw new HttpsError("internal", "Failed to grant pro access.");
    }
});

// Trigger: When a new user is created in Auth
exports.checkProWhitelistOnSignupV2 = beforeUserCreated({ region: "asia-south1", maxInstances: 10 }, async (event) => {
    const user = event.data;
    const email = user.email;
    if (!email) return;

    try {
        const whitelistDoc = await db.collection("pro_whitelist").doc(email).get();
        if (whitelistDoc.exists) {
            console.log(`New user ${email} found in Pro whitelist. Granting access.`);

            // Grant Pro Access
            await db.collection("users").doc(user.uid).set({
                role: 'pro',
                isPro: true,
                proSince: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            // Remove from whitelist
            await db.collection("pro_whitelist").doc(email).delete();
        }
    } catch (error) {
        console.error(`Error processing whitelist for new user ${email}:`, error);
    }
});

exports.revokeProWhitelist = onCall({ region: "asia-south1", maxInstances: 10 }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in.");
    }

    const callerEmail = request.auth.token.email;
    const callerUid = request.auth.uid;
    const superAdmins = await getSuperAdmins();
    let isAuthorized = superAdmins.includes(callerEmail);

    if (!isAuthorized) {
        const callerDoc = await db.collection("users").doc(callerUid).get();
        if (callerDoc.exists && callerDoc.data().role === 'co-admin') {
            isAuthorized = true;
        }
    }

    if (!isAuthorized) {
        throw new HttpsError("permission-denied", "Not authorized.");
    }

    const email = request.data.email;
    if (!email) {
        throw new HttpsError("invalid-argument", "Email is required.");
    }

    try {
        await db.collection("pro_whitelist").doc(email).delete();
        return { message: "User removed from Pro whitelist." };
    } catch (error) {
        console.error("Error revoking pro whitelist:", error);
        throw new HttpsError("internal", "Failed to revoke pro whitelist.");
    }
});
