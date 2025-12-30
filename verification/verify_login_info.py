from playwright.sync_api import sync_playwright

def verify_login_translation(page):
    page.goto('http://localhost:8080')

    # Splash
    page.wait_for_selector('#splash-screen')
    page.click('#splash-screen')

    # Login View
    page.wait_for_selector('#login-view', state='visible')

    # Enter Guest Mode to access language switcher
    page.click('#anon-continue-btn')
    page.wait_for_selector('#app-view', state='visible')

    # Switch to German
    page.click('#open-lang-btn')
    page.wait_for_selector('#language-modal', state='visible')
    page.click('div.language-option[data-lang="de"]')
    page.wait_for_selector('text="Monatsansicht"') # Verify switch

    # Sign Out to see Login Screen again
    page.click('#sign-out-btn')
    # Confirm if needed (logic in app.js might require double click)
    page.wait_for_timeout(500)
    if page.is_visible('#app-view'):
        page.click('#sign-out-btn')

    page.wait_for_selector('#login-view', state='visible')

    # Expand Info
    page.click('#info-toggle-btn')
    page.wait_for_selector('#info-description', state='visible')

    # Verify German Text for the first info item
    # "Mühelos tägliche Aktivitäten protokollieren"
    # We look for the text content.
    # The HTML is <span><strong>Mühelos...</strong>...</span>

    content = page.inner_text('#info-description')
    if "Mühelos tägliche Aktivitäten protokollieren" in content:
        print("Verified German Login Info translation.")
    else:
        print(f"FAILED: German text not found. Content: {content}")
        exit(1)

    page.screenshot(path='/home/jules/verification/german_login_info_final.png')

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_login_translation(page)
        finally:
            browser.close()
