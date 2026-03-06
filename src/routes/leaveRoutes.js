import { db, doc, updateDoc, writeBatch, deleteField } from '../config/firebase.js';
import { COLLECTIONS } from '../config/constants.js';
import { state, setState, DOM, i18n } from '../../app.js';
import { showMessage, setButtonLoadingState, updateView, waitForDOMUpdate } from './uiRoutes.js';
import { triggerTeamSync } from './teamRoutes.js';
import { persistData, saveDataToFirestore, saveDataToLocalStorage } from './dataRoutes.js';
import { Logger } from '../utils/logger.js';
import { sanitizeHTML, formatDateForDisplay } from '../utils/utils.js';
import { LEAVE_DAY_TYPES, COLOR_MAP } from '../config/constants.js';
import { html, render } from 'lit-html';

export function getVisibleLeaveTypesForYear(year) {
    const yearData = state.yearlyData[year] || {};
    const overrides = yearData.leaveOverrides || {};
    return state.leaveTypes.filter(lt => {
        if (overrides[lt.id]?.hidden) return false;
        if (lt.limitYear && lt.limitYear !== year) return false;
        return true;
    });
}

export function openLeaveTypeModal(leaveType = null) {
    state.previousActiveElement = document.activeElement;
    DOM.leaveTypeModal.classList.add('visible');
    if (leaveType) {
        const year = state.currentMonth.getFullYear();
        const yearData = state.yearlyData[year] || {};
        const overrides = yearData.leaveOverrides || {};
        const totalDays = overrides[leaveType.id]?.totalDays ?? leaveType.totalDays;

        DOM.leaveTypeModalTitle.dataset.i18n = 'editLeaveType';
        DOM.leaveTypeModalTitle.innerHTML = i18n.t('tracker.editLeaveType');
        DOM.editingLeaveTypeId.value = leaveType.id;
        DOM.leaveNameInput.value = leaveType.name;
        DOM.leaveDaysInput.value = totalDays;
        selectColorInPicker(leaveType.color);
        // By default, changes are year-specific. User must click "Apply to all years" to make global changes.
        DOM.limitLeaveToYearBtn.dataset.limited = 'false';
        DOM.deleteLeaveTypeBtn.classList.remove('hidden');
    } else {
        DOM.leaveTypeModalTitle.dataset.i18n = 'addNewLeaveType';
        DOM.leaveTypeModalTitle.innerHTML = i18n.t('tracker.addNewLeaveType');
        DOM.editingLeaveTypeId.value = '';
        DOM.leaveNameInput.value = '';
        DOM.leaveDaysInput.value = '';
        selectColorInPicker(null);
        // By default, creating a leave type is year-specific.
        DOM.limitLeaveToYearBtn.dataset.limited = 'false';
        DOM.deleteLeaveTypeBtn.classList.add('hidden');
    }
    DOM.leaveNameInput.focus();
}

export function closeLeaveTypeModal() {
    DOM.leaveTypeModal.classList.remove('visible');
    if (state.previousActiveElement) {
        state.previousActiveElement.focus();
        state.previousActiveElement = null;
    }
}

export function setupColorPicker() {
    const colors = Object.keys(COLOR_MAP);
    DOM.leaveColorPicker.innerHTML = colors.map(color => `
        <button type="button" data-color="${color}" aria-label="${i18n.t('colors.' + COLOR_MAP[color].toLowerCase())}" style="background-color: ${color};" class="w-10 h-10 rounded-full border-2 border-transparent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"></button>
    `).join('');
}

export function selectColorInPicker(color) {
    DOM.leaveColorPicker.querySelectorAll('button').forEach(btn => {
        if (btn.dataset.color === color) {
            btn.classList.add('ring-2', 'ring-offset-2', 'ring-blue-500');
        } else {
            btn.classList.remove('ring-2', 'ring-offset-2', 'ring-blue-500');
        }
    });
}

