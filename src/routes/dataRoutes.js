import { db, doc, getDoc, updateDoc, setDoc, deleteField, writeBatch } from '../config/firebase.js';
import { COLLECTIONS, LOCAL_STORAGE_KEYS } from '../config/constants.js';
import { state, setState, DOM, i18n } from '../../app.js';
import { showMessage, setButtonLoadingState, updateView, renderStorageUsage, renderAdminButton, restoreLastView, setupTbUserMenu } from './uiRoutes.js';
import { triggerTeamSync } from './teamRoutes.js';
import { Logger } from '../utils/logger.js';
import { getYYYYMMDD } from '../utils/utils.js';
import { ACTION_TYPES, USER_ROLES, BACKUP_PREFIX } from '../config/constants.js';
import { waitForDOMUpdate } from './uiRoutes.js';

export async function subscribeToData(userId, callback) {
    const userDocRef = doc(db, COLLECTIONS.USERS, userId);

    // Feature: Disable real-time updates for now
    // const unsubscribe = onSnapshot(userDocRef, (docSnapshot) => { ... });
    // setState({ unsubscribeFromFirestore: unsubscribe });

    try {
        const docSnapshot = await getDoc(userDocRef);
        let data = docSnapshot.exists() ? docSnapshot.data() : {};

        renderStorageUsage(calculateDataSize(data));

        const year = state.currentMonth.getFullYear();
        const yearlyData = data.yearlyData || {};
        const currentYearData = yearlyData[year] || { activities: {}, leaveOverrides: {} };

        // Check for legacy isPro or new role field
        let userRole = data.role || USER_ROLES.STANDARD;

        // Enforce Expiry
        if (userRole === USER_ROLES.PRO && data.proExpiry) {
            const expiry = data.proExpiry.toDate ? data.proExpiry.toDate() : new Date(data.proExpiry.seconds * 1000);
            if (expiry < new Date()) {
                userRole = USER_ROLES.STANDARD;
            }
        }

        if (userRole === USER_ROLES.STANDARD && data.isPro) {
            userRole = USER_ROLES.PRO;
        }

        setState({
            yearlyData: yearlyData,
            currentYearData: currentYearData,
            leaveTypes: data.leaveTypes || [],
            currentTeam: data.teamId || null,
            teamRole: data.teamRole || null,
            userRole: userRole,
            lastViewMode: data.lastViewMode || null,
            lastTrackerView: data.lastTrackerView || null
        });

        // Render admin button if applicable
        renderAdminButton();

        updateView();

        if (callback) {
            callback();
        }
    } catch (error) {
        Logger.error("Failed to load user data:", error);
        if (callback) callback();
    }
}

export async function persistData(data, partialUpdate = null) {
    if (state.isOnlineMode && state.userId) {
        try {
            await saveDataToFirestore(data, partialUpdate);
        } catch (error) {
            Logger.error("Error saving to Firestore:", error);
            showMessage(i18n.t("messages.saveError"), 'error');
        }
    } else {
        saveDataToLocalStorage(data);
    }
}

export function handleSaveNote(dayDataCopy, payload) {
    if (payload && payload.trim()) {
        dayDataCopy.note = payload;
    } else {
        dayDataCopy.note = '';
    }
}

export function handleAddSlot(dayDataCopy) {
    let newTimeKey = "00:00", counter = 0;
    while (dayDataCopy[newTimeKey]) {
        newTimeKey = `00:00-${++counter}`;
    }
    const existingKeys = Object.keys(dayDataCopy).filter(k => k !== '_userCleared' && k !== 'note' && k !== 'leave');
    const maxOrder = existingKeys.length > 0 ? Math.max(...Object.values(dayDataCopy).filter(v => typeof v === 'object').map(v => v.order || 0)) : -1;
    dayDataCopy[newTimeKey] = { text: "", order: maxOrder + 1 };
    delete dayDataCopy._userCleared;
    return { message: i18n.t("messages.newSlotAdded"), newTimeKey };
}

