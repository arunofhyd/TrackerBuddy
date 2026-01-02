
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

        # Inject mock users and render
        page.evaluate("""
            const mockUsers = [
                {
                    uid: 'super-admin-1',
                    email: 'arunthomas04042001@gmail.com',
                    displayName: 'Super Admin',
                    role: 'admin',
                    creationTime: new Date().toISOString()
                },
                {
                    uid: 'pro-user-1',
                    email: 'pro@example.com',
                    displayName: 'Pro User',
                    role: 'pro',
                    creationTime: new Date().toISOString()
                },
                {
                    uid: 'pending_new@example.com',
                    email: 'new@example.com',
                    displayName: 'Pending Signup',
                    role: 'pro',
                    status: 'pending'
                }
            ];

            if (window.renderAdminUserList) {
                // Manually open modal structure first
                const modal = document.getElementById('admin-dashboard-modal');
                modal.classList.add('visible');

                // Render list
                window.renderAdminUserList(mockUsers);
            }
        """)

        time.sleep(1)
        page.screenshot(path="verification_admin_list.png")

        # Test Search Filter
        page.type("#admin-user-search", "pro")
        time.sleep(0.5)
        page.screenshot(path="verification_admin_search_filter.png")

        # Test Unknown Email Grant
        page.fill("#admin-user-search", "unknown@example.com")
        time.sleep(0.5)
        page.screenshot(path="verification_admin_search_grant.png")

        browser.close()

if __name__ == "__main__":
    run()