export async function saveLeaveType() {
    const button = DOM.leaveTypeModal.querySelector('#save-leave-type-btn');
    setButtonLoadingState(button, true);
    await waitForDOMUpdate();

    const id = DOM.editingLeaveTypeId.value || `lt_${new Date().getTime()}`;
    const name = DOM.leaveNameInput.value.trim();
    const totalDays = parseFloat(DOM.leaveDaysInput.value);
    const applyToAllYears = DOM.limitLeaveToYearBtn.dataset.limited === 'true'; // UI toggle means 'Apply to all years' now
    const selectedColorEl = DOM.leaveColorPicker.querySelector('.ring-blue-500');
    const color = selectedColorEl ? selectedColorEl.dataset.color : null;

    if (!name || isNaN(totalDays) || !color) {
        showMessage(i18n.t("tracker.msgLeaveTypeFieldsRequired"), 'error');
        setButtonLoadingState(button, false);
        return;
    }

    const currentYear = state.currentMonth.getFullYear();
    const visibleLeaveTypes = getVisibleLeaveTypesForYear(currentYear);
    const isColorTaken = visibleLeaveTypes.some(lt => lt.color === color && lt.id !== id);
    if (isColorTaken) {
        showMessage(i18n.t("tracker.msgLeaveTypeColorConflict"), 'error');
        setButtonLoadingState(button, false);
        return;
    }

    const newLeaveTypes = [...state.leaveTypes];
    const updatedYearlyData = JSON.parse(JSON.stringify(state.yearlyData));
    const existingIndex = newLeaveTypes.findIndex(lt => lt.id === id);

    if (existingIndex > -1) {
        // Editing existing leave type
        const globalLeaveType = newLeaveTypes[existingIndex];

        // Name and Color are always updated globally in this architecture
        globalLeaveType.name = name;
        globalLeaveType.color = color;

        if (applyToAllYears) {
            // Remove limitYear property if it exists to make it global
            if (globalLeaveType.limitYear) {
                delete globalLeaveType.limitYear;
            }

            // Apply changes to totalDays globally
            globalLeaveType.totalDays = totalDays;

            // Since it's applied globally, remove all year-specific totalDays overrides for this leave type
            Object.keys(updatedYearlyData).forEach(y => {
                if (updatedYearlyData[y].leaveOverrides && updatedYearlyData[y].leaveOverrides[id]) {
                    delete updatedYearlyData[y].leaveOverrides[id].totalDays;
                    // If override object is empty (and not hidden), clean it up
                    if (Object.keys(updatedYearlyData[y].leaveOverrides[id]).length === 0) {
                        delete updatedYearlyData[y].leaveOverrides[id];
                    }
                }
            });
        } else {
            // Default logic: Changes apply to current year only
            if (!updatedYearlyData[currentYear]) {
                updatedYearlyData[currentYear] = { activities: {}, leaveOverrides: {} };
            }
            if (!updatedYearlyData[currentYear].leaveOverrides) {
                updatedYearlyData[currentYear].leaveOverrides = {};
            }
            if (!updatedYearlyData[currentYear].leaveOverrides[id]) {
                updatedYearlyData[currentYear].leaveOverrides[id] = {};
            }

            // Set override for this year specifically
            updatedYearlyData[currentYear].leaveOverrides[id].totalDays = totalDays;
        }
    } else {
        // Adding a new leave type
        // In this app architecture, leave types must exist globally to be tracked properly.
        const newLeaveType = { id, name, totalDays, color };

        if (!applyToAllYears) {
            // Created for this year specifically. Limit it to this year so it doesn't appear in other years.
            newLeaveType.limitYear = currentYear;

            if (!updatedYearlyData[currentYear]) {
                updatedYearlyData[currentYear] = { activities: {}, leaveOverrides: {} };
            }
            if (!updatedYearlyData[currentYear].leaveOverrides) {
                updatedYearlyData[currentYear].leaveOverrides = {};
            }
            if (!updatedYearlyData[currentYear].leaveOverrides[id]) {
                updatedYearlyData[currentYear].leaveOverrides[id] = {};
            }

            updatedYearlyData[currentYear].leaveOverrides[id].totalDays = totalDays;
        }

        newLeaveTypes.push(newLeaveType);
    }

    // Optimistically update state
    const currentYearData = updatedYearlyData[currentYear] || { activities: {}, leaveOverrides: {} };
    setState({
        leaveTypes: newLeaveTypes,
        yearlyData: updatedYearlyData,
        currentYearData: currentYearData
    });

    // Persist changes
    try {
        const timestamp = Date.now();
        state.lastUpdated = timestamp;

        // Use granular update if possible
        if (state.isOnlineMode && state.userId) {
            const updates = {};
            const leaveTypesUpdate = { leaveTypes: newLeaveTypes };

            // Construct granular updates for leaveOverrides
            if (updatedYearlyData[currentYear]?.leaveOverrides) {
               updates[`yearlyData.${currentYear}.leaveOverrides`] = updatedYearlyData[currentYear].leaveOverrides;
            }

            const dataToSave = {
                leaveTypes: newLeaveTypes,
                lastUpdated: timestamp
            };

            if (updatedYearlyData[currentYear]) {
                dataToSave.yearlyData = {
                    [currentYear]: {
                        leaveOverrides: updatedYearlyData[currentYear].leaveOverrides || {}
                    }
                };
            }

            // We use setDoc with merge: true, which is fine for leaveTypes (array replacement)
            // and fine for leaveOverrides (map merge).
            // Crucially, we are NOT including 'activities' in dataToSave, so concurrent activity edits are safe.
            await saveDataToFirestore(dataToSave);
        } else {
            saveDataToLocalStorage({
                yearlyData: updatedYearlyData,
                leaveTypes: newLeaveTypes,
                lastUpdated: timestamp
            });
        }

        triggerTeamSync();
        showMessage(i18n.t("tracker.msgLeaveTypeSaved"), 'success');
    } catch (error) {
        Logger.error("Failed to save leave type:", error);
        showMessage(i18n.t("tracker.msgLeaveTypeSaveFailed"), 'error');
        // NOTE: Consider rolling back state
    } finally {
        closeLeaveTypeModal();
        updateView();
        setButtonLoadingState(button, false);
    }
}