export function handleUpdateActivityText(dayDataCopy, payload) {
    if (dayDataCopy[payload.timeKey]) {
        dayDataCopy[payload.timeKey].text = payload.newText;
    } else {
        const order = Object.keys(dayDataCopy).filter(k => k !== '_userCleared' && k !== 'note' && k !== 'leave').length;
        dayDataCopy[payload.timeKey] = { text: payload.newText, order };
    }
    delete dayDataCopy._userCleared;
    return i18n.t("messages.activityUpdated");
}

export function handleUpdateTime(dayDataCopy, payload) {
    const { oldTimeKey, newTimeKey } = payload;
    if (!newTimeKey) {
        showMessage(i18n.t("messages.timeEmpty"), 'error');
        return null;
    }
    if (Object.prototype.hasOwnProperty.call(dayDataCopy, newTimeKey) && oldTimeKey !== newTimeKey) {
        showMessage(i18n.t("messages.timeExists").replace('{time}', newTimeKey), 'error');
        return null;
    }

    if (oldTimeKey !== newTimeKey && Object.prototype.hasOwnProperty.call(dayDataCopy, oldTimeKey)) {
        dayDataCopy[newTimeKey] = dayDataCopy[oldTimeKey];
        delete dayDataCopy[oldTimeKey];
    }
    return i18n.t("messages.timeUpdated");
}

export async function saveData(action) {
    const timestamp = Date.now();
    state.lastUpdated = timestamp;

    const dateKey = getYYYYMMDD(state.selectedDate);
    const year = state.selectedDate.getFullYear();

    const updatedYearlyData = JSON.parse(JSON.stringify(state.yearlyData));
    if (!updatedYearlyData[year]) {
        updatedYearlyData[year] = { activities: {}, leaveOverrides: {} };
    }
    const dayDataCopy = { ...(updatedYearlyData[year].activities[dateKey] || {}) };

    let successMessage = null;
    let partialUpdate = null;

    // Check if it's a new day (empty or just userCleared)
    const hasPersistedActivities = updatedYearlyData[year].activities[dateKey] && Object.keys(updatedYearlyData[year].activities[dateKey]).filter(key => key !== '_userCleared' && key !== 'note' && key !== 'leave').length > 0;
    const isNewDay = !hasPersistedActivities && !dayDataCopy._userCleared;
    let populatedDefaultSlots = false;

    if (isNewDay && (action.type === ACTION_TYPES.ADD_SLOT || action.type === ACTION_TYPES.UPDATE_ACTIVITY_TEXT)) {
        if (state.selectedDate.getDay() !== 0) {
            for (let h = 8; h <= 17; h++) {
                const timeKey = `${String(h).padStart(2, '0')}:00-${String(h + 1).padStart(2, '0')}:00`;
                if (!dayDataCopy[timeKey]) dayDataCopy[timeKey] = { text: "", order: h - 8 };
            }
            populatedDefaultSlots = true;
        }
    }

    let addSlotResult = null;

    switch (action.type) {
        case ACTION_TYPES.SAVE_NOTE:
            handleSaveNote(dayDataCopy, action.payload);
            break;
        case ACTION_TYPES.ADD_SLOT:
            addSlotResult = handleAddSlot(dayDataCopy);
            successMessage = addSlotResult.message;
            break;
        case ACTION_TYPES.UPDATE_ACTIVITY_TEXT:
            successMessage = handleUpdateActivityText(dayDataCopy, action.payload);
            break;
        case ACTION_TYPES.UPDATE_TIME:
            // Sanitize time key to prevent Firestore nesting issues
            if (action.payload.newTimeKey) {
                // Trim and replace invalid characters
                action.payload.newTimeKey = action.payload.newTimeKey.trim().replace(/[./]/g, ':');
            }
            successMessage = handleUpdateTime(dayDataCopy, action.payload);
            if (successMessage === null) {
                return;
            }
            break;
    }

    updatedYearlyData[year].activities[dateKey] = dayDataCopy;
    const currentYearData = updatedYearlyData[year] || { activities: {}, leaveOverrides: {} };
    const originalYearlyData = state.yearlyData;

    // Optimistic UI update
    setState({ yearlyData: updatedYearlyData, currentYearData: currentYearData });
    updateView();

    // Construct Partial Update for Firestore
    const basePath = `yearlyData.${year}.activities.${dateKey}`;

    if (populatedDefaultSlots) {
        // If we populated default slots, update the whole day object
        partialUpdate = {
            [basePath]: dayDataCopy
        };
    } else {
        // Granular updates
        partialUpdate = {};

        // Handle _userCleared flag removal
        if (dayDataCopy._userCleared === undefined && originalYearlyData[year]?.activities?.[dateKey]?._userCleared) {
             partialUpdate[`${basePath}._userCleared`] = deleteField();
        }

        if (action.type === ACTION_TYPES.SAVE_NOTE) {
             partialUpdate[`${basePath}.note`] = dayDataCopy.note || "";
        } else if (action.type === ACTION_TYPES.ADD_SLOT && addSlotResult) {
             const { newTimeKey } = addSlotResult;
             partialUpdate[`${basePath}.${newTimeKey}`] = dayDataCopy[newTimeKey];
        } else if (action.type === ACTION_TYPES.UPDATE_ACTIVITY_TEXT) {
             const { timeKey, newText } = action.payload;
             // Ensure we update the whole slot object if it was just created (rare race) or just the text if it existed
             if (originalYearlyData[year]?.activities?.[dateKey]?.[timeKey]) {
                 partialUpdate[`${basePath}.${timeKey}.text`] = newText;
             } else {
                 partialUpdate[`${basePath}.${timeKey}`] = dayDataCopy[timeKey];
             }
        } else if (action.type === ACTION_TYPES.UPDATE_TIME) {
             const { oldTimeKey, newTimeKey } = action.payload;
             partialUpdate[`${basePath}.${oldTimeKey}`] = deleteField();
             partialUpdate[`${basePath}.${newTimeKey}`] = dayDataCopy[newTimeKey];
        }
    }

    const dataToSave = {
        yearlyData: updatedYearlyData,
        leaveTypes: state.leaveTypes,
        lastUpdated: timestamp
    };

    renderStorageUsage(calculateDataSize(dataToSave));

    // If migrating away from old structure, implicitly remove old field
    if (state.isOnlineMode && state.yearlyData.activities) {
        dataToSave.activities = deleteField();
        if (partialUpdate) partialUpdate['activities'] = deleteField();
    }

    if (partialUpdate) {
        partialUpdate.lastUpdated = timestamp;
    }

    try {
        await persistData(dataToSave, partialUpdate);
        if (successMessage) showMessage(successMessage, 'success');
    } catch (error) {
        Logger.error("Error persisting data:", error);
        showMessage(i18n.t("messages.saveRevertError"), 'error');
        const revertedCurrentYearData = originalYearlyData[year] || { activities: {}, leaveOverrides: {} };
        setState({ yearlyData: originalYearlyData, currentYearData: revertedCurrentYearData });
        updateView();
    }
}

