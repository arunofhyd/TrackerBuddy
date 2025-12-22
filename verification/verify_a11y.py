from playwright.sync_api import sync_playwright, expect
import re

def verify_app():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the app
        page.goto("http://localhost:8080")

        # 1. Verify Splash Screen Handling
        splash_screen = page.locator("#splash-screen")
        expect(splash_screen).to_be_visible()
        splash_screen.click()

        # Wait for login view
        login_view = page.locator("#login-view")
        expect(login_view).to_be_visible()

        # 2. Verify Accessibility (Aria Labels) on Buttons
        guest_btn = page.locator("#anon-continue-btn")
        guest_btn.click()

        # Wait for app view
        app_view = page.locator("#app-view")
        expect(app_view).to_be_visible()

        # Check aria-labels
        prev_btn = page.locator("#prev-btn")
        expect(prev_btn).to_have_attribute("aria-label", "Previous period")

        next_btn = page.locator("#next-btn")
        expect(next_btn).to_have_attribute("aria-label", "Next period")

        add_leave_btn = page.locator("#add-leave-type-btn")
        expect(add_leave_btn).to_have_attribute("aria-label", "Add or edit leave types")

        # 3. Verify Focus Management (Modal)
        add_leave_btn.click()

        leave_modal = page.locator("#leave-type-modal")
        expect(leave_modal).to_have_class(re.compile(r"visible"))

        leave_name_input = page.locator("#leave-name-input")
        expect(leave_name_input).to_be_focused()

        cancel_btn = page.locator("#cancel-leave-type-btn")
        cancel_btn.click()

        expect(leave_modal).not_to_have_class(re.compile(r"visible"))

        # 4. Verify Search (Spotlight) Focus
        spotlight_btn = page.locator("#open-spotlight-btn")
        spotlight_btn.click()

        spotlight_modal = page.locator("#spotlight-modal")
        expect(spotlight_modal).to_have_class(re.compile(r"visible"))

        spotlight_input = page.locator("#spotlight-input")
        expect(spotlight_input).to_be_focused()

        # Use Keyboard Escape to close (testing keyboard nav + focus restoration)
        page.keyboard.press("Escape")

        expect(spotlight_modal).not_to_have_class(re.compile(r"visible"))

        # Verify focus restored
        expect(spotlight_btn).to_be_focused()

        # Take a final screenshot
        page.screenshot(path="/home/jules/verification/accessibility_focus_verify.png")

        browser.close()

if __name__ == "__main__":
    verify_app()
