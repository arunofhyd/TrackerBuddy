const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
// Use functions v1 for auth trigger as v2 auth triggers (blocking) require Identity Platform and specific configuration, causing deployment issues in some environments.
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const {
    REGION,
    COLLECTIONS,
    LEAVE_DAY_TYPES,
    TEAM_ROLES,
    USER_ROLES
} = require("./constants");
const { Logger } = require("./logger");

admin.initializeApp();
const db = admin.firestore();

// Simple in-memory cache for super admins
let superAdminsCache = null;
const CACHE_DURATION = 60 * 1000; // 1 minute

// Helper function to get super admins from Firestore config
async function getSuperAdmins() {
  const now = Date.now();
  if (superAdminsCache && (now - superAdminsCache.timestamp < CACHE_DURATION)) {
    return superAdminsCache.data;
  }

  try {
    const doc = await db.collection(COLLECTIONS.CONFIG).doc(COLLECTIONS.APP_CONFIG).get();
    if (doc.exists && doc.data().superAdmins) {
      const admins = doc.data().superAdmins;
      superAdminsCache = { data: admins, timestamp: now };
      return admins;
    }
    return [];
  } catch (error) {
    Logger.error("Error fetching super admins:", error);
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
        Logger.info(`Missing data for summary calculation for user ${userId}`);
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

    const summaryRef = db.collection(COLLECTIONS.TEAMS).doc(teamId).collection(COLLECTIONS.MEMBER_SUMMARIES).doc(userId);
    const leaveTypes = userData.leaveTypes || [];

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
            // Respect limitYear: If defined, this leave type only exists in that year.
            if (lt.limitYear && String(lt.limitYear) !== year) return;

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
        // Use set without merge to ensure deleted leave types are removed from the summary
        await summaryRef.set(summaryData);
    } catch (error) {
        Logger.error("Error setting summary for user:", error);
        throw error;
    }
}

async function deleteMemberSummary(userId, teamId) {
    if (!userId || !teamId) return;
    const summaryRef = db.collection(COLLECTIONS.TEAMS).doc(teamId).collection(COLLECTIONS.MEMBER_SUMMARIES).doc(userId);
    try {
        await summaryRef.delete();
    } catch (error) {
        Logger.error("Error deleting summary:", error);
    }
}

function assertAuthenticated(request) {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in.");
    }
    return request.auth;
}

async function assertProAccess(userId, userEmail) {
    const userRef = db.collection(COLLECTIONS.USERS).doc(userId);
    const userDoc = await userRef.get();
    let userData = userDoc.exists ? userDoc.data() : {};

    let userRole = userData.role || USER_ROLES.STANDARD;
    const superAdmins = await getSuperAdmins();
    const isSuperAdmin = superAdmins.includes(userEmail);

    if (userRole === USER_ROLES.PRO && userData.proExpiry) {
        const expiryDate = userData.proExpiry.toDate();
        if (expiryDate < new Date()) {
            userRole = USER_ROLES.STANDARD;
        }
    }

    let isPro = userRole === USER_ROLES.PRO || userRole === USER_ROLES.CO_ADMIN || (userRole === USER_ROLES.STANDARD && userData.isPro === true);

    if (!isPro && !isSuperAdmin) {
        // Check whitelist before denying
        try {
            const whitelistDoc = await db.collection(COLLECTIONS.PRO_WHITELIST).doc(userEmail).get();
            if (whitelistDoc.exists) {
                Logger.info(`User ${userEmail} found in Pro whitelist during access check. Granting access.`);

                const updateData = {
                    role: USER_ROLES.PRO,
                    isPro: true,
                    proSince: admin.firestore.FieldValue.serverTimestamp()
                };

                await userRef.set(updateData, { merge: true });
                await db.collection(COLLECTIONS.PRO_WHITELIST).doc(userEmail).delete();

                // Update local state
                userData = { ...userData, ...updateData };
                isPro = true;
            }
        } catch (error) {
            Logger.error("Error checking whitelist in assertProAccess:", error);
        }
    }

    if (!isPro && !isSuperAdmin) {
        throw new HttpsError("permission-denied", "This feature is locked for Pro users.");
    }

    return { userRef, userData };
}

