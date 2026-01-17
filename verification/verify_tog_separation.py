from playwright.sync_api import sync_playwright

def verify():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        page.on("console", lambda msg: print(f"Console: {msg.text}"))
        page.on("pageerror", lambda exc: print(f"Page Error: {exc}"))

        page.goto("http://localhost:5173/")

        # Handle splash screen
        splash = page.locator("#splash-screen")
        if splash.is_visible():
            print("Splash screen visible. Clicking it.")
            splash.click(force=True)
            page.wait_for_timeout(2000)

        # Handle guest login if needed
        guest_btn = page.locator("#anon-continue-btn")
        if guest_btn.is_visible():
            print("Clicking Continue as Guest")
            guest_btn.click(force=True)
            page.wait_for_timeout(5000)

        # Ensure App View is visible and TOG View is hidden initially
        app_view = page.locator("#app-view")
        tog_view = page.locator("#tog-tracker-view")

        # Wait for potential animation or loading
        page.wait_for_timeout(2000)

        # Try to wait for app view
        try:
            app_view.wait_for(state="visible", timeout=5000)
        except:
            pass

        if app_view.is_visible() and not tog_view.is_visible():
            print("Initial state correct: App View visible, TOG View hidden.")
        else:
            # If splash or login handling failed, we might be stuck.
            # Or if initial state is different.
            if tog_view.is_visible():
                 print("FAILURE: Initial view state incorrect (TOG visible).")
            elif not app_view.is_visible():
                 print("FAILURE: Initial view state incorrect (App hidden).")
                 # Debug: what is visible?
                 if page.locator("#splash-screen").is_visible():
                     print("Debug: Splash screen still visible")
                 if page.locator("#login-view").is_visible():
                     print("Debug: Login view still visible")

        # Click TOG Tracker button
        tog_btn = page.locator("#tog-tracker-btn")
        if tog_btn.is_visible():
            print("Clicking TOG Tracker")
            tog_btn.click(force=True)
            page.wait_for_timeout(1000)

            if tog_view.is_visible() and not app_view.is_visible():
                print("SUCCESS: Switched to TOG View.")

                # Check Calculators in TOG View
                calc_h = page.locator("#c1_h")
                if calc_h.is_visible():
                    print("Calculators visible.")
                    calc_h.fill("1")
                    page.locator("#c1_m").fill("30")
                    page.wait_for_timeout(500)
                    res = page.locator("#res_decimal").inner_text()
                    if res == "1.50" or res == "1.5":
                        print("Calculator (Time -> Decimal) working: 1:30 -> 1.50")
                    else:
                        print(f"Calculator failed: Expected 1.50, got {res}")
                else:
                    print("FAILURE: Calculators not found in TOG View")

                # Check Calendar Grid
                grid = page.locator("#tog-calendar-grid")
                if grid.is_visible():
                    print("TOG Calendar Grid visible.")
                    # Check for inputs
                    day_cards = grid.locator(".day-card")
                    if day_cards.count() > 0:
                        print(f"Found {day_cards.count()} day cards.")
                        first_card = day_cards.nth(10) # Pick a middle one to avoid empty spacers
                        # Log inner HTML for debug
                        # print(first_card.inner_html())

                        main_input = first_card.locator("input[step='0.1']").first
                        if main_input.is_visible():
                             print("TOG Input visible.")
                             main_input.fill("2.5")
                             main_input.press("Enter")
                             page.wait_for_timeout(500)

                             # Check Stats
                             total = page.locator("#tog-month-total").inner_text()
                             if total == "2.50":
                                 print("Stats updated correctly.")
                             else:
                                 print(f"Stats failed: Expected 2.50, got {total}")
                        else:
                             print("FAILURE: TOG Input not visible in card.")
                    else:
                        print("FAILURE: No day cards found.")
                else:
                    print("FAILURE: TOG Calendar Grid not visible.")

            else:
                print("FAILURE: Failed to switch to TOG View.")
        else:
            print("FAILURE: TOG Tracker button not found")

        browser.close()

if __name__ == "__main__":
    verify()
