// Use the explicit v2 import for https functions
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

/**
 * Creates a new team with the authenticated user as the owner.
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

    // Delete the member_summaries subcollection first.
    // This is not perfectly transactional, but it's better to orphan a team doc than the subcollection.
    const summaryCollectionRef = db.collection("teams").doc(teamId).collection("member_summaries");
    const summaryDocs = await summaryCollectionRef.limit(500).get(); // Limit to 500 to stay within batch limits
    const deleteSummaryBatch = db.batch();
    summaryDocs.forEach(doc => {
        deleteSummaryBatch.delete(doc.ref);
    });
    await deleteSummaryBatch.commit();

    // If there were more than 500 summaries, we'd need a more complex recursive delete function.
    if (summaryDocs.size === 500) {
        console.warn(`Team ${teamId} had 500 or more summaries. Not all may have been deleted.`);
    }

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

        const didLeaveDataChange = (beforeActivities, afterActivities) => {
            const bActivities = beforeActivities || {};
            const aActivities = afterActivities || {};
            const allDates = new Set([...Object.keys(bActivities), ...Object.keys(aActivities)]);
            for (const date of allDates) {
                const beforeLeave = bActivities[date]?.leave;
                const afterLeave = aActivities[date]?.leave;
                if (JSON.stringify(beforeLeave) !== JSON.stringify(afterLeave)) {
                    return true;
                }
            }
            return false;
        };
        
        const leaveDataChanged = didLeaveDataChange(beforeData?.activities, afterData.activities);

        // Update if leave data changed, leave types changed, or if user just joined/switched teams
        if (leaveDataChanged || leaveTypesChanged || (teamId !== oldTeamId)) {
            const teamDoc = await db.collection("teams").doc(teamId).get();
            const teamData = teamDoc.exists ? teamDoc.data() : null;
            const memberInfo = teamData?.members?.[userId];

            if (!memberInfo) {
                console.log(`User ${userId} claims to be in team ${teamId}, but not found in members list. Skipping summary update.`);
                return;
            }

            const summaryRef = db.collection("teams").doc(teamId).collection("member_summaries").doc(userId);

            const leaveTypes = afterData.leaveTypes || [];
            const activities = afterData.activities || {};
            const LEAVE_DAY_TYPES = { FULL: 'full', HALF: 'half' };

            const leaveCounts = {};
            leaveTypes.forEach(lt => { leaveCounts[lt.id] = 0; });

            Object.values(activities).forEach(dayData => {
                if (dayData.leave) {
                    const leaveValue = dayData.leave.dayType === LEAVE_DAY_TYPES.HALF ? 0.5 : 1;
                    if (leaveCounts.hasOwnProperty(dayData.leave.typeId)) {
                        leaveCounts[dayData.leave.typeId] += leaveValue;
                    }
                }
            });

            const summaryData = {
                userId: userId,
                displayName: memberInfo.displayName,
                role: memberInfo.role,
                leaveBalances: {},
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            };

            leaveTypes.forEach(lt => {
                const used = leaveCounts[lt.id] || 0;
                summaryData.leaveBalances[lt.id] = {
                    name: lt.name,
                    color: lt.color,
                    total: lt.totalDays,
                    used: parseFloat(used.toFixed(2)),
                    balance: parseFloat((lt.totalDays - used).toFixed(2))
                };
            });

            try {
                await summaryRef.set(summaryData);
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
