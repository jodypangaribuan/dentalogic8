---
description: How to install the Dentalogic8 app on a real iPhone
---

# Deploying to Real iPhone

To install the application on your physical iPhone for testing real-time CoreML performance:

## Prerequisites

1. **Mac with Xcode installed** (You already have this)
2. **Apple ID** (Free or Paid Developer Account)
3. **USB Cable** to connect your iPhone

## Steps

1. **Prepare your iPhone:**
   - Go to **Settings > Privacy & Security**.
   - Scroll down to **Developer Mode** and turn it **ON**.
   - Restart your phone if prompted.

2. **Connect to Mac:**
   - Plug your iPhone into your Mac using the USB cable.
   - Unlock your iPhone.
   - If asked "Trust This Computer?", tap **Trust** and enter your passcode.

3. **Verify Connection:**
   - Run in terminal: `xcrun xctrace list devices`
   - You should see your iPhone listed under "Devices".

4. **Run the App:**
   - In your project directory (`/Users/jody/Documents/FinalProject/App/dentalogic8`), run:
     ```bash
     npx expo run:ios --device
     ```
   - When prompted, use the arrow keys to select your connected iPhone.
   - **Tip:** If the command fails to find your device by name, use the UDID (long string of characters) from the `xcrun xctrace list devices` command:
     ```bash
     npx expo run:ios --device "00008120-00127D090E63601E"
     ```

## Troubleshooting

### "Development Team is required" Error
If the build fails with a signing error:

1. Open the iOS project in Xcode:
   ```bash
   xcode-select -s /Applications/Xcode.app
   open ios/dentalogic8.xcworkspace
   ```
2. In Xcode, click on the **dentalogic8** project icon in the left file navigator.
3. Select the **dentalogic8** target in the main view.
4. Go to the **Signing & Capabilities** tab.
5. Under **Signing**, select your **Team** (e.g., "Jody Pangaribuan (Personal Team)").
   - If no team is listed, click "Add an Account..." and log in with your Apple ID.
6. Once a team is selected and no errors are shown red, close Xcode.
7. Run `npx expo run:ios --device` again.

### "Untrusted Developer" Error on iPhone
After installing the app, if you tap the icon and see "Untrusted Developer":

1. Go to **Settings > General > VPN & Device Management** (or "Profiles & Device Management").
2. Tap your email address under "Developer App".
3. Tap **Trust [Your Name]**.
4. You can now open the app!

## Real-time Detection
Once installed:
1. Open the app.
2. Go to the **Pindai** (Scan) tab.
3. Allow Camera permission.
4. Wait for the model to unzip (first time only).
5. Point at a screen or dental image to see detections!
