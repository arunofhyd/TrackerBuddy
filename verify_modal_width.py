
from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use iPhone 12 Pro context to simulate mobile width if needed, but we want to check "PC screen" width issues.
        # User said "too wide for PC screen", so let's use a standard desktop viewport.
        context = browser.new_context(viewport={'width': 1280, 'height': 800})
        page = context.new_page()

        # Load the page
        page.goto("http://localhost:8080")

        # Bypass splash screen
        page.evaluate("document.getElementById('splash-screen').style.display = 'none'")
        page.evaluate("document.getElementById('login-view').classList.remove('hidden')")

        # Inject the modal to be visible directly to verify styles without needing full login flow
        page.evaluate("""
            const modal = document.getElementById('pro-duration-modal');
            modal.classList.add('visible');
            modal.style.opacity = '1';
            modal.style.pointerEvents = 'auto';
        """)

        # Wait a bit for styles to apply
        time.sleep(1)

        # Take a screenshot of the modal area
        # We can clip to the modal or take full page. Full page shows the overlay context.
        page.screenshot(path="verification_modal_width.png")

        browser.close()

if __name__ == "__main__":
    run()
