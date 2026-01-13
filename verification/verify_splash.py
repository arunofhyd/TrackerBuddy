
from playwright.sync_api import sync_playwright, expect
import time

def verify_splash_logic():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        print("Navigating to app...")
        page.goto("http://localhost:5173/")

        # Verify initial state: Splash Screen is visible
        print("Checking for splash screen...")
        splash_screen = page.locator("#splash-screen")
        expect(splash_screen).to_be_visible()

        # Verify Loading Spinner is visible initially
        splash_loading = page.locator("#splash-loading")
        expect(splash_loading).to_be_visible()

        # Verify "Tap to Begin" is HIDDEN initially
        tap_to_begin = page.locator("#tap-to-begin")
        expect(tap_to_begin).not_to_be_visible()

        # We are simulating a "Not Logged In" state (fresh browser context).
        # Wait for "Tap to Begin" to appear (which happens after initAuth detects no user)
        print("Waiting for Tap to Begin...")
        expect(tap_to_begin).to_be_visible(timeout=10000)

        # Verify Loading Spinner is HIDDEN now
        expect(splash_loading).not_to_be_visible()

        print("Tap to Begin is visible. Taking screenshot 1...")
        page.screenshot(path="verification/splash_tap_to_begin.png")

        # Click Tap to Begin
        print("Clicking Tap to Begin...")
        # The click listener is on the splash screen itself, effectively
        splash_screen.click()

        # Wait for transition
        # Splash screen should animate out (opacity -> 0 or z-index change)
        # In our code: z-index becomes -10. Background becomes transparent.
        # But Playwright 'visible' checks verify if it is attached and has non-zero size/opacity/visibility.
        # Since we keep it display:flex but z-index -10, it technically might still be "visible" to playwright unless covered?
        # But opacity/visibility properties might change.
        # Actually our CSS animation changes opacity of text.
        # The splash screen div itself sets backgroundColor to transparent.
        # Let's check if Login View becomes visible.

        print("Waiting for Login View...")
        login_view = page.locator("#login-view")
        expect(login_view).to_be_visible()

        print("Login View is visible. Taking screenshot 2...")
        page.screenshot(path="verification/login_view_revealed.png")

        browser.close()

if __name__ == "__main__":
    verify_splash_logic()
