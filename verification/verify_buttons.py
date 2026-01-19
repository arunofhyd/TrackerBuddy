from playwright.sync_api import sync_playwright
import time

def verify_tog_layout():
    with sync_playwright() as p:
        # Desktop
        print("Running Desktop Test...")
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 1024})
        page = context.new_page()

        try:
            page.goto("http://localhost:5173")

            # Wait for splash
            page.locator("#splash-screen").wait_for(state="visible", timeout=5000)

            # Remove splash screen
            page.evaluate("""
                var splash = document.getElementById('splash-screen');
                if (splash) splash.remove();
            """)

            page.locator("#anon-continue-btn").click()

            nav_btn = page.locator("#nav-tog-btn")
            nav_btn.wait_for(state="visible", timeout=10000)
            time.sleep(1)
            nav_btn.click()

            page.locator("#tog-view").wait_for(state="visible", timeout=10000)
            time.sleep(1)

            # Scroll to top to see calendar
            page.evaluate("window.scrollTo(0, 0)")

            page.screenshot(path="verification/tog_desktop_buttons.png")
            print("Desktop screenshot taken.")
        except Exception as e:
            print(f"Desktop test failed: {e}")
            page.screenshot(path="verification/tog_desktop_buttons_error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_tog_layout()
