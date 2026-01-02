from playwright.sync_api import sync_playwright

def verify_teams_lock():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use mobile emulation to trigger mobile layout if needed, or desktop default
        context = browser.new_context(viewport={'width': 1280, 'height': 800})
        page = context.new_page()

        try:
            # 1. Navigate to the app
            page.goto("http://localhost:8080")

            # 2. Bypass splash screen
            page.wait_for_selector("#splash-screen")
            page.click("#splash-screen")

            # 3. Choose "Continue as Guest"
            page.wait_for_selector("#anon-continue-btn")
            page.click("#anon-continue-btn")

            # 4. Wait for main app view
            page.wait_for_selector("#app-view")

            # 5. Expand "Teams" section (which should be locked)
            # Find the Teams toggle button in the footer controls
            # ID: team-toggle-btn
            page.wait_for_selector("#team-toggle-btn")
            page.click("#team-toggle-btn")

            # 6. Wait for Team Section to expand
            # It has ID #team-section
            page.wait_for_selector("#team-section.visible")

            # 7. Take screenshot of the Locked State
            # We expect to see "Pro Feature Locked"
            page.screenshot(path="verification_teams_locked.png")
            print("Screenshot taken: verification_teams_locked.png")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification_error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_teams_lock()
