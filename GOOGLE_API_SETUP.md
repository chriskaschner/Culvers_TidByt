# Google Calendar API Setup Guide

This guide walks you through setting up Google Calendar API credentials for the Culver's Flavor of the Day Tracker.

## Prerequisites

- A Google account
- Access to [Google Cloud Console](https://console.cloud.google.com/)

## Step 1: Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top of the page
3. Click "New Project"
4. Enter a project name (e.g., "Culvers FOTD Tracker")
5. Click "Create"
6. Wait for the project to be created (you'll see a notification)

## Step 2: Enable the Google Calendar API

1. In the Google Cloud Console, make sure your new project is selected
2. Go to "APIs & Services" → "Library" (or search for "Calendar API")
3. Search for "Google Calendar API"
4. Click on "Google Calendar API" in the results
5. Click the "Enable" button
6. Wait for the API to be enabled

## Step 3: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "+ Create Credentials" at the top
3. Select "OAuth client ID"
4. If prompted to configure the OAuth consent screen:
   - Click "Configure Consent Screen"
   - Choose "External" user type (unless you have a Google Workspace account)
   - Click "Create"
   - Fill in the required fields:
     - App name: "Culvers FOTD Tracker"
     - User support email: (your email)
     - Developer contact: (your email)
   - Click "Save and Continue"
   - Skip adding scopes (click "Save and Continue")
   - Skip adding test users (click "Save and Continue")
   - Review and click "Back to Dashboard"
5. Go back to "Credentials" tab
6. Click "+ Create Credentials" again and select "OAuth client ID"
7. Choose "Desktop app" as the application type
8. Name it "Culvers FOTD Desktop Client"
9. Click "Create"
10. A dialog will appear with your client ID and client secret
11. Click "Download JSON"

## Step 4: Save the Credentials File

1. Rename the downloaded file to `credentials.json`
2. Move it to the `credentials/` directory in your project:
   ```bash
   mv ~/Downloads/client_secret_*.json credentials/credentials.json
   ```
3. Verify the file exists:
   ```bash
   ls -la credentials/credentials.json
   ```

## Step 5: First-Time Authentication

The first time you run the calendar sync, it will open a browser window for authentication:

```bash
uv run python main.py
```

1. A browser window will open automatically
2. Sign in with your Google account
3. You'll see a warning "Google hasn't verified this app"
   - Click "Advanced"
   - Click "Go to Culvers FOTD Tracker (unsafe)" - this is safe because you created the app
4. Grant permissions to access your Google Calendar
5. You'll see "The authentication flow has completed"
6. Close the browser window

After this, a `credentials/token.json` file will be created and stored for future use. You won't need to authenticate again unless the token expires (typically after a few months) or is deleted.

## Troubleshooting

### "The OAuth client was not found" Error

- Make sure you've enabled the Google Calendar API (Step 2)
- Verify your `credentials.json` file is in the right location
- Check that you selected "Desktop app" as the application type

### "Access blocked: This app's request is invalid" Error

- Make sure you configured the OAuth consent screen (Step 3, substep 4)
- Add yourself as a test user if using "External" user type

### Token Expiration

If you see authentication errors after the app has been working:
1. Delete the token file: `rm credentials/token.json`
2. Run the app again to re-authenticate

## Security Notes

- **Never commit `credentials.json` or `token.json` to git**
- These files contain sensitive authentication data
- They are already excluded in `.gitignore`
- If you accidentally expose them, revoke access immediately in Google Cloud Console

## Calendar Selection

By default, the app will use your primary Google Calendar. To use a different calendar:

1. Find your calendar ID in Google Calendar settings:
   - Open Google Calendar
   - Click the gear icon → Settings
   - Select the calendar you want to use
   - Scroll down to "Integrate calendar"
   - Copy the "Calendar ID"
2. Update `config.yaml`:
   ```yaml
   google_calendar:
     calendar_id: "your-calendar-id@group.calendar.google.com"
   ```

## Resources

- [Google Calendar API Documentation](https://developers.google.com/calendar/api)
- [Python Quickstart](https://developers.google.com/calendar/api/quickstart/python)
- [OAuth 2.0 for Desktop Apps](https://developers.google.com/identity/protocols/oauth2/native-app)