export function loadDataFromLocalStorage() {
    try {
        const storedDataString = localStorage.getItem(LOCAL_STORAGE_KEYS.GUEST_USER_DATA);
        if (!storedDataString) {
            return { yearlyData: {}, leaveTypes: [] };
        }
        let data = JSON.parse(storedDataString);
        return data;

    } catch (error) {
        Logger.error("Error loading local data:", error);
        showMessage(i18n.t("admin.msgLoadLocalError"), 'error');
        return { yearlyData: {}, leaveTypes: [] };
    }
}

export function saveDataToLocalStorage(data) {
    try {
        renderStorageUsage(calculateDataSize(data));
        localStorage.setItem(LOCAL_STORAGE_KEYS.GUEST_USER_DATA, JSON.stringify(data));
    } catch (error) {
        Logger.error("Error saving local data:", error);
        showMessage(i18n.t("admin.msgSaveLocalError"), 'error');
    }
}

export async function saveDataToFirestore(data, partialUpdate = null) {
    if (!state.userId) return;

    if (partialUpdate) {
        try {
            await updateDoc(doc(db, COLLECTIONS.USERS, state.userId), partialUpdate);
            return;
        } catch (e) {
            // Fallback to full save if partial update fails (e.g. document doesn't exist)
            Logger.warn("Partial update failed, falling back to full merge:", e);
        }
    }
    await setDoc(doc(db, COLLECTIONS.USERS, state.userId), data, { merge: true });
}

