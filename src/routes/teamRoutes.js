import { auth, db, getFunctionsInstance, doc, getDoc, collection, onSnapshot } from '../config/firebase.js';
import { COLLECTIONS } from '../config/constants.js';
import { state, setState, DOM, i18n } from '../../app.js';
import { showMessage, setButtonLoadingState, updateView } from './uiRoutes.js';
import { Logger } from '../utils/logger.js';
import { sanitizeHTML } from '../utils/utils.js';
import { TEAM_ROLES } from '../config/constants.js';
import { html, render } from 'lit-html';

export async function subscribeToTeamData(callback) {
    if (!state.currentTeam) {
        if (callback) callback();
        return;
    }

    // Subscribe to team document
    const teamDocRef = doc(db, COLLECTIONS.TEAMS, state.currentTeam);

    // Feature: Disable real-time updates for now
    // const unsubscribeTeam = onSnapshot(teamDocRef, (doc) => { ... });
    // setState({ unsubscribeFromTeam: unsubscribeTeam });

    try {
        const docSnapshot = await getDoc(teamDocRef);
        if (docSnapshot.exists()) {
            const teamData = docSnapshot.data();
            const membersArray = Object.values(teamData.members || {});
            setState({
                teamName: teamData.name,
                teamMembers: membersArray
            });

            // If user is admin, load all member data for the dashboard
            if (state.teamRole === TEAM_ROLES.ADMIN) {
                loadTeamMembersData();
            }
            updateView();
        } else {
            // This can happen if the team is deleted.
            cleanupTeamSubscriptions();
            setState({ currentTeam: null, teamRole: null, teamName: null, teamMembers: [], teamMembersData: {} });
            updateView();
        }
    } catch (error) {
        Logger.error("Failed to load team data:", error);
    }

    if (callback) callback();
}

export async function loadTeamMembersData() {
    // Clean up existing member summary listeners
    if (state.unsubscribeFromTeamMembers) {
        state.unsubscribeFromTeamMembers.forEach(unsub => unsub());
    }

    if (!state.currentTeam) return;

    const summaryCollectionRef = collection(db, COLLECTIONS.TEAMS, state.currentTeam, COLLECTIONS.MEMBER_SUMMARIES);

    const unsubscribe = onSnapshot(summaryCollectionRef, (snapshot) => {
        const teamMembersData = { ...state.teamMembersData }; // Preserve existing data

        snapshot.docChanges().forEach((change) => {
            if (change.type === "removed") {
                delete teamMembersData[change.doc.id];
            } else {
                teamMembersData[change.doc.id] = change.doc.data();
            }
        });

        setState({ teamMembersData });

        // If the dashboard is currently open, re-render it
        if (DOM.teamDashboardModal.classList.contains('visible')) {
            renderTeamDashboard();
        }
    }, (error) => {
        Logger.error("Error listening to team member summaries:", error);
        showMessage(i18n.t("team.msgRealTimeError"), "error");
    });

    setState({ unsubscribeFromTeamMembers: [unsubscribe] });
}

export async function triggerTeamSync() {
    if (!state.isOnlineMode || !state.userId || !state.currentTeam) return;

    try {
        Logger.info("Triggering team summary sync...");
        const { functions, httpsCallable } = await getFunctionsInstance();
        const syncCallable = httpsCallable(functions, 'syncTeamMemberSummary');
        // We don't await this to keep the UI responsive, but we catch errors.
        syncCallable().then(() => {
            Logger.info("Team summary synced successfully.");
        }).catch(error => {
             Logger.error("Failed to sync team summary:", error);
        });
    } catch (error) {
        Logger.error("Error triggering team sync:", error);
    }
}

export function cleanupTeamSubscriptions() {
    if (state.unsubscribeFromTeam) {
        state.unsubscribeFromTeam();
        setState({ unsubscribeFromTeam: null });
    }

    state.unsubscribeFromTeamMembers.forEach(unsub => unsub());
    setState({ unsubscribeFromTeamMembers: [] });
}

