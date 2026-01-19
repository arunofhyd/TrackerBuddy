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
            # Ensure not disabled or obscured
            time.sleep(1)
            nav_btn.click()

            # Wait longer for view transition
            page.locator("#tog-view").wait_for(state="visible", timeout=10000)
            time.sleep(1)

            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")

            page.screenshot(path="verification/tog_desktop_aligned.png")
            print("Desktop screenshot taken.")
        except Exception as e:
            print(f"Desktop test failed: {e}")
            page.screenshot(path="verification/tog_desktop_error.png")
        finally:
            browser.close()

        # Mobile
        print("Running Mobile Test...")
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 375, "height": 812}, is_mobile=True, has_touch=True)
        page = context.new_page()

        try:
            page.goto("http://localhost:5173")

            page.locator("#splash-screen").wait_for(state="visible", timeout=5000)

            page.evaluate("""
                var splash = document.getElementById('splash-screen');
                if (splash) splash.remove();
            """)

            page.locator("#anon-continue-btn").click()

            nav_btn = page.locator("#nav-tog-btn")
            # In mobile view, the nav button might be different or in a menu?
            # Looking at index.html:
            # <footer id="main-footer" ...>
            # <button id="nav-tog-btn" class="hidden inline-flex ...">
            # It has 'hidden' class initially?
            # "hidden sm:inline" for text, but the button itself:
            # class="hidden inline-flex items-center gap-2 ..."
            # Wait, if it has 'hidden' class, it won't be visible.
            # But the desktop test passed before (in previous turn).
            # Ah, looking at `index.html` again:
            # <button id="nav-tog-btn" class="hidden inline-flex ...
            # It seems it is hidden by default and maybe shown by JS?
            # Or maybe I misread the previous verification success.
            # In previous turn, `nav_btn.wait_for(state="visible", timeout=10000)` passed?

            # Let's check `app.js` logic if possible, or just force show it.
            # Actually, the user might be on "TrackerBuddy" view by default.
            # The footer button switches to TOGtracker.

            # If the button is hidden in HTML:
            # <button id="nav-tog-btn" class="hidden inline-flex ...">
            # It implies it's hidden on all breakpoints unless JS removes 'hidden'.

            nav_btn.wait_for(state="visible", timeout=10000)
            time.sleep(1)
            nav_btn.click()

            page.locator("#tog-view").wait_for(state="visible", timeout=10000)
            time.sleep(1)

            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            time.sleep(0.5)

            page.screenshot(path="verification/tog_mobile_aligned.png")
            print("Mobile screenshot taken.")
        except Exception as e:
            print(f"Mobile test failed: {e}")
            page.screenshot(path="verification/tog_mobile_error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_tog_layout()