export function loadOfflineData() {
    localStorage.setItem(LOCAL_STORAGE_KEYS.SESSION_MODE, 'offline');
    const data = loadDataFromLocalStorage(); // This now handles migration

    renderStorageUsage(calculateDataSize(data));

    const year = state.currentMonth.getFullYear();
    const yearlyData = data.yearlyData || {};
    const currentYearData = yearlyData[year] || { activities: {}, leaveOverrides: {} };

    setState({
        yearlyData: yearlyData,
        currentYearData: currentYearData,
        leaveTypes: data.leaveTypes || [],
        isOnlineMode: false,
        userId: null
    });
    setupTbUserMenu(null);
    // Switch directly to app view
    restoreLastView(DOM.loginView);
    DOM.navTogBtn.classList.remove('hidden');
}

export async function performTrackerReset() {
    // Safety check: Ensure we are NOT in Tog View when resetting APP_NAME
    if (DOM.togView && !DOM.togView.classList.contains('hidden')) {
        Logger.warn(`Attempted to reset ${APP_NAME} data while in Tog View. Aborting.`);
        return;
    }

    const button = DOM.confirmResetModal.querySelector('#confirm-reset-btn');
    setButtonLoadingState(button, true);
    await waitForDOMUpdate();

    // Define the reset state
    const resetState = {
        yearlyData: {},
        currentYearData: { activities: {}, leaveOverrides: {} },
        leaveTypes: []
    };

    if (state.isOnlineMode && state.userId) {
        try {
            // Only update specific fields, preserving everything else (like togData, teamId)
            const updates = {
                yearlyData: {},
                leaveTypes: []
            };

            await updateDoc(doc(db, COLLECTIONS.USERS, state.userId), updates);

            // This will trigger onSnapshot, which will update the local state.
            triggerTeamSync();
            showMessage(i18n.t("messages.cloudResetSuccess"), 'success');

        } catch (error) {
            Logger.error("Error resetting cloud data:", error);
            showMessage(i18n.t("messages.cloudResetError"), 'error');
        }
    } else {
        localStorage.removeItem(LOCAL_STORAGE_KEYS.GUEST_USER_DATA);
        setState(resetState);
        updateView();
        showMessage(i18n.t("messages.localResetSuccess"), 'success');
    }

    DOM.confirmResetModal.classList.remove('visible');
    setButtonLoadingState(button, false);
}

export async function updateActivityOrder() {
    const dateKey = getYYYYMMDD(state.selectedDate);
    const year = state.selectedDate.getFullYear();
    const updatedYearlyData = JSON.parse(JSON.stringify(state.yearlyData));

    if (!updatedYearlyData[year] || !updatedYearlyData[year].activities[dateKey]) {
        return;
    }

    const dayData = updatedYearlyData[year].activities[dateKey];
    const orderedTimeKeys = Array.from(DOM.dailyActivityTableBody.children).map(row => row.dataset.time);
    const newDayData = {};

    if (dayData.note) newDayData.note = dayData.note;
    if (dayData.leave) newDayData.leave = dayData.leave;
    if (dayData._userCleared) newDayData._userCleared = true;

    orderedTimeKeys.forEach((timeKey, index) => {
        const originalEntry = dayData[timeKey] || { text: '' };
        newDayData[timeKey] = { ...originalEntry, order: index };
    });

    updatedYearlyData[year].activities[dateKey] = newDayData;
    const currentYearData = updatedYearlyData[year];

    setState({ yearlyData: updatedYearlyData, currentYearData: currentYearData });

    try {
        const timestamp = Date.now();
        state.lastUpdated = timestamp;
        await persistData({ yearlyData: updatedYearlyData, leaveTypes: state.leaveTypes, lastUpdated: timestamp });
        showMessage(i18n.t("messages.activitiesReordered"), 'success');
    } catch (error) {
        Logger.error("Failed to reorder activities:", error);
        showMessage(i18n.t("messages.orderSaveError"), "error");
        // NOTE: Consider rolling back state on error
    }
}

