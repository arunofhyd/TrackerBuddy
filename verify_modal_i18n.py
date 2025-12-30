from playwright.sync_api import sync_playwright, expect
import time

def verify_modal_translation():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use mobile viewport for consistency with previous tests
        context = browser.new_context(viewport={'width': 375, 'height': 667})
        page = context.new_page()

        # Load the app
        page.goto("http://localhost:8000")

        # Bypass splash screen
        page.evaluate("document.getElementById('splash-screen').style.display = 'none'")
        page.evaluate("document.getElementById('login-view').classList.remove('hidden')")

        # Click "Continue as Guest"
        page.click("#anon-continue-btn")

        # Wait for app view
        expect(page.locator("#app-view")).to_be_visible()

        # Switch Language to Malayalam (ml)
        # 1. Click language button
        page.click("#open-lang-btn")
        # 2. Wait for modal
        expect(page.locator("#language-modal")).to_be_visible()
        # 3. Click Malayalam option
        page.click(".language-option[data-lang='ml']")

        # Verify language switch worked (basic check)
        expect(page.locator("#month-view-btn")).to_have_text("മാസ കാഴ്‌ച") # "Month View" in Malayalam

        # Open "Add Leave Type" Modal
        page.click("#add-leave-type-btn")
        expect(page.locator("#leave-type-modal")).to_be_visible()

        # VERIFY: Title should be in Malayalam
        # "Add New Leave Type" -> "പുതിയ തരം ചേർക്കുക"
        modal_title = page.locator("#leave-type-modal-title")
        expect(modal_title).to_have_text("പുതിയ തരം ചേർക്കുക")
        print("Verified 'Add New Leave Type' translation.")

        # Close modal
        page.click("#cancel-leave-type-btn")

        # Create a dummy leave type so we can edit it
        page.click("#add-leave-type-btn")
        page.fill("#leave-name-input", "Test Leave")
        page.fill("#leave-days-input", "10")
        # Select first color
        page.click("#leave-color-picker button:first-child")
        page.click("#save-leave-type-btn")

        # Verify pill exists
        expect(page.locator("#leave-pills-container button")).to_have_count(1)

        # Open stats panel to access edit button (since pills only select for logging)
        page.click("#stats-toggle-btn")

        # Click edit button
        page.click(".edit-leave-type-btn")

        # VERIFY: Title should be "Edit Leave Type" in Malayalam
        # "Edit Leave Type" -> "ലീവ് തരം എഡിറ്റ് ചെയ്യുക"
        expect(modal_title).to_have_text("ലീവ് തരം എഡിറ്റ് ചെയ്യുക")
        print("Verified 'Edit Leave Type' translation.")

        # Take screenshot
        page.screenshot(path="verification_modal_i18n.png")

        browser.close()

if __name__ == "__main__":
    verify_modal_translation()
