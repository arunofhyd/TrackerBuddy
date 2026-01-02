
from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 800})
        page = context.new_page()

        # Load the page
        page.goto("http://localhost:8080")

        # Bypass splash screen
        page.evaluate("document.getElementById('splash-screen').style.display = 'none'")
        page.evaluate("document.getElementById('login-view').classList.remove('hidden')")

        # Inject mock users into the Admin Dashboard and display it
        page.evaluate("""
            const mockUsers = [
                {
                    uid: 'super-admin-1',
                    email: 'arunthomas04042001@gmail.com',
                    displayName: 'Super Admin',
                    role: 'admin', // Super Admin check is via email, role might be anything but usually effectively admin
                    creationTime: new Date().toISOString()
                },
                {
                    uid: 'standard-user-1',
                    email: 'user@example.com',
                    displayName: 'Regular User',
                    role: 'standard',
                    creationTime: new Date().toISOString()
                }
            ];

            // Expose render function globally or access via window if I attached it
            // I attached it to window in app.js: window.renderAdminUserList = renderAdminUserList;

            if (window.renderAdminUserList) {
                window.renderAdminUserList(mockUsers);
                const modal = document.getElementById('admin-dashboard-modal');
                modal.classList.add('visible');
                modal.style.opacity = '1';
                modal.style.pointerEvents = 'auto';
            } else {
                console.error("renderAdminUserList not found on window");
            }
        """)

        # Wait for rendering
        time.sleep(1)

        # Take a screenshot of the modal area
        page.screenshot(path="verification_owner_badge.png")

        browser.close()

if __name__ == "__main__":
    run()
