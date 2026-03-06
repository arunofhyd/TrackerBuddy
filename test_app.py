import subprocess
import time
from playwright.sync_api import sync_playwright

def run_test():
    # Start the app
    process = subprocess.Popen(["npm", "run", "dev"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    time.sleep(5)  # Wait for server to start

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Capture console errors
        errors = []
        page.on("pageerror", lambda err: errors.append(err.message))
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)

        try:
            page.goto("http://localhost:5173", timeout=10000)
            page.wait_for_selector("#splash-screen", timeout=5000)
            print("Page loaded successfully.")
        except Exception as e:
            print(f"Failed to load page: {e}")
            errors.append(str(e))

        browser.close()

    process.terminate()

    if errors:
        print("Found errors:")
        for e in errors:
            print("-", e)
        return False
    else:
        print("No console errors found.")
        return True

if __name__ == "__main__":
    success = run_test()
    if not success:
        exit(1)
