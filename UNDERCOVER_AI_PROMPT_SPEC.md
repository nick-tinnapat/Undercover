# UNDERCOVER WEB GAME — AI PROMPT SPECIFICATION

> Stack:
> - Next.js (App Router)
> - Supabase (DB + Realtime)
> - Guest Mode (No Login)
> - HeroUI + Tailwind
> - Framer Motion
> - Deploy: Vercel
> - Cost: FREE (MVP)

---

## FEATURE 0: GLOBAL RULES (IMPORTANT)

### SYSTEM CONSTRAINT
- Game logic must be server-driven
- Client must never know:
  - Other players' roles
  - Other players' words
  - Vote results before reveal
- Cleanup all room-related data after game end

### DESIGN PRINCIPLE
- Dark / Premium / Party Game
- Motion-first UX (Framer Motion)
- Mobile-first responsive design

---

# FEATURE 1: PROJECT & ARCHITECTURE SETUP

## AI PROMPT
You are a senior fullstack developer.

### BACKEND (BE)
- Setup Next.js App Router project
- Configure Supabase client and service role
- Create API route structure:
  - /api/room
  - /api/game
  - /api/vote
- Ensure all game logic runs on server only

### FRONTEND (FE)
- Setup layout structure:
  - / (Landing)
  - /room/[code]
  - /game/[code]
- Integrate HeroUI, Tailwind, Framer Motion
- Global dark theme + gradient background

---

# FEATURE 2: LANDING PAGE (CREATE / JOIN ROOM)

## AI PROMPT
Design a premium landing page for a party game.

### BACKEND
- POST /api/room/create
- POST /api/room/join
- Generate room code (A-Z0-9, length 6)
- Create guest UUID and return to client

### FRONTEND
- Centered hero layout
- Input:
  - Player name
  - Room code (join)
- Buttons:
  - Create Room
  - Join Room

### ANIMATION
- Page fade + scale in
- Button hover scale
- Animated gradient background

---

# FEATURE 3: LOBBY ROOM (WAITING ROOM)

## AI PROMPT
Create a realtime multiplayer lobby.

### BACKEND
- Realtime subscribe to players table
- Validate minimum players >= 3
- POST /api/game/start (host only)

### FRONTEND
- Player grid cards
- Host badge
- Start Game button (host only)

### ANIMATION
- Player card slide-in
- Pulse effect on join
- Disabled button animation

---

# FEATURE 4: ROLE & WORD DISTRIBUTION (SECRET)

## AI PROMPT
Securely assign roles and words.

### BACKEND
- Randomly assign roles
- Select word pair from pool
- Store words server-side only
- POST /api/game/assign

### FRONTEND
- Private view per player
- Large role card
- Word reveal
- Ready button

### ANIMATION
- Card flip animation
- Glow border
- Background blur

---

# FEATURE 5: DESCRIBE PHASE

## AI PROMPT
Implement turn-based description phase.

### BACKEND
- Track current speaker index
- Timer per player
- Broadcast turn via realtime

### FRONTEND
- Highlight active speaker
- Circular countdown timer
- Instruction hint

### ANIMATION
- Spotlight effect
- Smooth transitions
- Animated timer stroke

---

# FEATURE 6: VOTING PHASE

## AI PROMPT
Create secret voting system.

### BACKEND
- POST /api/vote
- One vote per player
- Lock phase when all voted

### FRONTEND
- Selectable player cards
- Disable after vote
- Waiting state UI

### ANIMATION
- Card shake on select
- Vote progress indicator

---

# FEATURE 7: RESULT & ELIMINATION

## AI PROMPT
Reveal results and eliminate player.

### BACKEND
- Count votes
- Eliminate player
- Check win condition
- Update game state

### FRONTEND
- Reveal screen
- Show eliminated player role
- Next Round button

### ANIMATION
- Dramatic reveal
- Red / green overlay
- Confetti on win

---

# FEATURE 8: GAME END & CLEANUP

## AI PROMPT
End game and cleanup resources.

### BACKEND
- Delete room, players, votes, rounds
- Trigger cleanup automatically

### FRONTEND
- Winner summary screen
- Reveal all roles
- Play Again button

### ANIMATION
- Victory motion
- Smooth exit transition

---

# FEATURE 9: DATABASE & SECURITY (SUPABASE)

## AI PROMPT
Design Supabase schema and RLS.

### TABLES
- rooms
- players
- rounds
- votes

### SECURITY
- Enable RLS
- Allow access only by room_id + guest_id
- No public role/word exposure

---

# FEATURE 10: VISUAL IDENTITY & MOTION SYSTEM

## AI PROMPT
Design premium UI and motion system.

### DESIGN
- Dark background
- Neon accent colors
- Big typography
- Glassmorphism cards

### MOTION
- Framer Motion spring animations
- Staggered entrance
- Ease-out transitions
- Avoid harsh motion

---

# END OF DOCUMENT

This file is intended to be used as:
- AI instruction prompt
- Development checklist
- Feature breakdown reference
