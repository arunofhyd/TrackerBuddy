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

/**
 * Grants Pro access to a user.
 * SECURITY WARNING: Update the admin email check before deploying to production.
 */
exports.grantProAccess = onCall({ region: "asia-south1" }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in.");
    }

    // SECURITY: Restrict this function to a specific admin email.
    // Replace 'admin@trackerbuddy.com' with your actual admin email address.
    const ADMIN_EMAIL = 'arunthomas04042001@gmail.com';
    if (request.auth.token.email !== ADMIN_EMAIL) {
        throw new HttpsError("permission-denied", "Only the administrator can perform this action.");
    }

    let targetUserId = request.data.userId;
    const targetEmail = request.data.email;

    if (!targetUserId && !targetEmail) {
        throw new HttpsError("invalid-argument", "Please provide a User ID or Email Address.");
    }

    if (targetEmail) {
        try {
            const userRecord = await admin.auth().getUserByEmail(targetEmail);
            targetUserId = userRecord.uid;
        } catch (error) {
            console.error("Error fetching user by email:", error);
            if (error.code === 'auth/user-not-found') {
                throw new HttpsError("not-found", `No user found with email: ${targetEmail}`);
            }
            throw new HttpsError("internal", "Error finding user by email.");
        }
    }

    await db.collection("users").doc(targetUserId).set({
        isPro: true,
        proSince: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return { success: true, message: `Pro access granted to ${targetEmail || targetUserId}.` };
});

/**
 * Revokes Pro access from a user.
 */
exports.revokeProAccess = onCall({ region: "asia-south1" }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in.");
    }

    const ADMIN_EMAIL = 'arunthomas04042001@gmail.com';
    if (request.auth.token.email !== ADMIN_EMAIL) {
        throw new HttpsError("permission-denied", "Only the administrator can perform this action.");
    }

    let targetUserId = request.data.userId;
    const targetEmail = request.data.email;

    if (!targetUserId && !targetEmail) {
        throw new HttpsError("invalid-argument", "Please provide a User ID or Email Address.");
    }

    if (targetEmail) {
        try {
            const userRecord = await admin.auth().getUserByEmail(targetEmail);
            targetUserId = userRecord.uid;
        } catch (error) {
            console.error("Error fetching user by email:", error);
            if (error.code === 'auth/user-not-found') {
                throw new HttpsError("not-found", `No user found with email: ${targetEmail}`);
            }
            throw new HttpsError("internal", "Error finding user by email.");
        }
    }

    await db.collection("users").doc(targetUserId).set({
        isPro: false,
        proSince: admin.firestore.FieldValue.delete()
    }, { merge: true });

    return { success: true, message: `Pro access revoked for ${targetEmail || targetUserId}.` };
});

/**
 * Gets a list of all Pro users.
 */
exports.getProUsers = onCall({ region: "asia-south1" }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in.");
    }

    const ADMIN_EMAIL = 'arunthomas04042001@gmail.com';
    if (request.auth.token.email !== ADMIN_EMAIL) {
        throw new HttpsError("permission-denied", "Only the administrator can perform this action.");
    }

    try {
        const snapshot = await db.collection("users").where("isPro", "==", true).get();
        const users = [];

        // We need to fetch email from Auth because Firestore 'users' collection might not have it
        // Note: This might be slow if there are many users, but for an admin panel it's acceptable.
        for (const doc of snapshot.docs) {
            const data = doc.data();
            let email = data.email || "Unknown";
            let displayName = data.displayName || "Unknown";

            try {
                const userRecord = await admin.auth().getUser(doc.id);
                email = userRecord.email;
                displayName = userRecord.displayName || displayName;
            } catch (e) {
                console.warn(`Could not fetch Auth data for user ${doc.id}`, e);
            }

            users.push({
                uid: doc.id,
                email: email,
                displayName: displayName,
                proSince: data.proSince ? data.proSince.toDate().toISOString() : null
            });
        }

        return { success: true, users: users };
    } catch (error) {
        console.error("Error fetching pro users:", error);
        throw new HttpsError("internal", "Failed to fetch pro users.");
    }
});

/**
 * Creates a new team with the authenticated user as the owner.
 */
exports.createTeam = onCall({ region: "asia-south1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in to create a team.");
  }

  const { teamName, displayName } = request.data;
  const userId = request.auth.uid;

  // Check for Pro subscription
  const userSnapshot = await db.collection("users").doc(userId).get();
  if (!userSnapshot.exists || !userSnapshot.data().isPro) {
      throw new HttpsError("permission-denied", "Team features are only available to Pro users.");
  }

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
    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        throw new HttpsError("not-found", "User not found.");
      }
      if (userDoc.data().teamId) {
        throw new HttpsError("already-exists", "You are already in a team.");
      }

      transaction.set(teamRef, {
        name: teamName,
        roomCode: roomCode,
        ownerId: userId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        members: {
          [userId]: {
            userId: userId,
            displayName: displayName,
            role: "owner",
            joinedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        },
      });

      transaction.update(userRef, {
        teamId: roomCode,
        teamRole: "owner",
      });
    });

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

  // Check for Pro subscription
  const userSnapshot = await db.collection("users").doc(userId).get();
  if (!userSnapshot.exists || !userSnapshot.data().isPro) {
      throw new HttpsError("permission-denied", "Team features are only available to Pro users.");
  }

  if (!roomCode || roomCode.length !== 8 || !displayName) {
    throw new HttpsError("invalid-argument", "Please provide a valid room code and display name.");
  }

  const teamRef = db.collection("teams").doc(roomCode);
  const userRef = db.collection("users").doc(userId);

  try {
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

      transaction.update(teamRef, {
        [`members.${userId}`]: {
          userId: userId,
          displayName: displayName,
          role: "member",
          joinedAt: new Date(),
        },
      });

      transaction.set(userRef, {
        teamId: roomCode,
        teamRole: "member",
      }, { merge: true });
    });

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
 * Allows a team owner to edit the team name.
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

    if (teamDoc.data().ownerId !== userId) {
        throw new HttpsError("permission-denied", "Only the team owner can change the team name.");
    }

    await teamRef.update({
        name: newTeamName
    });

    return { status: "success", message: "Team name updated!" };
});

