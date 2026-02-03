# Undercover

A web implementation of the social deduction party game **Undercover**.

## Tech Stack

- **Next.js** (App Router)
- **React**
- **Supabase** (Postgres, RLS)
- **HeroUI** + **Tailwind CSS**
- **Framer Motion**

## Features

- Create / join rooms with a 6-char code
- Host role configuration (Undercover / Mr.White counts)
- Role + word assignment
- Voting, elimination, and round progression
- Mr.White special flow: if voted out, Mr.White gets one chance to guess the Civilian word
- Winner announcement + confetti

## Local Development

### 1) Install

```bash
npm install
```

### 2) Configure environment variables

Create a `.env` file in the project root:

```bash
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
HOST_TIMEOUT_SECONDS=20
```

Notes:

- `SUPABASE_SERVICE_ROLE_KEY` is required because the server routes use an admin client.
- Do **not** expose the service role key to the browser.

### 3) Run the dev server

```bash
npm run dev
```

Open:

- `http://localhost:3000`

## Supabase

This project expects a Supabase project with tables for rooms, players, rounds, votes, and readies.

The repository includes a `supabase/` directory for database-related assets.

## Game Flow (High-Level)

1. **Lobby**: players join a room
2. **Assign**: host configures role counts and assigns roles/words
3. **Describe / Vote**: players vote to eliminate 1 player
4. **Mr.White guess (special)**: if Mr.White is eliminated, Mr.White can guess the Civilian word
5. **Result / End**: show eliminated player and check win conditions

### Win Conditions

- **Undercover wins**: number of alive Civilians equals number of alive Undercovers
- **Civilian wins**: only Civilians remain (no Undercover and no Mr.White)
- **Mr.White wins**: Mr.White guesses the Civilian word correctly after being voted out

## Scripts

```bash
npm run dev
npm run build
npm run start
```
