# Body Recomposition Tracker (React + Firebase + GitHub Pages)

This is a single-page app for body recomposition tracking:
- Daily logging (weight, macros, bench/squat/deadlift)
- Optional weekly Navy Method measurements (+ optional triple-measure mode)
- Client-side 7-day exponential weighted moving average (alpha = 2/(7+1))
- Weekly analysis: computed TDEE, metabolic adaptation vs baseline, loss rate vs LBM
- Email/password auth only
- Firestore per-user security rules

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
