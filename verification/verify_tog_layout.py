from playwright.sync_api import sync_playwright
import time

def verify_tog_layout():
    with sync_playwright() as p:
        # Desktop
        print("Running Desktop Test...")
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 1024})
        page = context.new_page()

        page.goto("http://localhost:5173")

        # Wait for splash
        page.locator("#splash-screen").wait_for(state="visible", timeout=5000)

        # Brutally remove splash screen
        page.evaluate("""
            var splash = document.getElementById('splash-screen');
            if (splash) splash.remove();
        """)

        page.locator("#anon-continue-btn").click()

        nav_btn = page.locator("#nav-tog-btn")
        nav_btn.wait_for(state="visible", timeout=10000)
        nav_btn.click()

        page.locator("#tog-view").wait_for(state="visible", timeout=5000)
        time.sleep(1)

        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")

        page.screenshot(path="verification/tog_desktop.png")
        print("Desktop screenshot taken.")
        browser.close()

        # Mobile
        print("Running Mobile Test...")
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 375, "height": 812}, is_mobile=True, has_touch=True)
        page = context.new_page()

        page.goto("http://localhost:5173")

        page.locator("#splash-screen").wait_for(state="visible", timeout=5000)

        page.evaluate("""
            var splash = document.getElementById('splash-screen');
            if (splash) splash.remove();
        """)

        page.locator("#anon-continue-btn").click()

        nav_btn = page.locator("#nav-tog-btn")
        nav_btn.wait_for(state="visible", timeout=10000)
        nav_btn.click()

        page.locator("#tog-view").wait_for(state="visible", timeout=5000)
        time.sleep(1)

        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        time.sleep(0.5)

        page.screenshot(path="verification/tog_mobile.png")
        print("Mobile screenshot taken.")
        browser.close()

if __name__ == "__main__":
    verify_tog_layout()