export async function deleteLeaveType() {
    const id = DOM.editingLeaveTypeId.value;
    if (!id) return;

    const applyToAllYears = DOM.limitLeaveToYearBtn.dataset.limited === 'true'; // Checked means "Apply to all years"
    const timestamp = Date.now();
    state.lastUpdated = timestamp;

    if (!applyToAllYears) {
        // --- SCENARIO A: Limit to Current Year (Hide Only) ---
        const currentYear = state.currentMonth.getFullYear();
        const updatedYearlyData = JSON.parse(JSON.stringify(state.yearlyData));

        if (!updatedYearlyData[currentYear]) {
            updatedYearlyData[currentYear] = { activities: {}, leaveOverrides: {} };
        }
        if (!updatedYearlyData[currentYear].leaveOverrides) {
            updatedYearlyData[currentYear].leaveOverrides = {};
        }

        // Mark as hidden for this year
        updatedYearlyData[currentYear].leaveOverrides[id] = {
            ...(updatedYearlyData[currentYear].leaveOverrides[id] || {}),
            hidden: true
        };

        // Remove leaves for this year only
        const yearActivities = updatedYearlyData[currentYear].activities || {};
        Object.keys(yearActivities).forEach(dateKey => {
            if (yearActivities[dateKey].leave?.typeId === id) {
                delete yearActivities[dateKey].leave;
            }
        });

        // Capture original data for persistence logic before state update
        const originalYearlyDataForPersistence = state.yearlyData;

        const currentYearData = updatedYearlyData[currentYear];
        setState({
            yearlyData: updatedYearlyData,
            currentYearData: currentYearData
        });

        try {
            if (state.isOnlineMode && state.userId) {
                const batch = writeBatch(db);
                const userDocRef = doc(db, "users", state.userId);

                batch.update(userDocRef, {
                    [`yearlyData.${currentYear}.leaveOverrides.${id}.hidden`]: true,
                    lastUpdated: timestamp
                });

                const originalYearActivities = originalYearlyDataForPersistence[currentYear]?.activities || {};
                Object.keys(originalYearActivities).forEach(dateKey => {
                    if (originalYearActivities[dateKey].leave?.typeId === id) {
                        batch.update(userDocRef, {
                            [`yearlyData.${currentYear}.activities.${dateKey}.leave`]: deleteField()
                        });
                    }
                });
                await batch.commit();
            } else {
                saveDataToLocalStorage({
                    yearlyData: updatedYearlyData,
                    leaveTypes: state.leaveTypes,
                    lastUpdated: timestamp
                });
            }
            triggerTeamSync();
            showMessage(i18n.t("tracker.msgLeaveTypeHidden").replace('{year}', currentYear), 'success');
        } catch (error) {
            Logger.error("Failed to hide leave type:", error);
            showMessage(i18n.t("tracker.msgLeaveTypeHideFailed"), 'error');
        }

    } else {
        // --- SCENARIO B: Universal Delete (Remove Global & All Entries) ---
        // 1. Remove from Global Leave Types
        const newLeaveTypes = state.leaveTypes.filter(lt => lt.id !== id);

        // 2. Remove from All Yearly Data (Overrides & Entries)
        const updatedYearlyData = JSON.parse(JSON.stringify(state.yearlyData));

        Object.keys(updatedYearlyData).forEach(year => {
            const yearData = updatedYearlyData[year];

            // Remove Overrides
            if (yearData.leaveOverrides && yearData.leaveOverrides[id]) {
                delete yearData.leaveOverrides[id];
            }

            // Remove Entries
            if (yearData.activities) {
                Object.keys(yearData.activities).forEach(dateKey => {
                    if (yearData.activities[dateKey].leave?.typeId === id) {
                        delete yearData.activities[dateKey].leave;
                    }
                });
            }
        });

        // Capture original data for persistence logic before state update
        const originalYearlyDataForPersistence = state.yearlyData;

        const currentYear = state.currentMonth.getFullYear();
        const currentYearData = updatedYearlyData[currentYear] || { activities: {}, leaveOverrides: {} };

        setState({
            leaveTypes: newLeaveTypes,
            yearlyData: updatedYearlyData,
            currentYearData: currentYearData
        });

        try {
            if (state.isOnlineMode && state.userId) {
                // For global delete, it's safer to overwrite the document structure or use a massive batch
                // But since we are removing a type and potentially many entries across years,
                // a full set/rewrite might be cleaner if the data isn't huge.
                // However, let's try to be efficient.

                // We need to:
                // 1. Update leaveTypes array
                // 2. Remove the override key from every year
                // 3. Remove the leave field from every activity in every year

                // If we use saveLeaveType logic, we just pass the new state.
                // persistData handles `set({ ... }, { merge: true })`.
                // If we pass the new leaveTypes array, it replaces the old one. Good.
                // If we pass updatedYearlyData, it merges.
                // PROBLEM: `merge: true` won't delete keys (overrides/activities) that are missing in the input!
                // To actually DELETE fields in Firestore via merge, we need `deleteField()`.

                const batch = writeBatch(db);
                const userDocRef = doc(db, "users", state.userId);

                // 1. Update Leave Types
                batch.update(userDocRef, {
                    leaveTypes: newLeaveTypes,
                    lastUpdated: timestamp
                });

                // 2. Delete Overrides & Activities recursively
                // We iterate the *original* state to find what to delete
                Object.keys(originalYearlyDataForPersistence).forEach(year => {
                    const yearData = originalYearlyDataForPersistence[year];

                    // Delete Override if exists
                    if (yearData.leaveOverrides && yearData.leaveOverrides[id]) {
                        batch.update(userDocRef, {
                            [`yearlyData.${year}.leaveOverrides.${id}`]: deleteField()
                        });
                    }

                    // Delete Activities
                    if (yearData.activities) {
                        Object.keys(yearData.activities).forEach(dateKey => {
                            if (yearData.activities[dateKey].leave?.typeId === id) {
                                batch.update(userDocRef, {
                                    [`yearlyData.${year}.activities.${dateKey}.leave`]: deleteField()
                                });
                            }
                        });
                    }
                });

                await batch.commit();
            } else {
                saveDataToLocalStorage({
                    yearlyData: updatedYearlyData,
                    leaveTypes: newLeaveTypes,
                    lastUpdated: timestamp
                });
            }
            triggerTeamSync();
            showMessage(i18n.t("tracker.msgLeaveTypeDeleted"), 'success');
        } catch (error) {
            Logger.error("Failed to delete leave type globally:", error);
            showMessage(i18n.t("tracker.msgLeaveTypeDeleteFailed"), 'error');
        }
    }

    closeLeaveTypeModal();
    updateView();
}

export async function saveLeaveTypes() {
    const timestamp = Date.now();
    state.lastUpdated = timestamp;
    // Pass the entire state's yearlyData and leaveTypes to be persisted
    await persistData({ yearlyData: state.yearlyData, leaveTypes: state.leaveTypes, lastUpdated: timestamp });
    triggerTeamSync();
    if (!state.isOnlineMode) {
        updateView();
    }
    showMessage(i18n.t("tracker.msgLeaveTypesReordered"), 'success');
}

export async function moveLeaveType(typeId, direction) {
    const newLeaveTypes = [...state.leaveTypes];
    const index = newLeaveTypes.findIndex(lt => lt.id === typeId);

    if (index === -1) return;

    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= newLeaveTypes.length) return;

    [newLeaveTypes[index], newLeaveTypes[newIndex]] = [newLeaveTypes[newIndex], newLeaveTypes[index]];

    setState({ leaveTypes: newLeaveTypes });
    await saveLeaveTypes();
}