export function renderTeamSection() {
    const teamIcon = document.getElementById('team-icon');
    if (teamIcon) {
        if (state.currentTeam) {
            teamIcon.className = 'fa-solid fa-user w-5 h-5 me-2 mt-1 sm:mt-0.5';
        } else {
            teamIcon.className = 'fa-regular fa-user w-5 h-5 me-2 mt-1 sm:mt-0.5';
        }
    }

    if (!state.isOnlineMode) {
        render(html`<p class="text-center text-gray-500">${i18n.t('team.offline')}</p>`, DOM.teamSection);
        return;
    }

    // Check for Pro Access
    const isSuperAdmin = state.superAdmins.includes(auth?.currentUser?.email);
    const isPro = state.userRole === 'pro' || state.userRole === 'co-admin' || isSuperAdmin;

    if (!state.currentTeam) {
        const createTeamTemplate = html`
            <div class="text-center">
                <h3 class="text-lg font-semibold mb-4">${i18n.t('team.management')}</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="team-card bg-gray-50 dark:bg-gray-800 p-4 sm:p-6 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-400 cursor-pointer transition-all active:scale-95 duration-200">
                        <button id="create-team-btn" class="w-full text-left">
                            <div class="flex items-center justify-center mb-3 sm:mb-4">
                                <div class="w-12 h-12 sm:w-16 sm:h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                                    <svg class="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                                    </svg>
                                </div>
                            </div>
                            <h4 class="text-lg sm:text-xl font-bold text-center mb-1 sm:mb-2">${i18n.t('team.create')}</h4>
                            <p class="text-sm sm:text-base text-center text-gray-600 dark:text-gray-400">${i18n.t('team.createDesc')}</p>
                        </button>
                    </div>
                    <div class="team-card bg-gray-50 dark:bg-gray-800 p-4 sm:p-6 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-green-400 dark:hover:border-green-400 cursor-pointer transition-all active:scale-95 duration-200">
                        <button id="join-team-btn" class="w-full text-left">
                            <div class="flex items-center justify-center mb-3 sm:mb-4">
                                <div class="w-12 h-12 sm:w-16 sm:h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                                    <svg class="w-6 h-6 sm:w-8 sm:h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                                    </svg>
                                </div>
                            </div>
                            <h4 class="text-lg sm:text-xl font-bold text-center mb-1 sm:mb-2">${i18n.t('team.join')}</h4>
                            <p class="text-sm sm:text-base text-center text-gray-600 dark:text-gray-400">${i18n.t('team.joinDesc')}</p>
                        </button>
                    </div>
                </div>
            </div>
        `;
        render(createTeamTemplate, DOM.teamSection);
    } else {
        // Has team - show team info and actions
        const isAdmin = state.teamRole === TEAM_ROLES.ADMIN;
        const memberCount = state.teamMembers.length || 0;

        const teamInfoTemplate = html`
            <div class="space-y-4 sm:space-y-6">
                <div class="text-center">
                    <h3 class="text-base sm:text-lg font-semibold mb-2 flex items-center justify-center">
                        <i class="fa-solid fa-user-group w-4 h-4 sm:w-5 sm:h-5 me-2 text-blue-600"></i>
                        <span class="truncate">${sanitizeHTML(state.teamName || 'Your Team')}</span>
                        ${isAdmin ? html`
                        <button id="open-edit-team-name-btn" class="icon-btn ms-2 text-gray-500 hover:text-blue-600" title="Edit Team Name">
                            <svg class="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z"></path></svg>
                        </button>
                        ` : ''}
                    </h3>
                    <p class="text-xs sm:text-base text-gray-600 dark:text-gray-400">${isAdmin ? i18n.t('team.youAreAdmin') : i18n.t('team.youAreMember')} • ${memberCount === 1 ? i18n.t('team.memberCount').replace('{count}', memberCount) : i18n.t('team.membersCount').replace('{count}', memberCount)}</p>
                </div>

                <div class="bg-white dark:bg-gray-100 p-3 sm:p-4 rounded-lg border">
                    <h4 class="font-semibold text-sm sm:text-base mb-2 sm:mb-3 text-center">${i18n.t('team.roomCode')}</h4>
                    <div class="text-center">
                        <div class="room-code text-sm sm:text-base">
                            <span>${state.currentTeam}</span>
                            <button id="copy-room-code-btn" class="icon-btn hover:border hover:border-white ms-2" title="${i18n.t('team.copyCode')}">
                                <i class="fa-regular fa-copy text-white"></i>
                            </button>
                        </div>
                    </div>
                    <p class="text-xs sm:text-sm text-gray-600 dark:text-gray-400 text-center mt-2 sm:mt-3">${i18n.t('team.shareCodeMessage')}</p>
                </div>

                <div class="flex flex-col md:flex-row gap-3 sm:gap-4">
                    ${isAdmin ? html`
                        <button id="team-dashboard-btn" class="w-full md:flex-1 px-3 py-2 sm:px-4 sm:py-3 bg-[#0071e3] text-white rounded-full hover:bg-[#0077ed] transition-colors flex items-center justify-center text-sm sm:text-base active:scale-95 duration-200">
                            <svg class="w-4 h-4 sm:w-5 sm:h-5 me-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                            </svg>
                            ${i18n.t('team.dashboard')}
                        </button>
                    ` : ''}
                    <button id="edit-display-name-btn" class="w-full md:flex-1 px-3 py-2 sm:px-4 sm:py-3 bg-gray-500 text-white rounded-full hover:bg-gray-600 transition-colors flex items-center justify-center text-sm sm:text-base active:scale-95 duration-200">
                        <svg class="w-4 h-4 sm:w-5 sm:h-5 me-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z"></path>
                        </svg>
                        ${i18n.t('tracker.changeName')}
                    </button>
                    ${isAdmin ? html`
                        <button id="delete-team-btn" class="w-full md:flex-1 px-3 py-2 sm:px-4 sm:py-3 bg-[#ff3b30] text-white rounded-full hover:bg-[#ff4f44] transition-colors flex items-center justify-center text-sm sm:text-base active:scale-95 duration-200">
                            <svg class="w-4 h-4 sm:w-5 sm:h-5 me-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                            ${i18n.t('team.delete')}
                        </button>
                    ` : html`
                        <button id="leave-team-btn" class="w-full md:flex-1 px-3 py-2 sm:px-4 sm:py-3 bg-[#ff3b30] text-white rounded-full hover:bg-[#ff4f44] transition-colors flex items-center justify-center text-sm sm:text-base active:scale-95 duration-200">
                            <i class="fa-solid fa-door-open w-4 h-4 sm:w-5 sm:h-5 me-2"></i>
                            ${i18n.t('team.leave')}
                        </button>
                    `}
                </div>
            </div>
        `;

        render(teamInfoTemplate, DOM.teamSection);
    }
}

