# Data Recovery Instructions

This document provides steps to recover your Firestore data using Point-in-Time Recovery (PITR).

## Prerequisites

1.  **Google Cloud SDK (`gcloud` CLI)** must be installed on your machine.
2.  You must have **Owner** or **Datastore Owner** permissions on the Firebase project.
3.  You must be authenticated:
    ```bash
    gcloud auth login
    gcloud config set project trackerbuddyaoh
    ```

## Recovery Details

*   **Project ID:** `trackerbuddyaoh`
*   **Source Database:** `(default)`
*   **Target Recovery Time:** `2026-01-19T07:00:00+05:30` (19 January 2026 at 07:00:00 UTC+5:30)

## Step 1: Perform the Restore

Run the following command in your terminal. This will restore the database state from the specified time to a **new** database named `recovered-db`. It does *not* overwrite your current `(default)` database, which is safer.

```bash
gcloud firestore databases clone \
  --source-database='projects/trackerbuddyaoh/databases/(default)' \
  --destination-database='recovered-db' \
  --snapshot-time='2026-01-19T07:00:00+05:30'
```

*Note: This process may take some time depending on the size of your database.*

If you see an error like **"Cannot serve requests when the database is undergoing a restore,"** this is normal. It means the cloning process is running. You must wait for it to finish before you can use the database.

**Check Status:**
You can check the status of the operation by running:
```bash
gcloud firestore operations list
```
Look for the operation with type `CLONE_DATABASE` and wait until `done` is `true`.

**Specific Operation Check:**
Based on your output, you can check the specific operation status with:
```bash
gcloud firestore operations describe projects/trackerbuddyaoh/databases/recovered-db/operations/q8YSzOWoC4lRQQ1lRTAEVRAqMWh0dW9zLWFpc2ELIgwQIRo
```
Wait until the output shows `done: true`.

## Step 2: Verify the Restored Data

Once the operation is complete, you can verify the data in the Google Cloud Console:

1.  Go to the [Firestore section in Google Cloud Console](https://console.cloud.google.com/firestore/data).
2.  Switch the database from `(default)` to `recovered-db` using the dropdown menu at the top.
3.  Browse the collections to ensure the data is present as expected.

## Step 3: Targeted Recovery (Single Document)

If you only want to restore a specific user (e.g., ID `DFwvxqy4LBfCWlY76j3HWRgxMxN2`) without overwriting the entire database, follow these steps:

1.  **Ensure Step 1 is complete:** You must have the `recovered-db` running.
2.  **Run the targeted restoration script:**
    We have provided a script `restore_user.js` to copy a specific document from the backup to the live database.

    ```bash
    # Install dependencies if needed
    npm install firebase-admin @google-cloud/firestore

    # Run the script
    node restore_user.js
    ```

    *Note: You may need to set up `GOOGLE_APPLICATION_CREDENTIALS` or be logged in via `gcloud auth application-default login` for the script to access the databases.*

## Alternative: Full Database Merge

If you want to merge *all* recovered data back:

### Option A: Switch App to Use Recovered Database (Quickest)

You can configure your application to connect to the `recovered-db` database instead of `(default)`.

**1. Frontend (app.js):**

In your `services/firebase.js` (or where you initialize Firestore), you need to specify the database ID.

*Current:*
```javascript
const db = getFirestore(app);
```

*Change to:*
```javascript
const db = getFirestore(app, "recovered-db");
```

**2. Backend (Cloud Functions):**

If you have Cloud Functions that need to read from the recovered data, update the `admin.firestore()` initialization.

*Current:*
```javascript
const db = admin.firestore();
```

*Change to:*
```javascript
const db = admin.firestore("recovered-db"); // Note: Check specific SDK version docs, sometimes requires specific init
// OR safer way in many admin SDK versions:
const db = new Firestore({
    projectId: 'trackerbuddyaoh',
    databaseId: 'recovered-db'
});
```

### Option B: Export and Import
1.  **Export** the data from `recovered-db`.
2.  **Import** the data back into `(default)`.

### Option B: Export and Import (Merging)

This option allows you to merge the recovered data back into your main database. You will need a Cloud Storage bucket for this.

**1. Find your Bucket Name:**
Your project typically has a default bucket named `gs://[PROJECT_ID].appspot.com`. You can list your buckets to be sure:
```bash
gcloud storage buckets list
```
*Look for one that looks like `gs://trackerbuddyaoh.appspot.com` or similar.*

**2. Export from `recovered-db`:**
```bash
gcloud firestore export gs://trackerbuddyaoh.appspot.com/recovery-export \
  --database='recovered-db'
```
*(If your bucket name is different, replace `trackerbuddyaoh.appspot.com` with the correct name).*

**3. Import to `(default)`:**
```bash
gcloud firestore import gs://trackerbuddyaoh.appspot.com/recovery-export \
  --database='(default)'
```