export function renderLeavePills() {
    const year = state.currentMonth.getFullYear();
    const visibleLeaveTypes = getVisibleLeaveTypesForYear(year);

    const pills = visibleLeaveTypes.map(lt => {
        const isSelected = state.selectedLeaveTypeId === lt.id;
        const classes = `flex-shrink-0 truncate max-w-40 px-3 py-1.5 rounded-full text-sm font-semibold text-white shadow transition-transform transform hover:scale-105 ${isSelected ? 'ring-4 ring-offset-2 ring-blue-400 scale-105' : ''}`;

        return html`
        <button class="${classes}"
                style="background-color: ${lt.color};"
                data-id="${lt.id}">
            ${lt.name}
        </button>`;
    });

    render(html`${pills}`, DOM.leavePillsContainer);
}

export function calculateLeaveBalances() {
    const balances = {};
    const leaveCounts = {};
    const year = state.currentMonth.getFullYear();
    const visibleLeaveTypes = getVisibleLeaveTypesForYear(year);
    const currentActivities = state.currentYearData.activities || {};

    visibleLeaveTypes.forEach(lt => {
        leaveCounts[lt.id] = 0;
    });

    Object.values(currentActivities).forEach(dayData => {
        if (dayData.leave) {
            const leaveValue = dayData.leave.dayType === LEAVE_DAY_TYPES.HALF ? 0.5 : 1;
            if (leaveCounts.hasOwnProperty(dayData.leave.typeId)) {
                leaveCounts[dayData.leave.typeId] += leaveValue;
            }
        }
    });

    const yearData = state.yearlyData[year] || {};
    const overrides = yearData.leaveOverrides || {};

    visibleLeaveTypes.forEach(lt => {
        const totalDays = overrides[lt.id]?.totalDays ?? lt.totalDays;
        balances[lt.id] = totalDays - (leaveCounts[lt.id] || 0);
    });

    return balances;
}

export function openLeaveOverviewModal(leaveTypeId) {
    setState({ overviewLeaveTypeId: leaveTypeId });
    const year = state.currentMonth.getFullYear();
    const visibleLeaveTypes = getVisibleLeaveTypesForYear(year);
    const leaveType = visibleLeaveTypes.find(lt => lt.id === leaveTypeId);
    if (!leaveType) return;

    DOM.overviewLeaveTypeName.textContent = leaveType.name;
    DOM.overviewLeaveTypeName.title = leaveType.name;
    DOM.overviewLeaveTypeName.style.color = leaveType.color;

    const currentActivities = state.currentYearData.activities || {};
    const leaveDates = [];

    Object.keys(currentActivities).forEach(dateKey => {
        const dayData = currentActivities[dateKey];
        if (dayData.leave && dayData.leave.typeId === leaveTypeId) {
            leaveDates.push({
                date: dateKey,
                dayType: dayData.leave.dayType,
                formatted: formatDateForDisplay(dateKey, i18n.currentLang)
            });
        }
    });

    leaveDates.sort((a, b) => new Date(a.date) - new Date(b.date));

    renderLeaveOverviewList(leaveDates, leaveType);
    DOM.leaveOverviewModal.classList.add('visible');
}

export function closeLeaveOverviewModal() {
    DOM.leaveOverviewModal.classList.remove('visible');
}

export function renderLeaveOverviewList(leaveDates, leaveType) {
    DOM.overviewLeaveDaysList.innerHTML = '';

    if (leaveDates.length === 0) {
        DOM.overviewNoLeavesMessage.classList.remove('hidden');
        return;
    }

    DOM.overviewNoLeavesMessage.classList.add('hidden');

    leaveDates.forEach(leaveDate => {
        const item = document.createElement('div');
        item.className = 'leave-overview-item flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors gap-y-2';
        item.dataset.dateKey = leaveDate.date;

        item.innerHTML = `
            <div class="flex items-center gap-3 w-full sm:w-auto min-w-0">
                <div class="w-4 h-4 rounded-full flex-shrink-0" style="background-color: ${leaveType.color};"></div>
                <div class="flex-grow min-w-0">
                    <span class="font-medium truncate" title="${leaveDate.formatted}">${leaveDate.formatted}</span>
                </div>
            </div>
            <div class="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end mt-2 sm:mt-0">
                <div class="day-type-toggle relative flex w-28 h-8 items-center rounded-full bg-gray-200 p-1 cursor-pointer flex-shrink-0" data-selected-value="${leaveDate.dayType}">
                    <div class="toggle-bg absolute top-1 h-6 w-[calc(50%-0.25rem)] rounded-full bg-blue-500 shadow-md transition-transform duration-300 ease-in-out"></div>
                    <button type="button" class="toggle-btn relative z-10 w-1/2 h-full text-center text-xs font-semibold ${leaveDate.dayType === 'full' ? 'active' : ''}" data-value="full" data-i18n="tracker.full">${i18n.t('tracker.full')}</button>
                    <button type="button" class="toggle-btn relative z-10 w-1/2 h-full text-center text-xs font-semibold ${leaveDate.dayType === 'half' ? 'active' : ''}" data-value="half" data-i18n="tracker.half">${i18n.t('tracker.half')}</button>
                </div>
                <div class="flex items-center gap-1 flex-shrink-0">
                    <button class="edit-leave-day-btn icon-btn" title="Edit this leave entry">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z"></path></svg>
                    </button>
                    <button class="delete-leave-day-btn icon-btn text-red-500 hover:text-red-700 dark:text-red-500 dark:hover:text-red-700" title="Delete this leave entry">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </div>
            </div>
        `;

        DOM.overviewLeaveDaysList.appendChild(item);
    });
}

export async function editLeaveDay(dateKey) {
    // Close the overview modal
    closeLeaveOverviewModal();

    // Set up the customization modal with just this one day
    setState({
        leaveSelection: new Set([dateKey]),
        initialLeaveSelection: new Set([dateKey]),
        selectedLeaveTypeId: null
    });

    // Open the customization modal
    openLeaveCustomizationModal();
}