export function openCreateTeamModal() {
    const isSuperAdmin = state.superAdmins.includes(auth?.currentUser?.email);
    const isPro = state.userRole === 'pro' || state.userRole === 'co-admin' || isSuperAdmin;

    // Reset visibility of content parts
    let upgradeMsg = DOM.createTeamModal.querySelector('#create-team-upgrade-msg');
    let formContent = DOM.createTeamModal.querySelector('.space-y-4');
    let buttons = DOM.createTeamModal.querySelector('#save-create-team-btn')?.parentElement;

    if (!isPro) {
        if (formContent) formContent.style.display = 'none';
        if (buttons) buttons.style.display = 'none';

        if (!upgradeMsg) {
            upgradeMsg = document.createElement('div');
            upgradeMsg.id = 'create-team-upgrade-msg';
            upgradeMsg.className = 'text-center py-4';
            upgradeMsg.innerHTML = `
                <div class="mx-auto mb-4 text-center">
                    <i class="fas fa-crown text-5xl text-yellow-500"></i>
                </div>
                <h3 class="text-xl font-bold mb-2">${i18n.t('pro.featureTitle')}</h3>
                <p class="text-gray-600 dark:text-gray-400 mb-6">
                    ${i18n.t('pro.createTeamMsg')}
                </p>
                <button class="w-full px-6 py-3 btn-primary rounded-full font-semibold active:scale-95 transition-all duration-200" onclick="window.location.href='mailto:arunthomas04042001@gmail.com?subject=Upgrade%20to%20Pro'">
                    ${i18n.t('pro.upgrade')}
                </button>
                <div class="mt-4">
                    <button class="text-gray-500 hover:text-gray-700 text-sm" onclick="document.getElementById('create-team-modal').classList.remove('visible')">${i18n.t('common.cancel')}</button>
                </div>
            `;
            // Insert after title
            const title = DOM.createTeamModal.querySelector('h2');
            if (title) title.insertAdjacentElement('afterend', upgradeMsg);
        } else {
            upgradeMsg.style.display = 'block';
        }
    } else {
        // Is Pro
        if (formContent) formContent.style.display = 'block';
        if (buttons) buttons.style.display = 'flex';
        if (upgradeMsg) upgradeMsg.style.display = 'none';

        DOM.teamNameInput.value = '';
        if (DOM.teamAdminDisplayNameInput) {
            DOM.teamAdminDisplayNameInput.value = '';
        }
    }

    DOM.createTeamModal.classList.add('visible');
}

