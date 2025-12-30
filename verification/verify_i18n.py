from playwright.sync_api import sync_playwright

def verify_translation(page):
    page.goto('http://localhost:8080')

    # 1. Splash Screen
    page.wait_for_selector('#splash-screen')
    page.click('#splash-screen')

    # 2. Login Screen (Initially English)
    page.wait_for_selector('#login-view', state='visible')

    # 3. Enter Guest Mode
    page.click('#anon-continue-btn')

    # 4. Main App View
    page.wait_for_selector('#app-view', state='visible')

    # 5. Switch Language to German
    # Open language modal
    page.click('#open-lang-btn')
    page.wait_for_selector('#language-modal', state='visible')

    # Select German
    # The grep showed it is a 'div' created with document.createElement('div'), NOT a button.
    # class="language-option"
    page.click('div.language-option[data-lang="de"]')

    # 6. Verify Language Changed in App
    page.wait_for_selector('text="Monatsansicht"')

    # 7. Sign Out
    # The sign out button might need a double click (confirmation).
    page.click('#sign-out-btn')

    # Wait a bit to see if it redirects
    page.wait_for_timeout(1000)

    # If still in app view, click again (confirmation)
    if page.is_visible('#app-view') and page.is_visible('#sign-out-btn'):
        page.click('#sign-out-btn')

    # 9. Login Screen (Now should be German)
    page.wait_for_selector('#login-view', state='visible')

    # 10. Expand Info
    page.click('#info-toggle-btn')
    page.wait_for_selector('#info-description', state='visible')

    # 11. Verify German Text
    # "Mühelos tägliche Aktivitäten protokollieren"
    page.wait_for_selector('text="Mühelos tägliche Aktivitäten protokollieren"')

    # Screenshot
    page.screenshot(path='/home/jules/verification/german_login_info.png')

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_translation(page)
        finally:
            browser.close()