export async function deleteLeaveDay(dateKey) {
    const year = new Date(dateKey).getFullYear();
    const updatedYearlyData = JSON.parse(JSON.stringify(state.yearlyData));

    if (!updatedYearlyData[year] || !updatedYearlyData[year].activities || !updatedYearlyData[year].activities[dateKey] || !updatedYearlyData[year].activities[dateKey].leave) {
        return;
    }

    const originalLeaveTypeId = updatedYearlyData[year].activities[dateKey].leave.typeId;

    delete updatedYearlyData[year].activities[dateKey].leave;

    const currentYear = state.currentMonth.getFullYear();
    const currentYearData = updatedYearlyData[currentYear] || { activities: {}, leaveOverrides: {} };

    setState({
        yearlyData: updatedYearlyData,
        currentYearData: currentYearData
    });

    try {
        const timestamp = Date.now();
        state.lastUpdated = timestamp;

        const partialUpdate = {
            [`yearlyData.${year}.activities.${dateKey}.leave`]: deleteField(),
            lastUpdated: timestamp
        };

        await persistData({ yearlyData: updatedYearlyData, leaveTypes: state.leaveTypes, lastUpdated: timestamp }, partialUpdate);
        triggerTeamSync();
        showMessage(i18n.t("tracker.msgLeaveEntryDeleted"), 'success');
    } catch (error) {
        Logger.error("Failed to delete leave day:", error);
        showMessage(i18n.t("messages.deleteSaveError"), "error");
        // NOTE: A robust implementation might roll back the state change here.
    }

    // If the overview modal for the affected leave type is open, refresh it.
    if (DOM.leaveOverviewModal.classList.contains('visible')) {
        requestAnimationFrame(() => openLeaveOverviewModal(originalLeaveTypeId));
    }

    updateView();
}

export function renderLeaveStats() {
    const year = state.currentMonth.getFullYear();
    const visibleLeaveTypes = getVisibleLeaveTypesForYear(year);

    if (visibleLeaveTypes.length === 0) {
        render(html`<p class="text-center text-gray-500">${i18n.t('tracker.noLeaveTypesDefined')}</p>`, DOM.leaveStatsSection);
        return;
    }

    const balances = calculateLeaveBalances();
    const yearData = state.yearlyData[year] || {};
    const overrides = yearData.leaveOverrides || {};

    const stats = visibleLeaveTypes.map((lt, index) => {
        const totalDays = overrides[lt.id]?.totalDays ?? lt.totalDays;
        const calculatedBalance = balances[lt.id] !== undefined ? balances[lt.id] : totalDays;
        const calculatedUsed = totalDays - calculatedBalance;

        const used = parseFloat(calculatedUsed.toFixed(2));
        const balance = parseFloat(calculatedBalance.toFixed(2));
        const percentage = totalDays > 0 ? Math.min(100, Math.max(0, (used / totalDays) * 100)) : 0;
        const isFirst = index === 0;
        const isLast = index === visibleLeaveTypes.length - 1;

        // Use arrow functions in event listeners to capture 'lt'
        return html`
            <div class="bg-white p-3 sm:p-4 rounded-lg shadow relative border-2" style="border-color: ${lt.color};">
                <div class="flex justify-between items-start">
                    <div class="flex items-center min-w-0 pr-2">
                        <h4 class="font-bold text-base sm:text-lg truncate min-w-0 me-2" style="color: ${lt.color};" title="${lt.name}">${lt.name}</h4>
                    </div>

                    <div class="flex items-center -mt-2 -me-2 flex-shrink-0">
                        <button class="info-leave-btn icon-btn text-gray-400 hover:text-blue-500 transition-colors flex-shrink-0" data-id="${lt.id}" title="${i18n.t('tracker.viewLeaveDetails')}" aria-label="${i18n.t('tracker.viewLeaveDetails')} for ${lt.name}" @click=${() => openLeaveOverviewModal(lt.id)}>
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                        </button>
                        <button class="move-leave-btn icon-btn" data-id="${lt.id}" data-direction="-1" title="${i18n.t('tracker.moveUp')}" aria-label="${i18n.t('tracker.moveUp')} ${lt.name}" ?disabled=${isFirst} @click=${() => moveLeaveType(lt.id, -1)}>
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path></svg>
                        </button>
                        <button class="move-leave-btn icon-btn" data-id="${lt.id}" data-direction="1" title="${i18n.t('tracker.moveDown')}" aria-label="${i18n.t('tracker.moveDown')} ${lt.name}" ?disabled=${isLast} @click=${() => moveLeaveType(lt.id, 1)}>
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                        </button>
                        <button class="edit-leave-type-btn icon-btn" data-id="${lt.id}" title="${i18n.t('common.edit')}" aria-label="${i18n.t('common.edit')} ${lt.name}" @click=${() => openLeaveTypeModal(lt)}>
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z"></path></svg>
                        </button>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-1 sm:gap-2 mt-1 sm:mt-2 text-center">
                    <div class="bg-gray-100 p-1 sm:p-2 rounded">
                        <p class="text-xs text-gray-500">${i18n.t('tracker.used')}</p>
                        <p class="font-bold text-base sm:text-xl text-gray-800">${used}</p>
                    </div>
                    <div class="p-1 sm:p-2 rounded balance-box">
                        <p class="text-xs stats-label">${i18n.t('tracker.balance')}</p>
                        <p class="font-bold text-base sm:text-xl stats-value">${balance}</p>
                    </div>
                </div>
                <div class="bg-gray-100 p-1 sm:p-2 rounded mt-1 sm:mt-2 text-center">
                    <p class="text-xs text-gray-500">${i18n.t('tracker.total')}</p>
                    <p class="font-bold text-base sm:text-xl text-gray-800">${totalDays}</p>
                    <div class="progress-bg h-1.5 sm:h-2 mt-2 bg-gray-200 rounded-full overflow-hidden">
                        <div class="progress-bar h-1.5 sm:h-2 rounded-full transition-all duration-500" style="width: ${percentage}%; background-color: ${lt.color};"></div>
                    </div>
                </div>
            </div>
        `;
    });

    render(html`<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">${stats}</div>`, DOM.leaveStatsSection);
}

