// Use the explicit v2 import for https functions
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

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
// This is used by syncTeamMemberSummary, joinTeam, and createTeam
async function calculateAndSaveMemberSummary(userId, teamId, userData, memberInfo) {
    if (!userData || !teamId || !memberInfo) {
        console.log(`Missing data for summary calculation for user ${userId}`);
        return;
    }

    // --- DATA STRUCTURE MIGRATION (Server-Side) ---
    // 1. Get a mutable copy of the latest yearlyData.
    let yearlyData = userData.yearlyData ? JSON.parse(JSON.stringify(userData.yearlyData)) : {};

    // 2. Check for and migrate old flat 'activities' data.
    if (userData.activities && Object.keys(userData.activities).length > 0) {
        const currentYear = new Date().getFullYear().toString();

        // If there's no data for the current year in the new structure, assume the old 'activities' belongs there.
        if (!yearlyData.hasOwnProperty(currentYear)) {
                // Deep clone and insert the old flat structure under the current year
            yearlyData[currentYear] = {
                activities: userData.activities ? JSON.parse(JSON.stringify(userData.activities)) : {},
                leaveOverrides: {}
            };
        }
    }
    // --- END MIGRATION ---

    const summaryRef = db.collection("teams").doc(teamId).collection("member_summaries").doc(userId);
    const leaveTypes = userData.leaveTypes || [];
    const LEAVE_DAY_TYPES = { FULL: "full", HALF: "half" };

    const yearlyLeaveBalances = {};
    const systemYear = new Date().getFullYear().toString();

    // Determine all relevant years: all years with data, plus the current system year (if leave types exist)
    const relevantYears = new Set(Object.keys(yearlyData));
    if (leaveTypes.length > 0 && !relevantYears.has(systemYear)) {
        // Add current system year to ensure we calculate 0 balance for future use
        relevantYears.add(systemYear);
    }

    // Loop through all relevant years
    for (const year of relevantYears) {

        const yearData = yearlyData[year] || {};
        const activities = yearData.activities || {};
        const overrides = yearData.leaveOverrides || {};

        const leaveCounts = {};

        // Initialize counts for all global leave types
        leaveTypes.forEach(lt => {
            leaveCounts[lt.id] = 0;
        });

        // Calculate used leave days from activities
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

        // Finalize balances for this year
        leaveTypes.forEach(lt => {
            // Skip leave types that are marked as hidden for this specific year.
            if (overrides[lt.id]?.hidden) return;

            // Use the year-specific totalDays if it exists, otherwise fall back to the global totalDays.
            const totalDays = overrides[lt.id]?.totalDays ?? lt.totalDays;
            const used = leaveCounts[lt.id] || 0;

            // Only include this leave type in the summary if it's configured for the year (totalDays > 0)
            // OR if there is an override defined.
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

        // Only save the year's balance if leave types exist for it
        if (Object.keys(leaveBalancesForYear).length > 0) {
            yearlyLeaveBalances[year] = leaveBalancesForYear;
        }
    } // end for loop

    const summaryData = {
        userId: userId,
        displayName: memberInfo.displayName,
        role: memberInfo.role,
        yearlyLeaveBalances: yearlyLeaveBalances,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    };

    try {
        await summaryRef.set(summaryData, { merge: true });
        console.log(`Updated summary for user ${userId} in team ${teamId}`);
    } catch (error) {
        console.error("Error setting summary for user:", error);
        throw error;
    }
}

// Helper function to delete member summary
async function deleteMemberSummary(userId, teamId) {
    if (!userId || !teamId) return;
    const summaryRef = db.collection("teams").doc(teamId).collection("member_summaries").doc(userId);
    try {
        await summaryRef.delete();
        console.log(`Deleted summary for user ${userId} from team ${teamId}`);
    } catch (error) {
        console.error("Error deleting summary:", error);
    }
}


/**
 * Creates a new team with the authenticated user as the admin.
 */
exports.createTeam = onCall({ region: "asia-south1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in to create a team.");
  }

  const { teamName, displayName } = request.data;
  const userId = request.auth.uid;

  if (!teamName || !displayName) {
    throw new HttpsError("invalid-argument", "Please provide a valid team name and display name.");
  }

  // Generate a unique 8-character room code
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
    if (!userDoc.exists) {
        throw new HttpsError("not-found", "User not found.");
    }
    const userData = userDoc.data();

    await db.runTransaction(async (transaction) => {
      // Re-fetch user in transaction for consistency check
      const tUserDoc = await transaction.get(userRef);
      if (tUserDoc.data().teamId) {
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

      transaction.update(userRef, {
        teamId: roomCode,
        teamRole: "admin",
      });
    });

    // Post-transaction: Create initial summary for the admin
    // We fetch fresh data or use existing if acceptable. Using existing userData for speed.
    // Note: Transaction ensures team existence, but we do summary update outside transaction
    // to avoid complexity, or we could assume eventual consistency.
    // However, for immediate dashboard access, we should do it here.
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

/**
 * Allows an authenticated user to join an existing team.
 */
exports.joinTeam = onCall({ region: "asia-south1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in to join a team.");
  }

  const { roomCode, displayName } = request.data;
  const userId = request.auth.uid;

  if (!roomCode || roomCode.length !== 8 || !displayName) {
    throw new HttpsError("invalid-argument", "Please provide a valid room code and display name.");
  }

  const teamRef = db.collection("teams").doc(roomCode);
  const userRef = db.collection("users").doc(userId);

  try {
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
        throw new HttpsError("not-found", "User not found.");
    }
    const userData = userDoc.data();

    await db.runTransaction(async (transaction) => {
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

    // Create summary for the new member
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

/**
 * Allows a team member to edit their own display name.
 */
exports.editDisplayName = onCall({ region: "asia-south1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const { newDisplayName, teamId } = request.data;
  const userId = request.auth.uid;

  if (!newDisplayName || !teamId) {
    throw new HttpsError("invalid-argument", "Missing required data.");
  }

  const teamRef = db.collection("teams").doc(teamId);
  await teamRef.update({
    [`members.${userId}.displayName`]: newDisplayName
  });

  return { status: "success", message: "Display name updated!" };
});

/**
 * Allows a team admin to edit the team name.
 */
exports.editTeamName = onCall({ region: "asia-south1" }, async (request) => {
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

/**
 * Allows a member to leave a team. The admin cannot leave.
 */
exports.leaveTeam = onCall({ region: "asia-south1" }, async (request) => {
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

  // Delete the summary
  await deleteMemberSummary(userId, teamId);

  return { status: "success", message: "You have left the team." };
});

/**
 * Allows a team admin to delete the entire team.
 */
exports.deleteTeam = onCall({ region: "asia-south1" }, async (request) => {
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

    // Recursively delete the member_summaries subcollection.
    const summaryCollectionPath = `teams/${teamId}/member_summaries`;
    await deleteCollection(summaryCollectionPath);


    const members = teamDoc.data().members || {};
    const finalBatch = db.batch();

    // Remove team info from all member documents
    Object.keys(members).forEach(memberId => {
        const userRef = db.collection("users").doc(memberId);
        finalBatch.set(userRef, { teamId: null, teamRole: null }, { merge: true });
    });

    // Delete the team document itself
    finalBatch.delete(teamRef);

    await finalBatch.commit();
    return { status: "success", message: "Team deleted successfully." };
});

/**
 * Allows a team admin to kick a member from the team.
 */
exports.kickTeamMember = onCall({ region: "asia-south1" }, async (request) => {
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

        // a. Remove the member from the team's 'members' map.
        batch.update(teamRef, {
            [`members.${memberId}`]: admin.firestore.FieldValue.delete()
        });

        // b. Reset the team information on the kicked member's user document.
        batch.set(memberRef, {
            teamId: null,
            teamRole: null
        }, { merge: true });

        await batch.commit();

        // Delete the summary
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

/**
 * Manually synchronizes the team member summary.
 * Call this function from the client when leave data changes.
 * Replacing the expensive background trigger.
 */
exports.syncTeamMemberSummary = onCall({ region: "asia-south1" }, async (request) => {
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
        // User is not in a team, nothing to update.
        return { status: "no-team", message: "User is not in a team." };
    }

    const teamDoc = await db.collection("teams").doc(teamId).get();
    if (!teamDoc.exists) {
        // Team ID exists in user doc but team is gone. Should self-repair ideally.
        return { status: "team-missing", message: "Team not found." };
    }

    const memberInfo = teamDoc.data()?.members?.[userId];
    if (!memberInfo) {
        // User thinks they are in team, but team doesn't list them.
        return { status: "not-member", message: "User not in team members list." };
    }

    await calculateAndSaveMemberSummary(userId, teamId, userData, memberInfo);
    return { status: "success", message: "Summary synced." };
});

/**
 * Updates a team member's summary document when their team document changes.
 * This is used to keep displayName and role consistent in the team dashboard.
 * We keep this trigger as it is low volume (only runs on team metadata updates).
 */
exports.updateMemberSummaryOnTeamChange = onDocumentWritten({ document: "teams/{teamId}", region: "asia-south1" }, async (event) => {
    const teamId = event.params.teamId;
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();

    if (!afterData) {
        // Team was deleted. The subcollection of summaries is handled by the deleteTeam function.
        console.log(`Team ${teamId} deleted.`);
        return;
    }

    const beforeMembers = beforeData?.members || {};
    const afterMembers = afterData.members || {};

    const updatedMembers = [];
    // Check for changed or new members
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
            // Use update with merge to avoid overwriting the whole document if it exists.
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