export async function deleteActivity(dateKey, timeKey) {
    const timestamp = Date.now();
    state.lastUpdated = timestamp;

    const year = new Date(dateKey).getFullYear();
    const originalYearlyData = JSON.parse(JSON.stringify(state.yearlyData));
    const updatedYearlyData = JSON.parse(JSON.stringify(state.yearlyData));

    if (!updatedYearlyData[year] || !updatedYearlyData[year].activities[dateKey] || !updatedYearlyData[year].activities[dateKey][timeKey]) {
        return;
    }

    try {
        // Perform the deletion from the copied data
        delete updatedYearlyData[year].activities[dateKey][timeKey];

        const dayHasNoMoreActivities = Object.keys(updatedYearlyData[year].activities[dateKey]).filter(k => k !== '_userCleared' && k !== 'note' && k !== 'leave').length === 0;
        if (dayHasNoMoreActivities) {
            updatedYearlyData[year].activities[dateKey]._userCleared = true;
        }

        const currentYearData = updatedYearlyData[year];

        // Optimistic UI update
        setState({ yearlyData: updatedYearlyData, currentYearData: currentYearData });
        updateView();

        // Persist the changes
        if (state.isOnlineMode && state.userId) {
            const userDocRef = doc(db, "users", state.userId);
            const fieldPathToDelete = `yearlyData.${year}.activities.${dateKey}.${timeKey}`;
            const updates = {
                [fieldPathToDelete]: deleteField(),
                lastUpdated: timestamp
            };

            if (dayHasNoMoreActivities) {
                updates[`yearlyData.${year}.activities.${dateKey}._userCleared`] = true;
            }

            await updateDoc(userDocRef, updates);
        } else {
            saveDataToLocalStorage({ yearlyData: updatedYearlyData, leaveTypes: state.leaveTypes, lastUpdated: timestamp });
        }
        showMessage(i18n.t("messages.activityDeleted"), 'success');

    } catch (error) {
        Logger.error("Failed to delete activity:", error);
        showMessage(i18n.t("messages.deleteSaveError"), "error");
        // Rollback on error
        const currentYear = state.currentMonth.getFullYear();
        const rolledBackCurrentYearData = originalYearlyData[currentYear] || { activities: {}, leaveOverrides: {} };
        setState({ yearlyData: originalYearlyData, currentYearData: rolledBackCurrentYearData });
        updateView();
    }
}