export function openLeaveCustomizationModal() {
    if (state.leaveSelection.size === 0) {
        showMessage(i18n.t("tracker.msgSelectDayRequired"), 'info');
        return;
    }
    state.previousActiveElement = document.activeElement;
    setState({ initialLeaveSelection: new Set(state.leaveSelection) });
    DOM.customizeLeaveModal.classList.add('visible');
    renderLeaveCustomizationModal();
    // Focus first interactive element
    const firstButton = DOM.customizeLeaveModal.querySelector('button, input, select');
    if (firstButton) firstButton.focus();
}

export function createLeaveTypeSelector(container, currentTypeId, onTypeChangeCallback) {
    const year = state.currentMonth.getFullYear();
    const visibleLeaveTypes = getVisibleLeaveTypesForYear(year);
    const selectedType = visibleLeaveTypes.find(lt => lt.id === currentTypeId);

    let triggerHTML;
    if (currentTypeId === 'remove') {
        triggerHTML = `<span class="font-medium text-sm text-red-500">${i18n.t('tracker.noneWillBeRemoved')}</span>`;
    } else if (selectedType) {
        triggerHTML = `
            <span class="flex items-center w-full min-w-0">
                <span class="w-3 h-3 rounded-full me-2 flex-shrink-0" style="background-color: ${selectedType.color};"></span>
                <span class="font-medium text-sm truncate min-w-0">${sanitizeHTML(selectedType.name)}</span>
            </span>
            <i class="fas fa-chevron-down text-xs text-gray-500 ms-1 flex-shrink-0"></i>`;
    } else {
        triggerHTML = `<span class="font-medium text-sm text-gray-500">${i18n.t('tracker.selectType')}</span>`;
    }

    container.innerHTML = `
        <button type="button" class="leave-type-selector-trigger w-full flex items-center justify-between px-3 py-1.5 border rounded-full shadow-sm text-left transition-all duration-200 active:scale-95">
            ${triggerHTML}
        </button>
        <div class="leave-type-selector-panel">
            <div class="flex flex-col space-y-1">
                <button type="button" data-id="remove" class="leave-type-option w-full text-left px-3 py-1.5 rounded-full text-sm hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center transition-all duration-200 active:scale-95">
                    <i class="fas fa-times-circle w-3 h-3 me-2 text-red-500"></i>
                    <span>${i18n.t('tracker.none')}</span>
                </button>
                ${visibleLeaveTypes.map(lt => `
                    <button type="button" data-id="${lt.id}" class="leave-type-option w-full text-left px-3 py-1.5 rounded-full text-sm hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center min-w-0 transition-all duration-200 active:scale-95">
                        <span class="w-3 h-3 rounded-full me-2 flex-shrink-0" style="background-color: ${lt.color};"></span>
                        <span class="truncate min-w-0" title="${sanitizeHTML(lt.name)}">${sanitizeHTML(lt.name)}</span>
                    </button>
                `).join('')}
            </div>
        </div>
    `;

    const trigger = container.querySelector('.leave-type-selector-trigger');
    const panel = container.querySelector('.leave-type-selector-panel');
    trigger.dataset.typeId = currentTypeId || 'remove';

    const closePanel = () => panel.classList.remove('open');

    trigger?.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.leave-type-selector-panel.open').forEach(p => {
            if (p !== panel) p.classList.remove('open');
        });
        panel.classList.toggle('open');
    });

    panel.querySelectorAll('.leave-type-option').forEach(option => {
        option?.addEventListener('click', () => {
            const newTypeId = option.dataset.id;
            trigger.dataset.typeId = newTypeId;

            let newTriggerHTML;
            if (newTypeId === 'remove') {
                newTriggerHTML = `<span class="font-medium text-sm text-red-500">${i18n.t('tracker.noneWillBeRemoved')}</span>`;
            } else {
                const newType = visibleLeaveTypes.find(lt => lt.id === newTypeId);

                newTriggerHTML = `
                    <span class="flex items-center w-full min-w-0">
                        <span class="w-3 h-3 rounded-full me-2 flex-shrink-0" style="background-color: ${newType.color};"></span>
                        <span class="font-medium text-sm truncate min-w-0">${sanitizeHTML(newType.name)}</span>
                    </span>
                    <i class="fas fa-chevron-down text-xs text-gray-500 ms-1 flex-shrink-0"></i>`;
            }
            trigger.innerHTML = newTriggerHTML;

            closePanel();
            if (onTypeChangeCallback) {
                onTypeChangeCallback(newTypeId);
            }
        });
    });

    document?.addEventListener('click', closePanel, { once: true });
    container?.addEventListener('click', e => e.stopPropagation());
}

export function setupDayTypeToggle(toggleElement) {
    const bg = toggleElement.querySelector('.toggle-bg');
    const buttons = toggleElement.querySelectorAll('.toggle-btn');

    const updateUI = (value) => {
        const isHalf = value === LEAVE_DAY_TYPES.HALF;
        // Transform is handled by CSS based on data-selected-value
        buttons.forEach(btn => btn.classList.toggle('active', btn.dataset.value === value));
    };

    updateUI(toggleElement.dataset.selectedValue || LEAVE_DAY_TYPES.FULL);

    toggleElement?.addEventListener('click', (e) => {
        const clickedButton = e.target.closest('.toggle-btn');
        if (!clickedButton) return;

        const value = clickedButton.dataset.value;
        if (toggleElement.dataset.selectedValue === value) return;

        toggleElement.dataset.selectedValue = value;
        updateUI(value);

        if (toggleElement.id === 'bulk-day-type-toggle') {
            document.querySelectorAll('#leave-days-list .day-type-toggle').forEach(itemToggle => {
                itemToggle.dataset.selectedValue = value;
                const itemButtons = itemToggle.querySelectorAll('.toggle-btn');
                itemButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.value === value));
            });
        }
    });
}

