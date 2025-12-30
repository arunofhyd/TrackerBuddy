from playwright.sync_api import sync_playwright

def verify_translation(page):
    page.goto('http://localhost:8080')

    # Wait for splash screen and click it
    page.wait_for_selector('#splash-screen')
    page.click('#splash-screen')

    # Wait for login screen (or guest option)
    page.wait_for_selector('#anon-continue-btn', state='visible')

    # Click Continue as Guest
    page.click('#anon-continue-btn')

    # Wait for main content
    page.wait_for_selector('#main-content-area', state='visible')

    # Check for basic text presence (which comes from i18n)
    # "Month View" is a key "monthView"

    page.wait_for_selector('text="Month View"')

    # Let's switch language to German
    # Button ID found via grep: open-lang-btn
    page.click('#open-lang-btn')

    # Wait for modal
    page.wait_for_selector('.spotlight-modal', state='visible')

    # Click German (Deutsch)
    # The element might be a div or button, but has class 'language-option' and data-lang='de'
    # Wait for it to be visible first
    page.wait_for_selector('.language-option[data-lang="de"]', state='visible')
    page.click('.language-option[data-lang="de"]')

    # Wait for text update
    # "Monatsansicht" is the translation for "Month View" in de.json
    page.wait_for_selector('text="Monatsansicht"')

    # Take screenshot of the German view
    page.screenshot(path='/home/jules/verification/german_view.png')

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_translation(page)
        finally:
            browser.close()