export function closeCreateTeamModal() {
    DOM.createTeamModal.classList.remove('visible');
}

export function openJoinTeamModal() {
    DOM.roomCodeInput.value = '';
    DOM.displayNameInput.value = '';
    DOM.joinTeamModal.classList.add('visible');
}

export function closeJoinTeamModal() {
    DOM.joinTeamModal.classList.remove('visible');
}

export function openEditDisplayNameModal() {
    // Find current user's display name
    const currentMember = state.teamMembers.find(m => m.userId === state.userId);
    DOM.newDisplayNameInput.value = currentMember?.displayName || '';
    DOM.editDisplayNameModal.classList.add('visible');
}

export function closeEditDisplayNameModal() {
    DOM.editDisplayNameModal.classList.remove('visible');
}

export function openEditTeamNameModal() {
    DOM.newTeamNameInput.value = state.teamName || '';
    DOM.editTeamNameModal.classList.add('visible');
}

export function closeEditTeamNameModal() {
    DOM.editTeamNameModal.classList.remove('visible');
}

export async function createTeam() {
    const button = DOM.createTeamModal.querySelector('#save-create-team-btn');
    const teamName = DOM.teamNameInput.value.trim();
    const displayName = DOM.teamAdminDisplayNameInput.value.trim();

    if (!teamName || !displayName) {
        showMessage(i18n.t("team.msgCreateFieldsRequired"), 'error');
        return;
    }

    setButtonLoadingState(button, true);

    try {
        const { functions, httpsCallable } = await getFunctionsInstance();
        const createTeamCallable = httpsCallable(functions, 'createTeam');
        const result = await createTeamCallable({ teamName, displayName });

        showMessage(result.data.message, 'success');
        closeCreateTeamModal();

    } catch (error) {
        Logger.error('Error creating team:', error);
        showMessage(i18n.t("team.msgCreateFailed").replace('{error}', error.message), 'error');
    } finally {
        setButtonLoadingState(button, false);
    }
}