export function renderLeaveCustomizationModal() {
    const list = DOM.leaveDaysList;
    list.innerHTML = '';
    const sortedDates = Array.from(state.leaveSelection).sort();
    const year = state.currentMonth.getFullYear();
    const visibleLeaveTypes = getVisibleLeaveTypesForYear(year);

    const updateIndividualSelectorDisplay = (container, newTypeId) => {
        const trigger = container.querySelector('.leave-type-selector-trigger');
        if (!trigger) return;
        trigger.dataset.typeId = newTypeId;

        let newTriggerHTML;
        if (newTypeId === 'remove') {
            newTriggerHTML = `<span class="font-medium text-sm text-red-500">${i18n.t('tracker.noneWillBeRemoved')}</span>`;
        } else {
            const newType = visibleLeaveTypes.find(lt => lt.id === newTypeId);
            if (newType) {
                newTriggerHTML = `
                    <span class="flex items-center w-full min-w-0">
                        <span class="w-3 h-3 rounded-full me-2 flex-shrink-0" style="background-color: ${newType.color};"></span>
                        <span class="font-medium text-sm truncate min-w-0">${newType.name}</span>
                    </span>
                    <i class="fas fa-chevron-down text-xs text-gray-500 ms-1 flex-shrink-0"></i>`;
            }
        }
        if (newTriggerHTML) {
            trigger.innerHTML = newTriggerHTML;
        }
    };

    const bulkPillsContainer = document.getElementById('modal-leave-pills-container');
    let modalBulkTypeId = state.selectedLeaveTypeId || visibleLeaveTypes[0]?.id;

    const renderBulkPills = () => {
        bulkPillsContainer.innerHTML = '';
        visibleLeaveTypes.forEach(lt => {
            const pill = document.createElement('button');
            pill.className = 'flex-shrink-0 truncate max-w-40 px-3 py-1.5 rounded-full text-sm font-semibold text-white shadow transition-transform transform hover:scale-105';
            pill.style.backgroundColor = lt.color;
            pill.textContent = lt.name;
            if (lt.id === modalBulkTypeId) {
                pill.classList.add('ring-2', 'ring-offset-2', 'ring-blue-500', 'dark:ring-offset-gray-800');
            }
            pill?.addEventListener('click', () => {
                modalBulkTypeId = lt.id;
                renderBulkPills();
                list.querySelectorAll('.leave-type-selector').forEach(container => {
                    updateIndividualSelectorDisplay(container, modalBulkTypeId);
                });
            });
            bulkPillsContainer.appendChild(pill);
        });
    };

    renderBulkPills();
    setupDayTypeToggle(document.getElementById('bulk-day-type-toggle'));

    sortedDates.forEach(dateKey => {
        const item = document.createElement('div');
        item.className = 'leave-day-item flex flex-col sm:flex-row items-center justify-between p-3 rounded-lg shadow-sm border';
        item.dataset.dateKey = dateKey;

        const currentActivities = state.currentYearData.activities || {};
        const existingLeave = currentActivities[dateKey]?.leave;
        const currentLeaveTypeId = existingLeave ? existingLeave.typeId : modalBulkTypeId;
        const currentDayType = existingLeave ? existingLeave.dayType : LEAVE_DAY_TYPES.FULL;

        item.innerHTML = `
            <span class="font-medium mb-2 sm:mb-0 truncate min-w-0 w-full sm:w-auto text-left sm:text-left">${formatDateForDisplay(dateKey, i18n.currentLang)}</span>
            <div class="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 w-full sm:w-auto justify-end min-w-0">
                <div class="leave-type-selector relative flex-grow w-full sm:w-36 min-w-0">
                </div>
                <div class="flex items-center justify-between sm:justify-start w-full sm:w-auto gap-2">
                    <div class="day-type-toggle relative flex w-28 h-8 items-center rounded-full bg-gray-200 p-1 cursor-pointer flex-shrink-0" data-selected-value="${currentDayType}">
                        <div class="toggle-bg absolute top-1 h-6 w-[calc(50%-0.25rem)] rounded-full bg-blue-500 shadow-md transition-transform duration-300 ease-in-out"></div>
                        <button type="button" class="toggle-btn relative z-10 w-1/2 h-full text-center text-xs font-semibold" data-value="full" data-i18n="tracker.full">${i18n.t('tracker.full')}</button>
                        <button type="button" class="toggle-btn relative z-10 w-1/2 h-full text-center text-xs font-semibold" data-value="half" data-i18n="tracker.half">${i18n.t('tracker.half')}</button>
                    </div>
                    <button class="delete-leave-day-btn text-red-500 hover:text-red-700 p-2 flex-shrink-0" title="Remove this day">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
        `;
        list.appendChild(item);

        createLeaveTypeSelector(item.querySelector('.leave-type-selector'), currentLeaveTypeId);
        setupDayTypeToggle(item.querySelector('.day-type-toggle'));
    });

    list.querySelectorAll('.delete-leave-day-btn').forEach(btn => {
        btn?.addEventListener('click', (e) => {
            e.stopPropagation();
            const item = e.currentTarget.closest('[data-date-key]');
            if (item) {
                item.remove(); // Just remove the row visually
            }
        });
    });
}

