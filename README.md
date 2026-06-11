## Coqui Encuestas

Live classroom quiz app with separate teacher and student routes.

### Routes

- `/` landing page with links into each mode
- `/teacher` quiz authoring and room control
- `/join` student room join and voting

### Behavior

- Teachers can create questions, publish a room, move between questions, and close the session.
- Students join with a room code, vote on the active question, and see live result bars.
- Answers sync through the server-side room store and SSE stream at `/api/rooms/[roomCode]/events`.

### Run

```bash
npm run dev
```

### Build

```bash
npm run build
```
