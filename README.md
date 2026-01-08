# Body Recomposition Tracker (React + Firebase + GitHub Pages)

This is a single-page app for body recomposition tracking:
- Daily logging (weight, macros)
- Strength logging (3 lifts) as **best last set**: Load (kg) + Reps → stores estimated **1RM**
- Optional weekly Navy Method measurements (+ optional triple-measure mode)
- Client-side 7-day exponential weighted moving average (alpha = 2/(7+1))
- Weekly analysis: computed TDEE, metabolic adaptation vs baseline, loss rate vs LBM
- Email/password auth only
- Firestore per-user security rules

### Strength 1RM details
- You enter **Load (kg)** + **Reps** for your best last set per lift (optional each day).
- The app computes estimated 1RM using the **Brzycki** formula: `1RM = load * 36 / (37 - reps)`.
- The computed 1RM is stored in the existing `bench` / `squat` / `deadlift` fields so all charts/weekly logic keeps working.

## 1) Firebase Setup
### Auth
Firebase Console → Authentication → Sign-in method → Enable **Email/Password**

### Firestore
Firebase Console → Firestore Database → Create database

### Authorized domains
Firebase Console → Authentication → Settings → Authorized domains:
Add:
- `andrefsilveriog.github.io`

### Firestore Rules
Firebase Console → Firestore → Rules (paste):

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      match /entries/{entryId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```


## Admin flag (WIP)
The app includes an **Admin** page at `/admin` and an **Admin** button in the top navbar (next to **Profile**).

- Each user profile document can include: `isAdmin: true | false`
- For now, the Admin button is visible to all signed-in users (we’ll lock it down later).
- To make a user an admin, set `users/{uid}.isAdmin = true` in Firestore.

## 2) Local dev
```bash
npm install
npm run dev
```

## 3) Deploy to GitHub Pages
This project is preconfigured for repo name: **Body-Recomp-Tracker**.

```bash
npm run deploy
```

Then GitHub → Repo Settings → Pages:
- Source: Deploy from a branch
- Branch: `gh-pages`
- Folder: `/(root)`

Your site will be:
`https://andrefsilveriog.github.io/Body-Recomp-Tracker/`

> If you change the repo name, you must update `base` in `vite.config.js` to match.


## Admin panel
- Route: `/admin`
- To grant admin access: set `isAdmin: true` on your user document (`users/{uid}`) in Firestore.
- The provided `firestore.rules` allow admins to read the `/users` collection and update only `isAdmin`/`accountType` for other users.