export async function saveLoggedLeaves() {
    const button = DOM.customizeLeaveModal.querySelector('#save-log-leave-btn');
    setButtonLoadingState(button, true);
    await waitForDOMUpdate();

    // Capture the original data BEFORE any mutations so we can reliably check if fields existed
    const originalYearlyDataForPersistence = JSON.parse(JSON.stringify(state.yearlyData));

    const year = state.currentMonth.getFullYear();
    const visibleLeaveTypes = getVisibleLeaveTypesForYear(year);
    const currentActivities = state.currentYearData.activities || {};
    const balances = calculateLeaveBalances(); // This is now year-specific
    const modalItems = DOM.leaveDaysList.querySelectorAll('[data-date-key]');
    let balanceError = false;

    const changes = {};
    visibleLeaveTypes.forEach(lt => { changes[lt.id] = 0; });

    modalItems.forEach(item => {
        const dateKey = item.dataset.dateKey;
        const newTypeId = item.querySelector('.leave-type-selector-trigger').dataset.typeId;
        const newDayType = item.querySelector('.day-type-toggle').dataset.selectedValue;
        const newCost = newDayType === LEAVE_DAY_TYPES.HALF ? 0.5 : 1;
        const existingLeave = currentActivities[dateKey]?.leave;

        if (existingLeave) {
            const oldCost = existingLeave.dayType === LEAVE_DAY_TYPES.HALF ? 0.5 : 1;
            if (changes.hasOwnProperty(existingLeave.typeId)) {
                changes[existingLeave.typeId] -= oldCost;
            }
        }
        if (newTypeId !== 'remove' && changes.hasOwnProperty(newTypeId)) {
            changes[newTypeId] += newCost;
        }
    });

    for (const typeId in changes) {
        if (changes[typeId] > (balances[typeId] || 0)) {
            const leaveType = visibleLeaveTypes.find(lt => lt.id === typeId);
            if (leaveType) {
                showMessage(i18n.t("tracker.msgBalanceInsufficient").replace('{name}', leaveType.name), 'error');
                balanceError = true;
                break;
            }
        }
    }

    if (balanceError) {
        setButtonLoadingState(button, false);
        return;
    }

    const updatedActivities = { ...currentActivities };
    const datesInModal = new Set(Array.from(modalItems).map(item => item.dataset.dateKey));

    state.initialLeaveSelection.forEach(dateKey => {
        if (!datesInModal.has(dateKey) && updatedActivities[dateKey]?.leave) {
            delete updatedActivities[dateKey].leave;
        }
    });

    modalItems.forEach(item => {
        const dateKey = item.dataset.dateKey;
        updatedActivities[dateKey] = { ...(updatedActivities[dateKey] || {}) };
        const typeId = item.querySelector('.leave-type-selector-trigger').dataset.typeId;

        if (typeId === 'remove') {
            delete updatedActivities[dateKey].leave;
        } else {
            const dayType = item.querySelector('.day-type-toggle').dataset.selectedValue;
            updatedActivities[dateKey].leave = { typeId, dayType };
        }
    });

    const updatedYearData = { ...state.currentYearData, activities: updatedActivities };
    const updatedYearlyData = { ...state.yearlyData, [year]: updatedYearData };

    setState({ yearlyData: updatedYearlyData, currentYearData: updatedYearData });

    try {
        const timestamp = Date.now();
        state.lastUpdated = timestamp;

        if (state.isOnlineMode && state.userId) {
            const batch = writeBatch(db);
            const userDocRef = doc(db, "users", state.userId);
            let opCount = 0;

            // Handle deletions
            state.initialLeaveSelection.forEach(dateKey => {
                if (!datesInModal.has(dateKey) && originalYearlyDataForPersistence[year]?.activities[dateKey]?.leave) {
                    batch.update(userDocRef, {
                        [`yearlyData.${year}.activities.${dateKey}.leave`]: deleteField()
                    });
                    opCount++;
                }
            });

            // Handle updates/creations
            modalItems.forEach(item => {
                const dateKey = item.dataset.dateKey;
                const typeId = item.querySelector('.leave-type-selector-trigger').dataset.typeId;

                if (typeId === 'remove') {
                    // Check if it actually existed before trying to delete to save ops, or just blindly delete
                     batch.update(userDocRef, {
                        [`yearlyData.${year}.activities.${dateKey}.leave`]: deleteField()
                    });
                } else {
                    const dayType = item.querySelector('.day-type-toggle').dataset.selectedValue;
                    // We only update the 'leave' field of the activity object
                    // This preserves note, text, order, etc.
                    batch.update(userDocRef, {
                        [`yearlyData.${year}.activities.${dateKey}.leave`]: { typeId, dayType }
                    });
                }
                opCount++;
            });

            if (opCount > 0) {
                batch.update(userDocRef, { lastUpdated: timestamp });
                await batch.commit();
            }
        } else {
            saveDataToLocalStorage({ yearlyData: updatedYearlyData, leaveTypes: state.leaveTypes, lastUpdated: timestamp });
        }

        triggerTeamSync();
        showMessage(i18n.t("tracker.msgLeavesSaved"), 'success');
    } catch (error) {
        Logger.error("Failed to save logged leaves:", error);
        showMessage(i18n.t("tracker.msgLeavesSaveFailed"), "error");
    } finally {
        DOM.customizeLeaveModal.classList.remove('visible');
        if (state.previousActiveElement) {
            state.previousActiveElement.focus();
            state.previousActiveElement = null;
        }
        setState({ selectedLeaveTypeId: null, leaveSelection: new Set(), initialLeaveSelection: new Set() });
        // Removed legacy button logic
        updateView();
        setButtonLoadingState(button, false);
    }
}

export function handleBulkRemoveClick() {
    const list = DOM.leaveDaysList;
    list.querySelectorAll('.leave-day-item').forEach(item => {
        const selectorContainer = item.querySelector('.leave-type-selector');
        const trigger = selectorContainer.querySelector('.leave-type-selector-trigger');
        trigger.dataset.typeId = 'remove';
        trigger.innerHTML = `<span class="font-medium text-sm text-red-500">${i18n.t('tracker.noneWillBeRemoved')}</span>`;
    });
    showMessage(i18n.t("tracker.msgLeavesRemovalConfirmation"), 'info');
}