export function escapeCsvField(field) {
    const fieldStr = String(field || '');
    if (/[",\n]/.test(fieldStr)) {
        return `"${fieldStr.replace(/"/g, '""')}"`;
    }
    return fieldStr;
}

export function downloadCSV() {
    const csvRows = [
        ["Type", "Detail1", "Detail2", "Detail3", "Detail4"] // Headers
    ];

    // Backup Leave Types and Leave Overrides
    state.leaveTypes.forEach(lt => {
        csvRows.push(["LEAVE_TYPE", lt.id, lt.name, lt.totalDays, lt.color]);
    });

    Object.keys(state.yearlyData).forEach(year => {
        const yearData = state.yearlyData[year];
        if (yearData.leaveOverrides) {
            Object.keys(yearData.leaveOverrides).forEach(leaveTypeId => {
                const overrideData = yearData.leaveOverrides[leaveTypeId] || {};
                if (overrideData.totalDays !== undefined || overrideData.hidden) {
                    csvRows.push([
                        "LEAVE_OVERRIDE",
                        year,
                        leaveTypeId,
                        overrideData.totalDays,
                        overrideData.hidden ? "TRUE" : "FALSE"
                    ]);
                }
            });
        }
    });

    // Get all date keys from all years and sort them
    const allDateKeys = Object.values(state.yearlyData)
        .filter(yearData => yearData.activities) // Guard against years with no activities object
        .flatMap(yearData => Object.keys(yearData.activities));
    const sortedDateKeys = [...new Set(allDateKeys)].sort();

    sortedDateKeys.forEach(dateKey => {
        const year = dateKey.substring(0, 4);
        const dayData = state.yearlyData[year]?.activities[dateKey];
        if (!dayData) return;

        // Backup Note, Leave, User Cleared Flag, and Activities for the day
        if (dayData.note) {
            csvRows.push(["NOTE", dateKey, dayData.note, "", ""]);
        }
        if (dayData.leave) {
            csvRows.push(["LEAVE", dateKey, dayData.leave.typeId, dayData.leave.dayType, ""]);
        }
        if (dayData._userCleared) {
            csvRows.push(["USER_CLEARED", dateKey, "", "", ""]);
        }
        const activities = Object.keys(dayData)
            .filter(key => key !== 'note' && key !== 'leave' && key !== '_userCleared')
            .map(timeKey => ({ time: timeKey, ...dayData[timeKey] }))
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        activities.forEach(activity => {
            if (activity.text?.trim()) {
                csvRows.push(["ACTIVITY", dateKey, activity.time, activity.text, activity.order]);
            }
        });
    });

    if (csvRows.length <= 1) {
        return showMessage(i18n.t("messages.noBackupData"), 'info');
    }

    const csvString = csvRows.map(row => row.map(escapeCsvField).join(",")).join("\n");

    const link = document.createElement("a");
    link.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvString);
    link.download = `${BACKUP_PREFIX}${getYYYYMMDD(new Date())}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

export function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const csvContent = e.target.result;

            const yearlyDataCopy = JSON.parse(JSON.stringify(state.yearlyData));
            const leaveTypesMap = new Map(state.leaveTypes.map(lt => [lt.id, { ...lt }]));

            const Papa = (await import('papaparse')).default;
            const parsed = Papa.parse(csvContent, {
                skipEmptyLines: true
            });

            const rows = parsed.data;

            if (rows.length <= 1) {
                return showMessage(i18n.t("messages.emptyCSV"), 'error');
            }

            let processedRows = 0;
            // Skip the header row
            rows.slice(1).forEach(row => {
                if (row.length < 2) return;

                const [type, detail1, detail2, detail3, detail4] = row;
                let rowProcessed = false;
                // Trim potential whitespace from the type
                const recordType = (type || '').trim().toUpperCase();

                switch (recordType) {
                    case 'LEAVE_TYPE':
                        if (detail1 && detail2 && detail3 !== undefined && detail4) {
                            leaveTypesMap.set(detail1, {
                                id: detail1,
                                name: detail2,
                                totalDays: parseFloat(detail3) || 0,
                                color: detail4
                            });
                            rowProcessed = true;
                        }
                        break;

                    case 'LEAVE_OVERRIDE':
                        const year = detail1;
                        const leaveTypeId = detail2;
                        const totalDays = parseFloat(detail3);
                        if (year && leaveTypeId && !isNaN(totalDays)) {
                            if (!yearlyDataCopy[year]) yearlyDataCopy[year] = { activities: {}, leaveOverrides: {} };
                            if (!yearlyDataCopy[year].leaveOverrides) yearlyDataCopy[year].leaveOverrides = {};
                            yearlyDataCopy[year].leaveOverrides[leaveTypeId] = { totalDays };
                            rowProcessed = true;
                        }
                        break;

                    case 'NOTE':
                    case 'LEAVE':
                    case 'ACTIVITY':
                    case 'USER_CLEARED':
                        const dateKey = detail1;
                        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
                            Logger.warn(`Skipping row with invalid date format: ${dateKey}`);
                            return;
                        }
                        const activityYear = dateKey.substring(0, 4);

                        if (!yearlyDataCopy[activityYear]) yearlyDataCopy[activityYear] = { activities: {}, leaveOverrides: {} };
                        if (!yearlyDataCopy[activityYear].activities[dateKey]) yearlyDataCopy[activityYear].activities[dateKey] = {};

                        const dayData = yearlyDataCopy[activityYear].activities[dateKey];

                        if (recordType === 'NOTE') {
                            dayData.note = detail2;
                            rowProcessed = true;
                        } else if (recordType === 'LEAVE') {
                            dayData.leave = { typeId: detail2, dayType: detail3 || 'full' };
                            rowProcessed = true;
                        } else if (recordType === 'ACTIVITY') {
                            const time = detail2;
                            if (time) {
                                dayData[time] = { text: detail3 || "", order: isNaN(parseInt(detail4, 10)) ? 0 : parseInt(detail4, 10) };
                                rowProcessed = true;
                            }
                        } else if (recordType === 'USER_CLEARED') {
                            dayData._userCleared = true;
                            rowProcessed = true;
                        }
                        break;
                }
                if (rowProcessed) processedRows++;
            });

            const finalLeaveTypes = Array.from(leaveTypesMap.values());
            const currentYear = state.currentMonth.getFullYear();
            const newCurrentYearData = yearlyDataCopy[currentYear] || { activities: {}, leaveOverrides: {} };

            setState({
                leaveTypes: finalLeaveTypes,
                yearlyData: yearlyDataCopy,
                currentYearData: newCurrentYearData
            });

            await persistData({
                yearlyData: yearlyDataCopy,
                leaveTypes: finalLeaveTypes
            });
            triggerTeamSync();

            showMessage(i18n.t("messages.restoreSuccess").replace('{count}', processedRows), 'success');
            event.target.value = '';
            updateView();
        } catch (err) {
            Logger.error("Error during CSV restore:", err);
            showMessage(i18n.t("messages.restoreError"), 'error');
        }
    };
    reader.onerror = () => showMessage(i18n.t("messages.readError"), 'error');
    reader.readAsText(file);
}

export function mergeUserData(cloudState, guestData) {
    const mergedYearlyData = JSON.parse(JSON.stringify(cloudState.yearlyData || {}));
    const mergedLeaveTypes = [...(cloudState.leaveTypes || [])];
    const cloudLeaveTypeIds = new Set(mergedLeaveTypes.map(lt => lt.id));

    if (guestData.leaveTypes) {
        guestData.leaveTypes.forEach(lt => {
            if (!cloudLeaveTypeIds.has(lt.id)) {
                mergedLeaveTypes.push(lt);
                cloudLeaveTypeIds.add(lt.id);
            }
        });
    }

    if (guestData.yearlyData) {
        Object.keys(guestData.yearlyData).forEach(year => {
            if (!mergedYearlyData[year]) {
                mergedYearlyData[year] = guestData.yearlyData[year];
            } else {
                const cloudYear = mergedYearlyData[year];
                const guestYear = guestData.yearlyData[year];

                if (guestYear.leaveOverrides) {
                    if (!cloudYear.leaveOverrides) cloudYear.leaveOverrides = {};
                    Object.keys(guestYear.leaveOverrides).forEach(ltId => {
                        if (!cloudYear.leaveOverrides[ltId]) {
                            cloudYear.leaveOverrides[ltId] = guestYear.leaveOverrides[ltId];
                        }
                    });
                }

                if (guestYear.activities) {
                    if (!cloudYear.activities) cloudYear.activities = {};
                    Object.keys(guestYear.activities).forEach(dateKey => {
                        const guestDay = guestYear.activities[dateKey];
                        const cloudDay = cloudYear.activities[dateKey];

                        if (!cloudDay || Object.keys(cloudDay).length === 0) {
                            cloudYear.activities[dateKey] = guestDay;
                        } else {
                            if (!cloudDay.note && guestDay.note) cloudDay.note = guestDay.note;
                            if (!cloudDay.leave && guestDay.leave) cloudDay.leave = guestDay.leave;
                            if (cloudDay._userCleared === undefined && guestDay._userCleared !== undefined) {
                                cloudDay._userCleared = guestDay._userCleared;
                            }
                            Object.keys(guestDay).forEach(key => {
                                if (key !== 'note' && key !== 'leave' && key !== '_userCleared') {
                                    if (!cloudDay[key]) {
                                        cloudDay[key] = guestDay[key];
                                    }
                                }
                            });
                        }
                    });
                }
            }
        });
    }

    return {
        yearlyData: mergedYearlyData,
        leaveTypes: mergedLeaveTypes
    };
}

export function calculateDataSize(data) {
    try {
        const json = JSON.stringify(data);
        return new Blob([json]).size;
    } catch (e) {
        return 0;
    }
}

export function formatBytes(bytes, decimals = 1) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
