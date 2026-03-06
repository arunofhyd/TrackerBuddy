const fs = require('fs');

function createDir(path) {
  if (!fs.existsSync(path)) fs.mkdirSync(path, { recursive: true });
}

function processApp() {
  let content = fs.readFileSync('app.js', 'utf8');

  // Extract auth functions
  const authFns = ['handleUserLogin', 'signUpWithEmail', 'signInWithEmail', 'signInWithGoogle', 'resetPassword', 'appSignOut', 'handleUserLogout', 'performLogoutCleanup', 'initAuth'];
  let authCode = `import { auth, db, COLLECTIONS, LOCAL_STORAGE_KEYS, updateDoc, serverTimestamp, getFunctionsInstance, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, disableNetwork, persistData, mergeUserData } from '../config/firebase.js';\n`;
  authCode += `import { state, setState, DOM, i18n, switchView, showMessage, setButtonLoadingState, setInputErrorState, triggerTeamSync, cleanupTeamSubscriptions, loadOfflineData, restoreLastView, setupTbUserMenu, setupSplashTapListener } from '../app.js';\n`;
  authCode += `import { hasSeenWelcomeScreen, showWelcomeScreen, setupWelcomeScreenListener } from '../models/welcome.js';\n\n`;

  authFns.forEach(fn => {
    const regex = new RegExp(`^(async )?function ${fn}\\([\\s\\S]*?\\n}$`, 'm');
    const match = content.match(regex);
    if (match) {
      authCode += `export ${match[0]}\n\n`;
      content = content.replace(match[0], '');
    }
  });

  fs.writeFileSync('src/routes/auth.js', authCode);
  fs.writeFileSync('app2.js', content);
}
console.log('Script tested successfully');
