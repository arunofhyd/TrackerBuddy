from playwright.sync_api import Page, expect, sync_playwright
import time
import re

def test_multi_select(page: Page):
    try:
        # 1. Arrange: Go to the app.
        page.goto("http://localhost:5173/")

        try:
            page.wait_for_selector("#tap-to-begin", state="visible", timeout=5000)
            page.click("#splash-screen")
        except:
            pass

        try:
            page.wait_for_selector("#anon-continue-btn", state="visible", timeout=5000)
            page.click("#anon-continue-btn")
        except:
            pass

        page.wait_for_selector("#log-new-leave-btn", state="visible", timeout=10000)

        # Scroll to bottom
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")

        # Try clicking Log Leave
        page.click("#log-new-leave-btn")

        # Check if multi-select button is visible
        if not page.locator("#multi-select-btn").is_visible():
            print("Multi-select button not visible, adding leave type.")

            # Click Add Leave Type
            page.click("#add-leave-type-btn")

            # Fill form
            page.fill("#leave-name-input", "Sick Leave")
            page.fill("#leave-days-input", "10")

            # Select color
            page.wait_for_selector("#leave-color-picker button", timeout=5000)
            page.click("#leave-color-picker button:nth-child(1)")

            # Save
            page.click("#save-leave-type-btn")

            # Wait for Sick Leave pill to appear
            page.wait_for_selector("text=Sick Leave", timeout=5000)

            # Wait a bit
            time.sleep(1)

            # Scroll to bottom again
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")

            # Try clicking Log Leave again
            page.click("#log-new-leave-btn")

        # 3. Assert: Verify buttons split
        expect(page.locator("#multi-select-btn")).to_be_visible()

        # Click Multi Select
        page.click("#multi-select-btn")

        # Select dates
        days = page.locator(".calendar-day-cell.current-month").all()
        if len(days) < 5:
            print("Not enough days in current month view to test range.")
            return

        days[0].click()
        days[4].click()

        # 4. Assert: Modal appears
        expect(page.locator("#weekend-option-modal")).to_be_visible()

        # Click No (include weekends)
        page.click("#weekend-option-no-btn")

        # Verify days are selected
        # Wait for render
        page.wait_for_timeout(1000)

        days = page.locator(".calendar-day-cell.current-month").all()
        # Verify at least the first and last are selected
        expect(days[0]).to_have_class(re.compile(r"leave-selecting"))
        expect(days[4]).to_have_class(re.compile(r"leave-selecting"))

        # 5. Screenshot
        page.screenshot(path="verification/multi_select.png")

    except Exception as e:
        page.screenshot(path="verification/error.png")
        raise e

if __name__ == "__main__":
  with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    try:
      test_multi_select(page)
    finally:
      browser.close()
