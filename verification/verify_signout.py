from playwright.sync_api import sync_playwright

def verify_signout_message(page):
    page.goto('http://localhost:8080')

    # Splash
    page.wait_for_selector('#splash-screen')
    page.click('#splash-screen')

    # Login View
    page.wait_for_selector('#login-view', state='visible')

    # Enter Guest Mode
    page.click('#anon-continue-btn')
    page.wait_for_selector('#app-view', state='visible')

    # Switch to German
    page.click('#open-lang-btn')
    page.wait_for_selector('#language-modal', state='visible')
    page.click('div.language-option[data-lang="de"]')
    page.wait_for_selector('text="Monatsansicht"') # Verify switch

    # Click Sign Out ONCE
    page.click('#sign-out-btn')

    # Verify the message text
    page.wait_for_selector('#message-display.show')
    message_text = page.inner_text('#message-text')

    # German text for confirmSignOut is "Tippe erneut, um dich abzumelden."
    expected_text = "Tippe erneut, um dich abzumelden."

    if expected_text in message_text:
        print(f"Verified German Sign Out message: {message_text}")
    else:
        print(f"FAILED: Expected '{expected_text}' but got '{message_text}'")
        exit(1)

    page.screenshot(path='/home/jules/verification/german_signout_msg.png')

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_signout_message(page)
        finally:
            browser.close()