exports.createTeam = onCall({ region: REGION, maxInstances: 10 }, async (request) => {
  const { uid: userId, token: { email: userEmail } } = assertAuthenticated(request);
  const { teamName, displayName } = request.data;

  if (!teamName || !displayName) {
    throw new HttpsError("invalid-argument", "Please provide a valid team name and display name.");
  }

  const { userRef, userData } = await assertProAccess(userId, userEmail);

  const generateRoomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const roomCode = generateRoomCode();
  const teamRef = db.collection(COLLECTIONS.TEAMS).doc(roomCode);

  try {
    await db.runTransaction(async (transaction) => {
      const tUserDoc = await transaction.get(userRef);
      if (tUserDoc.exists && tUserDoc.data().teamId) {
        throw new HttpsError("already-exists", "You are already in a team.");
      }

      // Check for room code collision
      const tTeamDoc = await transaction.get(teamRef);
      if (tTeamDoc.exists) {
        throw new HttpsError("aborted", "Failed to generate a unique team code. Please try again.");
      }

      const memberInfo = {
        userId: userId,
        displayName: displayName,
        role: TEAM_ROLES.ADMIN,
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
        teamRole: TEAM_ROLES.ADMIN,
      }, { merge: true });
    });

    const memberInfo = {
        userId: userId,
        displayName: displayName,
        role: TEAM_ROLES.ADMIN
    };
    await calculateAndSaveMemberSummary(userId, roomCode, userData, memberInfo);

    return { status: "success", message: "Successfully created the team!", roomCode: roomCode };
  } catch (error) {
    Logger.error("Error creating team:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "An unexpected error occurred. Please try again.");
  }
});

exports.joinTeam = onCall({ region: REGION, maxInstances: 10 }, async (request) => {
  const { uid: userId, token: { email: userEmail } } = assertAuthenticated(request);
  const { roomCode, displayName } = request.data;

  if (!roomCode || roomCode.length !== 8 || !displayName) {
    throw new HttpsError("invalid-argument", "Please provide a valid room code and display name.");
  }

  const { userRef, userData } = await assertProAccess(userId, userEmail);
  const teamRef = db.collection(COLLECTIONS.TEAMS).doc(roomCode);

  try {
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
          role: TEAM_ROLES.MEMBER,
          joinedAt: new Date(),
      };

      transaction.update(teamRef, {
        [`members.${userId}`]: memberInfo,
      });

      transaction.set(userRef, {
        teamId: roomCode,
        teamRole: TEAM_ROLES.MEMBER,
      }, { merge: true });
    });

    const memberInfo = {
        userId: userId,
        displayName: displayName,
        role: TEAM_ROLES.MEMBER
    };
    await calculateAndSaveMemberSummary(userId, roomCode, userData, memberInfo);

    return { status: "success", message: "Successfully joined the team!" };
  } catch (error) {
    Logger.error("Error joining team:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "An unexpected error occurred. Please try again.");
  }
});

