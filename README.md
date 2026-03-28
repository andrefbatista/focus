# Focus — Task Selector

A minimal task selector app designed for ADHD. Add tasks, let the app pick one for you based on how much time you have, and log what you accomplished.

## Features

- Add tasks with a title, description, and time estimate (30 min, 2 hours, or 1 day)
- Randomly select a task based on available time
- Mark tasks as done and attach an outcome (notes, link, or image)
- Completed tasks archived in a dedicated section
- Works offline — all data stored locally in the browser
- Installable as an Android app (PWA)

## Live App

[https://andrefbatista.github.io/focus/](https://andrefbatista.github.io/focus/)

## Run it locally

No build tools or dependencies required. Just download and open:

1. Click **Code** → **Download ZIP** and unzip it
2. Open `index.html` in any browser

## Install on Android

1. Open the live app URL in Chrome on Android
2. Tap **⋮** → **Add to Home screen**
3. Tap **Install**

## Make your own version

1. Click **Fork** at the top of this page
2. Edit the files directly on GitHub or download and modify locally
3. Enable GitHub Pages in your fork's Settings to deploy it

## Sync across your own devices (optional)

By default the app stores data locally in the browser. To sync across your own devices you can connect it to a free [Supabase](https://supabase.com) database.

### 1. Create a Supabase project

1. Sign up at [supabase.com](https://supabase.com) (free)
2. Create a new project
3. Go to the **SQL Editor** and run this to create the tasks table:

```sql
create table tasks (
  id text primary key,
  title text not null,
  description text,
  duration text not null,
  done boolean default false,
  outcome jsonb,
  "createdAt" bigint,
  "completedAt" bigint
);
```

4. Go to **Settings → API** and copy your **Project URL** and **anon public** key

### 2. Add your credentials

1. Copy `config.example.js` and rename the copy to `config.js`
2. Fill in your Project URL and anon key
3. Open the app — it will sync automatically

> `config.js` is gitignored and will never be uploaded to GitHub. Your credentials stay private.

### 3. Install on each device

Repeat the credential step on every device you want to sync. All devices pointing to the same Supabase project will share the same tasks.

## Built with

- Vanilla HTML, CSS, and JavaScript
- No frameworks or dependencies
- `localStorage` for data persistence