export async function joinTeam() {
    const button = DOM.joinTeamModal.querySelector('#save-join-team-btn');
    const roomCode = DOM.roomCodeInput.value.trim().toUpperCase();
    const displayName = DOM.displayNameInput.value.trim();

    if (!roomCode || !displayName) {
        showMessage(i18n.t("team.msgJoinFieldsRequired"), 'error');
        return;
    }

    setButtonLoadingState(button, true);

    try {
        const { functions, httpsCallable } = await getFunctionsInstance();
        const joinTeamCallable = httpsCallable(functions, 'joinTeam');
        const result = await joinTeamCallable({ roomCode, displayName });

        showMessage(result.data.message, 'success');
        closeJoinTeamModal();
    } catch (error) {
        Logger.error('Error calling joinTeam function:', error);
        showMessage(i18n.t("team.msgJoinFailed").replace('{error}', error.message), 'error');
    } finally {
        setButtonLoadingState(button, false);
    }
}

export async function editDisplayName() {
    const button = DOM.editDisplayNameModal.querySelector('#save-edit-name-btn');
    const newDisplayName = DOM.newDisplayNameInput.value.trim();

    if (!newDisplayName) {
        showMessage(i18n.t("team.msgDisplayNameRequired"), 'error');
        return;
    }

    setButtonLoadingState(button, true);
    try {
        const { functions, httpsCallable } = await getFunctionsInstance();
        const editDisplayNameCallable = httpsCallable(functions, 'editDisplayName');
        await editDisplayNameCallable({ newDisplayName: newDisplayName, teamId: state.currentTeam });
        showMessage(i18n.t("team.msgDisplayNameUpdated"), 'success');
        closeEditDisplayNameModal();
    } catch (error) {
        Logger.error('Error updating display name:', error);
        showMessage(i18n.t("team.msgDisplayNameUpdateFailed").replace('{error}', error.message), 'error');
    } finally {
        setButtonLoadingState(button, false);
    }
}

export async function editTeamName() {
    const button = DOM.editTeamNameModal.querySelector('#save-edit-team-name-btn');
    const newTeamName = DOM.newTeamNameInput.value.trim();

    if (!newTeamName) {
        showMessage(i18n.t("team.msgNameRequired"), 'error');
        return;
    }

    setButtonLoadingState(button, true);
    try {
        const { functions, httpsCallable } = await getFunctionsInstance();
        const editTeamNameCallable = httpsCallable(functions, 'editTeamName');
        await editTeamNameCallable({ newTeamName: newTeamName, teamId: state.currentTeam });
        showMessage(i18n.t("team.msgNameUpdated"), 'success');
        closeEditTeamNameModal();
    } catch (error) {
        Logger.error('Error updating team name:', error);
        showMessage(i18n.t("team.msgNameUpdateFailed").replace('{error}', error.message), 'error');
    } finally {
        setButtonLoadingState(button, false);
    }
}

export async function leaveTeam(button) {
    try {
        const { functions, httpsCallable } = await getFunctionsInstance();
        const leaveTeamCallable = httpsCallable(functions, 'leaveTeam');
        await leaveTeamCallable({ teamId: state.currentTeam });
        showMessage(i18n.t("team.msgLeftSuccess"), 'success');
    } catch (error) {
        Logger.error('Error leaving team:', error);
        showMessage(i18n.t("team.msgLeftFailed").replace('{error}', error.message), 'error');
    } finally {
        if (button) setButtonLoadingState(button, false);
    }
}

export async function deleteTeam(button) {
    try {
        const { functions, httpsCallable } = await getFunctionsInstance();
        const deleteTeamCallable = httpsCallable(functions, 'deleteTeam');
        await deleteTeamCallable({ teamId: state.currentTeam });
        showMessage(i18n.t("team.msgDeletedSuccess"), 'success');
    } catch (error) {
        Logger.error('Error deleting team:', error);
        showMessage(i18n.t("team.msgDeleteFailed").replace('{error}', error.message), 'error');
    } finally {
        if (button) setButtonLoadingState(button, false);
    }
}