exports.editDisplayName = onCall({ region: REGION, maxInstances: 10 }, async (request) => {
  const { uid: userId } = assertAuthenticated(request);
  const { newDisplayName, teamId } = request.data;

  if (!newDisplayName || !teamId) {
    throw new HttpsError("invalid-argument", "Missing required data.");
  }

  const teamRef = db.collection(COLLECTIONS.TEAMS).doc(teamId);
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

exports.editTeamName = onCall({ region: REGION, maxInstances: 10 }, async (request) => {
    const { uid: userId } = assertAuthenticated(request);
    const { newTeamName, teamId } = request.data;

    if (!newTeamName || !teamId) {
        throw new HttpsError("invalid-argument", "Missing required data.");
    }

    const teamRef = db.collection(COLLECTIONS.TEAMS).doc(teamId);
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

exports.leaveTeam = onCall({ region: REGION, maxInstances: 10 }, async (request) => {
  const { uid: userId } = assertAuthenticated(request);
  const { teamId } = request.data;

  if (!teamId) {
      throw new HttpsError("invalid-argument", "Team ID is required.");
  }

  const teamRef = db.collection(COLLECTIONS.TEAMS).doc(teamId);
  const userRef = db.collection(COLLECTIONS.USERS).doc(userId);

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

exports.deleteTeam = onCall({ region: REGION, maxInstances: 10 }, async (request) => {
    const { uid: userId } = assertAuthenticated(request);
    const { teamId } = request.data;

    if (!teamId) {
        throw new HttpsError("invalid-argument", "Team ID is required.");
    }

    const teamRef = db.collection(COLLECTIONS.TEAMS).doc(teamId);
    const teamDoc = await teamRef.get();

    if (!teamDoc.exists) {
        throw new HttpsError("not-found", "Team not found.");
    }

    if (teamDoc.data().adminId !== userId) {
        throw new HttpsError("permission-denied", "Only the team admin can delete the team.");
    }

    const summaryCollectionPath = `${COLLECTIONS.TEAMS}/${teamId}/${COLLECTIONS.MEMBER_SUMMARIES}`;
    await deleteCollection(summaryCollectionPath);

    const members = teamDoc.data().members || {};
    const finalBatch = db.batch();

    Object.keys(members).forEach(memberId => {
        const userRef = db.collection(COLLECTIONS.USERS).doc(memberId);
        finalBatch.set(userRef, { teamId: null, teamRole: null }, { merge: true });
    });

    finalBatch.delete(teamRef);

    await finalBatch.commit();
    return { status: "success", message: "Team deleted successfully." };
});

exports.kickTeamMember = onCall({ region: REGION, maxInstances: 10 }, async (request) => {
    const { uid: callerId } = assertAuthenticated(request);
    const { teamId, memberId } = request.data;
    if (!teamId || !memberId) {
        throw new HttpsError("invalid-argument", "Missing required parameters: teamId or memberId.");
    }

    const teamRef = db.collection(COLLECTIONS.TEAMS).doc(teamId);
    const memberRef = db.collection(COLLECTIONS.USERS).doc(memberId);

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
        Logger.error(`Error kicking member ${memberId} from team ${teamId}:`, error);
        if (error instanceof HttpsError) {
            throw error;
        } else {
            throw new HttpsError("internal", "An unexpected error occurred while trying to kick the team member.");
        }
    }
});

exports.syncTeamMemberSummary = onCall({ region: REGION, maxInstances: 10 }, async (request) => {
    const { uid: userId } = assertAuthenticated(request);
    const userRef = db.collection(COLLECTIONS.USERS).doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
        throw new HttpsError("not-found", "User data not found.");
    }

    const userData = userDoc.data();
    const teamId = userData.teamId;

    if (!teamId) {
        return { status: "no-team", message: "User is not in a team." };
    }

    const teamDoc = await db.collection(COLLECTIONS.TEAMS).doc(teamId).get();
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

exports.updateMemberSummaryOnTeamChange = onDocumentUpdated({ document: `${COLLECTIONS.TEAMS}/{teamId}`, region: REGION, maxInstances: 10 }, async (event) => {
    const teamId = event.params.teamId;
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();

    // With onDocumentUpdated, neither beforeData nor afterData should be undefined, but safety check remains.
    if (!beforeData || !afterData) {
        return;
    }

    const beforeMembers = beforeData.members || {};
    const afterMembers = afterData.members || {};

    const updatedMembers = [];
    for (const memberId in afterMembers) {
        const beforeMember = beforeMembers[memberId];
        const afterMember = afterMembers[memberId];

        // Optimization: Skip if this is a new member (beforeMember is undefined).
        // New members are handled by createTeam/joinTeam explicitly, avoiding double writes.
        if (!beforeMember) {
            continue;
        }

        if (beforeMember.displayName !== afterMember.displayName || beforeMember.role !== afterMember.role) {
            updatedMembers.push(memberId);
        }
    }

    if (updatedMembers.length === 0) {
        return;
    }

    const summaryCollection = db.collection(COLLECTIONS.TEAMS).doc(teamId).collection(COLLECTIONS.MEMBER_SUMMARIES);
    const promises = updatedMembers.map(async (memberId) => {
        const memberData = afterMembers[memberId];
        const summaryRef = summaryCollection.doc(memberId);
        try {
            await summaryRef.set({
                displayName: memberData.displayName,
                role: memberData.role,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            Logger.info(`Updated summary for member ${memberId} in team ${teamId} due to team doc change.`);
        } catch (error) {
            Logger.error(`Error updating summary for member ${memberId}:`, error);
        }
    });

    await Promise.all(promises);
});

// --- ADMIN FUNCTIONS ---

exports.getAllUsers = onCall({ region: REGION, maxInstances: 10 }, async (request) => {
    const { uid: callerUid, token: { email: callerEmail } } = assertAuthenticated(request);
    // Increased limit to 100 to improve searchability while maintaining pagination
    let { nextPageToken, limit = 100 } = request.data || {};

    limit = parseInt(limit);
    if (isNaN(limit) || limit <= 0 || limit > 1000) limit = 100;
    if (!nextPageToken) nextPageToken = undefined;

    const superAdmins = await getSuperAdmins();
    let isAuthorized = superAdmins.includes(callerEmail);

    if (!isAuthorized) {
        const callerDoc = await db.collection(COLLECTIONS.USERS).doc(callerUid).get();
        if (callerDoc.exists && callerDoc.data().role === USER_ROLES.CO_ADMIN) {
            isAuthorized = true;
        }
    }

    if (!isAuthorized) {
        throw new HttpsError("permission-denied", "Not authorized.");
    }

    try {
        const listUsersResult = await admin.auth().listUsers(limit, nextPageToken);
        const users = listUsersResult.users.map(u => ({
            uid: u.uid,
            email: u.email,
            displayName: u.displayName,
            photoURL: u.photoURL,
            creationTime: u.metadata.creationTime,
            lastSignInTime: u.metadata.lastSignInTime
        }));

        // Optimize: Only fetch Firestore docs for the users we just retrieved from Auth
        const userRefs = users.map(u => db.collection(COLLECTIONS.USERS).doc(u.uid));
        let firestoreDocs = [];
        if (userRefs.length > 0) {
            firestoreDocs = await db.getAll(...userRefs);
        }

        const firestoreData = {};
        firestoreDocs.forEach(doc => {
            if (doc.exists) {
                firestoreData[doc.id] = doc.data();
            }
        });

        // 1. Fetch Whitelisted Users
        // We fetch this on every page to ensure pending users are always visible/searchable
        // regardless of pagination state of the main Auth list.
        const whitelistSnapshot = await db.collection(COLLECTIONS.PRO_WHITELIST).get();
        const whitelistData = [];
        whitelistSnapshot.forEach(doc => {
            whitelistData.push(doc.data());
        });

        // 2. Map Existing Users
        const combined = users.map(u => {
            const data = firestoreData[u.uid] || {};
            return {
                ...u,
                role: data.role || USER_ROLES.STANDARD,
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

        return { users: combined, nextPageToken: listUsersResult.pageToken };

    } catch (error) {
        Logger.error("Error fetching users:", error);
        throw new HttpsError("internal", "Failed to fetch users.");
    }
});

exports.updateUserRole = onCall({ region: REGION, maxInstances: 10 }, async (request) => {
    const { uid: callerUid, token: { email: callerEmail } } = assertAuthenticated(request);
    const superAdmins = await getSuperAdmins();
    const isSuperAdmin = superAdmins.includes(callerEmail);
    let isAuthorized = isSuperAdmin;

    if (!isAuthorized) {
        const callerDoc = await db.collection(COLLECTIONS.USERS).doc(callerUid).get();
        if (callerDoc.exists && callerDoc.data().role === USER_ROLES.CO_ADMIN) {
            isAuthorized = true;
        }
    }

    if (!isAuthorized) {
        throw new HttpsError("permission-denied", "Not authorized.");
    }

    const { targetUserId, newRole, proExpiry } = request.data;

    if (![USER_ROLES.STANDARD, USER_ROLES.PRO, USER_ROLES.CO_ADMIN].includes(newRole)) {
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
            isPro: (newRole === USER_ROLES.PRO || newRole === USER_ROLES.CO_ADMIN)
        };

        if (newRole === USER_ROLES.PRO) {
            updateData.proSince = admin.firestore.FieldValue.serverTimestamp();
            updateData.proExpiry = proExpiry ? admin.firestore.Timestamp.fromDate(new Date(proExpiry)) : null;
        } else if (newRole === USER_ROLES.STANDARD) {
            updateData.proSince = admin.firestore.FieldValue.delete();
            updateData.proExpiry = admin.firestore.FieldValue.delete();
        }

        await db.collection(COLLECTIONS.USERS).doc(targetUserId).set(updateData, { merge: true });

        return { success: true };
    } catch (error) {
        Logger.error("Error updating user role:", error);
        throw new HttpsError("internal", "Failed to update role.");
    }
});

exports.grantProByEmail = onCall({ region: REGION, maxInstances: 10 }, async (request) => {
    const { uid: callerUid, token: { email: callerEmail } } = assertAuthenticated(request);
    const superAdmins = await getSuperAdmins();
    let isAuthorized = superAdmins.includes(callerEmail);

    if (!isAuthorized) {
        const callerDoc = await db.collection(COLLECTIONS.USERS).doc(callerUid).get();
        if (callerDoc.exists && callerDoc.data().role === USER_ROLES.CO_ADMIN) {
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
            await db.collection(COLLECTIONS.USERS).doc(userRecord.uid).set({
                role: USER_ROLES.PRO,
                isPro: true,
                proSince: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            return { message: "Existing user upgraded to Pro." };
        } else {
            // User does not exist, add to whitelist
            await db.collection(COLLECTIONS.PRO_WHITELIST).doc(email).set({
                email: email,
                role: USER_ROLES.PRO,
                addedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            return { message: "User not found. Added to Pro whitelist for when they sign up." };
        }

    } catch (error) {
        Logger.error("Error granting pro by email:", error);
        throw new HttpsError("internal", "Failed to grant pro access.");
    }
});

exports.revokeProWhitelist = onCall({ region: REGION, maxInstances: 10 }, async (request) => {
    const { uid: callerUid, token: { email: callerEmail } } = assertAuthenticated(request);
    const superAdmins = await getSuperAdmins();
    let isAuthorized = superAdmins.includes(callerEmail);

    if (!isAuthorized) {
        const callerDoc = await db.collection(COLLECTIONS.USERS).doc(callerUid).get();
        if (callerDoc.exists && callerDoc.data().role === USER_ROLES.CO_ADMIN) {
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
        await db.collection(COLLECTIONS.PRO_WHITELIST).doc(email).delete();
        return { message: "User removed from Pro whitelist." };
    } catch (error) {
        Logger.error("Error revoking pro whitelist:", error);
        throw new HttpsError("internal", "Failed to revoke pro whitelist.");
    }
});
