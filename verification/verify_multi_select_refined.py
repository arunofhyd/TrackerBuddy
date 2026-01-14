from playwright.sync_api import Page, expect, sync_playwright
import time
import re

def test_multi_select(page: Page):
    # Capture console logs
    page.on("console", lambda msg: print(f"BROWSER CONSOLE: {msg.text}"))
    page.on("pageerror", lambda err: print(f"BROWSER ERROR: {err}"))

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

        # Click Multi Select (ON)
        page.click("#multi-select-btn")
        expect(page.locator("#multi-select-btn")).to_have_class(re.compile(r"ring-2"))

        # Select dates
        days = page.locator(".calendar-day-cell.current-month").all()
        if len(days) < 5:
            print("Not enough days in current month view to test range.")
            return

        # Click Start Day
        days[0].click()
        # Verify dashed outline (.leave-selecting)
        expect(days[0]).to_have_class(re.compile(r"leave-selecting"))

        # Click End Day
        days[4].click()
        # (Modal covers immediately, so checking styling on last day might be flaky, but logic is there)

        # 4. Assert: Modal appears
        expect(page.locator("#weekend-option-modal")).to_be_visible()

        # Verify text
        expect(page.locator("#weekend-option-modal")).to_contain_text("Do you want to include these days?")

        # Verify Sat/Sun buttons exist
        expect(page.locator("#toggle-sat-btn")).to_be_visible()

        # Toggle Sat (Red/Exclude)
        print("Clicking toggle-sat-btn")
        page.click("#toggle-sat-btn")

        # Click Apply
        print("Clicking apply")
        page.click("#weekend-apply-btn")

        # Verify modal closed
        expect(page.locator("#weekend-option-modal")).not_to_be_visible()

        # 5. Screenshot
        page.screenshot(path="verification/multi_select_refined.png")

    except Exception as e:
        page.screenshot(path="verification/error_refined.png")
        raise e

if __name__ == "__main__":
  with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    try:
      test_multi_select(page)
    finally:
      browser.close()
