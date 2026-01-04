from playwright.sync_api import sync_playwright

def verify_csv_input():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto("http://localhost:5173")

        # Verify the input exists
        input_element = page.locator("#upload-csv-input")
        if not input_element.count():
            print("Error: #upload-csv-input not found")
            return

        # Check accept attribute
        accept_attr = input_element.get_attribute("accept")
        expected = ".csv,text/csv,application/csv,application/x-csv,text/x-csv,text/comma-separated-values,text/x-comma-separated-values"
        if accept_attr != expected:
            print(f"Error: accept attribute mismatch.\nFound: {accept_attr}\nExpected: {expected}")
        else:
            print("Success: accept attribute is correct")

        # Verify it's not display:none (so it can be clicked programmatically if needed, though hidden is fine for file inputs usually as long as not 'display: none' in some frameworks, but here we used opacity-0)
        # Note: Playwright's check visibility might say hidden because of opacity 0, but we check computed style.
        is_visible = input_element.is_visible()
        # Since we used opacity-0 w-0 h-0, is_visible might return False or True depending on bounding box.
        # But importantly, we want to ensure it's in the DOM and functional.

        # Check computed style for display
        display = input_element.evaluate("el => window.getComputedStyle(el).display")
        if display == "none":
            print("Error: Computed display is 'none'. This might block interaction.")
        else:
            print(f"Success: Computed display is '{display}'")

        browser.close()

if __name__ == "__main__":
    verify_csv_input()