/**
 * Allows a member to leave a team. The owner cannot leave.
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

  if (teamDoc.data().ownerId === userId) {
      throw new HttpsError("permission-denied", "Owner cannot leave the team, must delete it instead.");
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
  return { status: "success", message: "You have left the team." };
});

/**
 * Allows a team owner to delete the entire team.
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

    if (teamDoc.data().ownerId !== userId) {
        throw new HttpsError("permission-denied", "Only the team owner can delete the team.");
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
 * Allows a team owner to kick a member from the team.
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
        const ownerId = teamData.ownerId;

        if (callerId !== ownerId) {
            throw new HttpsError("permission-denied", "Only the team owner can kick members.");
        }
        if (memberId === ownerId) {
            throw new HttpsError("invalid-argument", "The team owner cannot kick themselves.");
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
 * Updates a team member's summary document when their user document changes.
 * This is used to keep leave balance data consistent in the team dashboard.
 */
exports.updateTeamMemberSummary = onDocumentWritten({ document: "users/{userId}", region: "asia-south1" }, async (event) => {
    const userId = event.params.userId;
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();

    // If document is deleted, the afterData is null.
    if (!afterData) {
        // The user was deleted. If they were in a team, their summary should be deleted.
        if (beforeData?.teamId) {
            const summaryRef = db.collection("teams").doc(beforeData.teamId).collection("member_summaries").doc(userId);
            try {
                await summaryRef.delete();
                console.log(`Deleted summary for deleted user ${userId} from team ${beforeData.teamId}`);
            } catch (error) {
                console.error("Error deleting summary for deleted user:", error);
            }
        }
        return;
    }

    const teamId = afterData.teamId;
    const oldTeamId = beforeData?.teamId;

    // Case 1: User leaves or is removed from a team
    if (oldTeamId && !teamId) {
        const summaryRef = db.collection("teams").doc(oldTeamId).collection("member_summaries").doc(userId);
        try {
            await summaryRef.delete();
            console.log(`Deleted summary for user ${userId} who left team ${oldTeamId}`);
        } catch (error) {
            console.error("Error deleting summary for user who left team:", error);
        }
    }

    // Case 2: User joins a team or their data changes while in a team
    if (teamId) {
        const leaveTypesChanged = JSON.stringify(beforeData?.leaveTypes) !== JSON.stringify(afterData.leaveTypes);
        const yearlyDataChanged = JSON.stringify(beforeData?.yearlyData) !== JSON.stringify(afterData.yearlyData);
        const oldActivitiesChanged = JSON.stringify(beforeData?.activities) !== JSON.stringify(afterData.activities);

        if (yearlyDataChanged || leaveTypesChanged || (teamId !== oldTeamId) || oldActivitiesChanged) {
            
            // --- DATA STRUCTURE MIGRATION (Server-Side) ---
            // 1. Get a mutable copy of the latest yearlyData.
            let yearlyData = afterData.yearlyData ? JSON.parse(JSON.stringify(afterData.yearlyData)) : {}; 
            
            // 2. Check for and migrate old flat 'activities' data.
            if (afterData.activities && Object.keys(afterData.activities).length > 0) {
                const currentYear = new Date().getFullYear().toString();
                
                // If there's no data for the current year in the new structure, assume the old 'activities' belongs there.
                if (!yearlyData.hasOwnProperty(currentYear)) {
                     // Deep clone and insert the old flat structure under the current year
                    yearlyData[currentYear] = { 
                        activities: afterData.activities ? JSON.parse(JSON.stringify(afterData.activities)) : {}, 
                        leaveOverrides: {} 
                    };
                }
                // NOTE: If both old and new data exist for the current year, we prioritize the newer `yearlyData` key.
                // The client app should handle cleaning up the old 'activities' field on save.
            }
            // --- END MIGRATION ---

            const teamDoc = await db.collection("teams").doc(teamId).get();
            if (!teamDoc.exists) {
                console.log(`User ${userId} is in a non-existent team ${teamId}. Skipping summary update.`);
                return;
            }
            const memberInfo = teamDoc.data()?.members?.[userId];
            if (!memberInfo) {
                console.log(`User ${userId} not found in members list for team ${teamId}. Skipping summary update.`);
                return;
            }

            const summaryRef = db.collection("teams").doc(teamId).collection("member_summaries").doc(userId);
            const leaveTypes = afterData.leaveTypes || [];
            const LEAVE_DAY_TYPES = { FULL: "full", HALF: "half" };

            // --- FIX: Logic to calculate and store balances per year ---
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
            // --- FIX END ---

            const summaryData = {
                userId: userId,
                displayName: memberInfo.displayName,
                role: memberInfo.role,
                yearlyLeaveBalances: yearlyLeaveBalances, // <-- Correct, nested structure is used here
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            };

            try {
                await summaryRef.set(summaryData, { merge: true });
                console.log(`Updated summary for user ${userId} in team ${teamId}`);
            } catch (error) {
                console.error("Error setting summary for user:", error);
            }
        }
    }
});

/**
 * Updates a team member's summary document when their team document changes.
 * This is used to keep displayName and role consistent in the team dashboard.
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
