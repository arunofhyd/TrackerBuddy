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

    # 5. Try to Log Leave without adding a leave type
    # The message should appear: "Please add a leave type first using the + button above the calendar."

    # Click Log Leave button
    page.click('#log-new-leave-btn')

    # 6. Verify Message
    # The message text content is in #message-text
    page.wait_for_selector('#message-display.show')
    message_text = page.inner_text('#message-text')

    expected_text = "Please add a leave type first using the + button above the calendar."
    if expected_text in message_text:
        print(f"Verified English message: {message_text}")
    else:
        print(f"FAILED: Expected '{expected_text}' but got '{message_text}'")
        exit(1)

    page.screenshot(path='/home/jules/verification/english_log_leave_msg.png')

    # 7. Close message (optional, it fades out)

    # 8. Switch Language to German (if we translated it, but we used English fallback)
    # Let's verify that the KEY is not shown, but the English text (fallback) is shown.

    page.click('#open-lang-btn')
    page.wait_for_selector('#language-modal', state='visible')
    page.click('div.language-option[data-lang="de"]')

    # Wait for modal to close/view update
    page.wait_for_selector('text="Monatsansicht"')

    # Click Log Leave again
    page.click('#log-new-leave-btn')

    # Verify message again
    page.wait_for_selector('#message-display.show')
    # Since we reused English text in de.json, it should be the same English text
    message_text_de = page.inner_text('#message-text')

    if expected_text in message_text_de:
        print(f"Verified German (fallback) message: {message_text_de}")
    else:
        print(f"FAILED: Expected '{expected_text}' but got '{message_text_de}'")
        exit(1)

    page.screenshot(path='/home/jules/verification/german_log_leave_msg.png')

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_translation(page)
        finally:
            browser.close()
