from playwright.sync_api import sync_playwright, expect
import re

def test_help_modal():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # 1. Navigate to app
        page.goto("http://localhost:5173")

        # 2. Click "Continue as Guest"
        # It's likely the "anon-continue-btn"
        page.click("#anon-continue-btn")

        # Wait for app view to load
        page.wait_for_selector("#app-view:not(.hidden)")

        # 3. Click "Log Leave"
        page.click("#log-new-leave-btn")

        # 4. Verify Help Button exists and click it
        help_btn = page.locator("#how-to-leave-btn")
        expect(help_btn).to_be_visible()
        help_btn.click()

        # 5. Verify Modal is visible
        modal = page.locator("#how-to-leave-modal")
        # Check if class contains 'visible'
        expect(modal).to_have_class(re.compile(r"visible"))

        # 6. Screenshot
        page.screenshot(path="verification_help_modal.png")
        print("Screenshot taken: verification_help_modal.png")

        # 7. Close modal
        close_btn = page.locator("#close-how-to-leave-btn")
        close_btn.click()

        # 8. Verify Modal is hidden
        expect(modal).not_to_have_class(re.compile(r"visible"))

        browser.close()

if __name__ == "__main__":
    test_help_modal()
