
import os
import sys
import time
from playwright.sync_api import sync_playwright

def verify_tog_tracker():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Capture console logs
        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))

        page.goto("http://localhost:8080/index.html")

        print("Page loaded.")

        # Handle Splash Screen
        splash = page.locator("#splash-screen")
        if splash.is_visible():
            print("Splash screen detected. Clicking to dismiss...")
            splash.click()
            time.sleep(3) # Wait for animation

        # 1. Check if TOG Tracker button exists in footer
        tog_btn = page.locator("#tog-tracker-btn")
        if not tog_btn.is_visible():
            print("FAILURE: TOG Tracker button not found in footer.")
            browser.close()
            return False

        print("TOG Tracker button found.")

        # 2. Click TOG Tracker button
        tog_btn.click(force=True)
        time.sleep(2) # Wait for transition

        # 3. Check if TOG View is visible
        tog_view = page.locator("#tog-tracker-view")
        if not tog_view.is_visible():
            print("FAILURE: TOG Tracker view not visible after click.")
            if page.locator("#app-view").is_visible():
                print("DEBUG: App view is still visible.")
            if page.locator("#login-view").is_visible():
                print("DEBUG: Login view is still visible.")
            browser.close()
            return False

        print("TOG Tracker view is visible.")

        # 4. Check for specific TOG elements
        if not page.locator("#c1_h").is_visible():
            print("FAILURE: Calculator input c1_h not found.")
            return False

        # Check if grid exists in DOM
        grid = page.locator("#calendarGrid")
        count = grid.count()
        print(f"Grid count: {count}")

        # Check content of grid
        content = grid.inner_html()
        # Should have day cards
        if "day-card" not in content:
             print("FAILURE: Calendar Grid empty (no day cards).")
             print(f"Content: {content[:100]}...")
             return False

        if not grid.is_visible():
            print("FAILURE: Calendar Grid not visible.")
            # Check bounding box
            box = grid.bounding_box()
            print(f"Bounding box: {box}")
            return False

        # 5. Check Menu Items
        avatar_btn = page.locator("#user-avatar-btn")
        if not avatar_btn.is_visible():
             print("FAILURE: User avatar button not found.")
             return False

        avatar_btn.click(force=True)
        time.sleep(1)

        if not page.locator("#tog-export-btn").is_visible():
            print("FAILURE: Export button not found in menu.")
            return False

        if not page.locator("#tog-import-btn").is_visible():
            print("FAILURE: Import button not found in menu.")
            return False

        if not page.locator("#tog-reset-btn").is_visible():
            print("FAILURE: Reset button not found in menu.")
            return False

        print("Menu items verified.")

        browser.close()
        print("SUCCESS: TOG Tracker verification passed.")
        return True

if __name__ == "__main__":
    try:
        success = verify_tog_tracker()
        if not success:
            sys.exit(1)
    except Exception as e:
        print(f"An error occurred: {e}")
        sys.exit(1)
