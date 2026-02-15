# How to Run Read Aloud (Step by Step)

Follow these steps to open the Read Aloud app in your browser.

---

## Part 1: Let the app “show” its page to your browser

Your app runs inside a separate environment. Your browser needs permission to see it. Do this once per session:

1. **Open the Ports panel**
   - Look at the **bottom** of Cursor.
   - Click the tab that says **“Ports”** (next to Terminal, Problems, etc.).
   - If you don’t see it: **View → Ports**.

2. **Add port 8080**
   - Click **“Forward a Port”** (or the **+**).
   - Type: **8080**
   - Press **Enter**.

3. **Check it’s there**
   - You should see **8080** in the list, with a label like “Read Aloud” or “8080”.
   - Leave this panel open; you don’t need to click anything else here.

---

## Part 2: Start the app and open it in the browser

4. **Open Run and Debug**
   - On the **left** sidebar, click the **Play icon with a bug** (Run and Debug).
   - Or press **Ctrl+Shift+D** (Windows/Linux) or **Cmd+Shift+D** (Mac).

5. **Choose the right run option**
   - At the top, in the dropdown, select **“Read Aloud: Run & Open”**.

6. **Start the app**
   - Click the **green Play button** (▶) next to that dropdown.
   - Wait a few seconds. You might see a terminal open and some text like “Listening on http://localhost:8080”.

7. **Open the app in the browser**
   - Your browser may open by itself to the Read Aloud page.
   - If it **doesn’t** open, use the Ports tab:
     - Look at the **Ports** tab at the bottom (same panel where you added port 8080).
     - Find the row **“Read Aloud (8080)”**.
     - Click the **Forwarded Address** link (the long `https://...` URL in that row). That opens the app in your browser.
   - Or open your browser and go to: **http://localhost:8080**

You should now see the Read Aloud app in your browser.

---

## If you see “Connection refused” or the page won’t load

- Go back to **Part 1** and make sure you added port **8080** in the **Ports** panel.
- Then try **Part 2** again (green Play → wait → open browser or type `http://localhost:8080`).

---

## Quick checklist

- [ ] Ports panel open → “Forward a Port” → **8080** added  
- [ ] Run and Debug → **“Read Aloud: Run & Open”** selected  
- [ ] Green Play button clicked  
- [ ] Browser opened (by itself or by going to **http://localhost:8080**)
