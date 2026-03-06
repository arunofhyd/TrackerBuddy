import { state, setState, DOM, i18n } from '../../app.js';
import { showMessage, setButtonLoadingState, renderAdminUserList } from './uiRoutes.js';
import { auth, getFunctionsInstance } from '../config/firebase.js';
import { Logger } from '../utils/logger.js';

export async function setProStatus(targetUserId, expiryDate) {
    const modal = document.getElementById('pro-duration-modal');
    if (modal) {
        const btnId = expiryDate ? 'pro-save-date-btn' : 'pro-till-revoked-btn';
        const btn = document.getElementById(btnId);
        setButtonLoadingState(btn, true);
    }

    try {
        const { functions, httpsCallable } = await getFunctionsInstance();
        const updateUserRole = httpsCallable(functions, 'updateUserRole');
        await updateUserRole({
            targetUserId: targetUserId,
            newRole: 'pro',
            proExpiry: expiryDate
        });

        // Refresh list
        const getAllUsers = httpsCallable(functions, 'getAllUsers');
        const result = await getAllUsers();
        renderAdminUserList(result.data.users);

        showMessage(i18n.t('pro.msgPromoted'), 'success');
        if (modal) modal.classList.remove('visible');
    } catch (error) {
        Logger.error("Failed to set pro status:", error);
        showMessage(i18n.t("pro.msgFailedUpdateRole"), 'error');
    } finally {
        if (modal) {
            const btnId = expiryDate ? 'pro-save-date-btn' : 'pro-till-revoked-btn';
            const btn = document.getElementById(btnId);
            setButtonLoadingState(btn, false);
        }
        state.adminTargetUserId = null;
    }
}

export async function grantProByEmail(email) {
    if (!email) return;
    try {
        const { functions, httpsCallable } = await getFunctionsInstance();
        const grantPro = httpsCallable(functions, 'grantProByEmail');
        const result = await grantPro({ email });
        showMessage(result.data.message, 'success');
        // Refresh list
        await refreshAdminUserList();
    } catch (error) {
        Logger.error("Failed to grant pro by email:", error);
        showMessage(i18n.t("pro.msgFailedGrant"), 'error');
    }
}

export async function refreshAdminUserList(reset = true) {
    if (reset) {
        setState({ adminUsers: [], adminNextPageToken: null });
        DOM.adminUserList.innerHTML = '<div class="flex justify-center py-8"><i class="fas fa-spinner fa-spin text-3xl text-blue-500"></i></div>';
    }

    const loadMoreBtn = document.getElementById('admin-load-more-btn');
    if (loadMoreBtn) setButtonLoadingState(loadMoreBtn, true);

    try {
        const { functions, httpsCallable } = await getFunctionsInstance();
        const getAllUsers = httpsCallable(functions, 'getAllUsers');
        const result = await getAllUsers({ nextPageToken: state.adminNextPageToken, limit: 100 });

        const newUsers = result.data.users;
        const nextToken = result.data.nextPageToken;

        // Deduplicate just in case
        const currentUsers = state.adminUsers || [];
        const existingIds = new Set(currentUsers.map(u => u.uid));
        const uniqueNewUsers = newUsers.filter(u => !existingIds.has(u.uid));

        const updatedUsers = [...currentUsers, ...uniqueNewUsers];

        setState({
            adminUsers: updatedUsers,
            adminNextPageToken: nextToken
        });

        renderAdminUserList(updatedUsers, state.adminSearchQuery || '');
    } catch (error) {
        Logger.error("Failed to load users:", error);
        if (reset) {
            DOM.adminUserList.innerHTML = `<p class="text-center text-red-500">${i18n.t('pro.msgFailedLoadUsers', {error: error.message})}</p>`;
        } else {
            showMessage(i18n.t('pro.msgFailedLoadUsers', {error: error.message}), 'error');
        }
    } finally {
        if (loadMoreBtn) setButtonLoadingState(loadMoreBtn, false);
    }
}

export async function revokeProWhitelist(email) {
    if (!email) return;
    try {
        const { functions, httpsCallable } = await getFunctionsInstance();
        const revokePro = httpsCallable(functions, 'revokeProWhitelist');
        const result = await revokePro({ email });
        showMessage(result.data.message, 'success');
        // Refresh list
        await refreshAdminUserList();
    } catch (error) {
        Logger.error("Failed to revoke pro whitelist:", error);
        showMessage(i18n.t("pro.msgFailedRevoke"), 'error');
    }
}

export async function openAdminDashboard() {
    DOM.adminDashboardModal.classList.add('visible');
    setState({ adminSearchQuery: '' });
    await refreshAdminUserList(true);
}
