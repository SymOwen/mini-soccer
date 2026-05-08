# Mini Soccer Standup Picker

## Purpose
A fun mini-soccer animation app used to randomly select who runs the daily standup. Users enter team member names, watch a short animated soccer match, and the ball scorer is revealed as today's standup host.

## How It Works
1. User enters team member names (comma-separated or one per line)
2. Click "Kick Off!" to start the animation
3. A short animated soccer game plays out on a mini pitch
4. The ball goes in the net — the scorer's name is revealed
5. That person runs the standup!

## Tech Stackda
- **Framework**: Next.js 15 (App Routasdaser, TypeScript)
- **Styling**: Tailwind CSS
- **Animation**: CSS keyframes + React state machine
- **Deployment**: Vercel

## Project Structure
```
src/
  app/
    page.tsx          # Main entry — name input + game container
    layout.tsx        # Root layout
  components/
    SoccerGame.tsx    # Full animated soccer field + match logic
    NameInput.tsx     # Team name entry form
    GoalReveal.tsx    # Scorer announcement overlay
```

## Game Animation Phases
1. **Idle** — pitch shown, waiting for kick-off
2. **Playing** (~4s) — players (dots) move, ball bounces around the pitch
3. **Shot** (~1s) — ball rockets toward goal
4. **Goal** — net ripples, crowd roar emoji burst
5. **Reveal** — scorer card slides in with name

## Key Design Decisions
- Pure CSS animations (no canvas) for simplicity and crisp rendering
- Players represented as colored circles with initials
- Ball is a ⚽ emoji animated along a bezier path
- Scorer is chosen via `Math.random()` at kick-off, not revealed until goal animation completes
- Names persist in `localStorage` so the team list survives refreshes

## Deployment
Deploy to Vercel with `vercel deploy`. No environment variables required — fully static/client-side.
