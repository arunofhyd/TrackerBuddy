import time
from playwright.sync_api import sync_playwright, expect

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            # 1. Navigate
            page.goto("http://localhost:5175")
            time.sleep(2)

            # Dismiss Splash
            splash = page.locator("#splash-screen")
            if splash.is_visible():
                print("Clicking splash screen...")
                splash.click(force=True) # Force click if needed
                time.sleep(1) # Wait for fade out

            # 2. Check footer hidden initially
            tog_btn = page.locator("#nav-tog-btn")
            # Need to wait for footer to be in DOM or check visibility
            # The footer is initially opacity: 0 in style.css? "#content-wrapper, #main-footer { opacity: 0; }"
            # It fades in after auth init.

            # Wait for login view visible
            login_view = page.locator("#login-view")
            expect(login_view).to_be_visible()

            if tog_btn.count() > 0:
                classes = tog_btn.get_attribute("class")
                if "hidden" not in classes:
                    print("FAILURE: TOG button should be hidden initially!")
                else:
                    print("SUCCESS: TOG button is hidden initially.")

            # 3. Login as Guest
            guest_btn = page.locator("#anon-continue-btn")
            guest_btn.click()

            # Wait for app view
            app_view = page.locator("#app-view")
            expect(app_view).to_be_visible(timeout=10000)

            # 4. Check footer visible now
            expect(tog_btn).to_be_visible()
            print("SUCCESS: TOG button is visible after login.")

            # 5. Switch to TOG
            tog_btn.click()

            # Wait for TOG view
            tog_view = page.locator("#tog-view")
            expect(tog_view).to_be_visible()
            print("SUCCESS: Switched to TOG view.")

            # 6. Screenshot
            page.screenshot(path="verification_tog.png")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    run()