export function copyRoomCode() {
    navigator.clipboard.writeText(state.currentTeam).then(() => {
        showMessage(i18n.t("team.msgCodeCopied"), 'success');
    }).catch(() => {
        showMessage(i18n.t("team.msgCodeCopyFailed"), 'error');
    });
}

export function openKickMemberModal(memberId, memberName) {
    DOM.kickModalText.innerHTML = i18n.t('team.confirmKickMessage').replace('{name}', sanitizeHTML(memberName));
    DOM.confirmKickModal.dataset.memberId = memberId;
    DOM.confirmKickModal.classList.add('visible');
}

export function closeKickMemberModal() {
    DOM.confirmKickModal.classList.remove('visible');
}

export async function kickMember() {
    const memberId = DOM.confirmKickModal.dataset.memberId;
    if (!memberId) return;

    const button = DOM.confirmKickModal.querySelector('#confirm-kick-btn');
    setButtonLoadingState(button, true);

    try {
        const { functions, httpsCallable } = await getFunctionsInstance();
        const kickTeamMemberCallable = httpsCallable(functions, 'kickTeamMember');
        await kickTeamMemberCallable({ teamId: state.currentTeam, memberId: memberId });
        showMessage(i18n.t("team.msgKickSuccess"), 'success');
        closeKickMemberModal();
    } catch (error) {
        Logger.error('Error kicking member:', error);
        showMessage(i18n.t("team.msgKickFailed").replace('{error}', error.message), 'error');
    } finally {
        setButtonLoadingState(button, false);
    }
}

export function openTeamDashboard() {
    DOM.teamDashboardModal.classList.add('visible');
    renderTeamDashboard();
}

export function closeTeamDashboard() {
    DOM.teamDashboardModal.classList.remove('visible');
}

export function renderTeamDashboard() {
    // Remember which rows are open before re-rendering.
    const openMemberIds = new Set();
    DOM.teamDashboardContent.querySelectorAll('details[open]').forEach(detail => {
        if (detail.dataset.userId) {
            openMemberIds.add(detail.dataset.userId);
        }
    });
    if (!state.teamMembers || state.teamMembers.length === 0) {
        DOM.teamDashboardContent.innerHTML = `<p class="text-center text-gray-500">${i18n.t('team.loadingData')}</p>`;
        return;
    }

    // Combine team member info with their summary data
    const combinedMembers = state.teamMembers.map(member => ({
        ...member,
        summary: state.teamMembersData[member.userId] || {}
    }));

    const admin = combinedMembers.find(m => m.role === TEAM_ROLES.ADMIN);
    const members = combinedMembers.filter(m => m.role !== TEAM_ROLES.ADMIN);
    const sortedMembers = [
        ...(admin ? [admin] : []),
        ...members.sort((a, b) => a.displayName.localeCompare(b.displayName))
    ];

    const dashboardYear = state.currentMonth.getFullYear().toString();


    const membersHTML = sortedMembers.map(member => {
        const balances = member.summary.yearlyLeaveBalances ? (member.summary.yearlyLeaveBalances[dashboardYear] || {}) : {};
        const isAdmin = member.role === TEAM_ROLES.ADMIN;

        const leaveTypesHTML = Object.values(balances).length > 0
            ? '<div class="leave-stat-grid">' + Object.values(balances).map(balance => {
                const usedPercentage = balance.total > 0 ? (balance.used / balance.total) * 100 : 0;
                const radius = 26;
                const circumference = 2 * Math.PI * radius;
                const offset = circumference - (usedPercentage / 100) * circumference;

                return `
            <div class="leave-stat-card">
                <div class="radial-progress-container">
                    <svg class="w-full h-full" viewBox="0 0 60 60">
                        <circle class="radial-progress-bg" cx="30" cy="30" r="${radius}"></circle>
                        <circle class="radial-progress-bar"
                                cx="30" cy="30" r="${radius}"
                                stroke="${balance.color}"
                                stroke-dasharray="${circumference}"
                                stroke-dashoffset="${offset}"
                                transform="rotate(-90 30 30)">
                        </circle>
                    </svg>
                    <div class="radial-progress-center-text" style="color: ${balance.color};">
                        ${Math.round(usedPercentage)}%
                    </div>
                </div>
                <div class="stat-card-info min-w-0 overflow-hidden">
                    <h5 class="truncate" title="${sanitizeHTML(balance.name)}">${sanitizeHTML(balance.name)}</h5>
                    <p>${i18n.t('tracker.balance')}: ${balance.balance} ${i18n.t('tracker.days')}</p>
                    <p>${i18n.t('tracker.used')}: ${balance.used} / ${balance.total} ${i18n.t('tracker.days')}</p>
                </div>
            </div>
        `;
            }).join('') + '</div>'
            : '';

        return `
           <details class="team-member-card ${isAdmin ? 'team-admin-card' : ''} bg-white dark:bg-gray-50 rounded-lg shadow-sm border-l-4 overflow-hidden" data-user-id="${member.userId}">
                <summary class="flex items-center justify-between p-3 sm:p-6 cursor-pointer">
                    <div class="flex items-center">
                        <div class="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-base sm:text-lg flex-shrink-0">
                            ${member.displayName.charAt(0).toUpperCase()}
                        </div>
                        <div class="ms-3">
                            <h4 class="font-bold text-base sm:text-lg">${sanitizeHTML(member.displayName)}</h4>
                            <p class="text-xs sm:text-sm text-gray-600 dark:text-gray-400" data-i18n="${isAdmin ? 'teamAdmin' : 'member'}">${isAdmin ? i18n.t('team.roleAdmin') : i18n.t('team.roleMember')}</p>
                        </div>
                    </div>
                    <div class="flex items-center">
                        ${isAdmin ? `
                        <div class="w-6 h-6 bg-yellow-100 dark:bg-yellow-800 rounded-full flex items-center justify-center me-2 sm:me-4">
                            <svg class="w-4 h-4 text-yellow-600 dark:text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                            </svg>
                        </div>
                        ` : ''}
                        ${(state.teamRole === TEAM_ROLES.ADMIN && !isAdmin) ? `
                        <button class="kick-member-btn icon-btn text-red-500 hover:text-red-700 dark:text-red-500 dark:hover:text-red-700 me-2" title="Kick Member" data-kick-member-id="${member.userId}" data-kick-member-name="${member.displayName}">
                            <i class="fa-solid fa-circle-xmark"></i>
                        </button>
                        ` : ''}
                        <svg class="w-6 h-6 text-gray-500 accordion-arrow transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                </summary>
                <div class="team-member-details-content p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700">
                    ${Object.keys(balances).length > 0 ? `
                        <div>
                            <h5 class="font-semibold mb-3 sm:mb-4 team-dashboard-title">${i18n.t('tracker.leaveBalanceOverview')} (${dashboardYear})</h5>
                            ${leaveTypesHTML}
                        </div>
                    ` : `
                        <div class="text-center py-6 text-gray-500">
                            <svg class="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                            </svg>
                            <p>${i18n.t('tracker.noLeaveTypesOrSummary').replace('{year}', dashboardYear)}</p>
                        </div>
                    `}
                </div>
            </details>
        `;
    }).join('');

    DOM.teamDashboardContent.innerHTML = `
        <div class="space-y-3">
            ${membersHTML}
        </div>
    `;
    // Restore the open state of the rows that were open before.
    if (openMemberIds.size > 0) {
        openMemberIds.forEach(userId => {
            const detailElement = DOM.teamDashboardContent.querySelector(`details[data-user-id="${userId}"]`);
            if (detailElement) {
                detailElement.open = true;
            }
        });
    }
}
