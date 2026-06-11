import {
  addOrUpdateParticipant,
  advanceQuestion,
  createLiveRoom,
  generateRoomCode,
  normalizeQuestion,
  recordVote,
  rewindQuestion,
  type QuizQuestion,
  type QuizRoom,
} from "@/lib/quiz";

type RoomStore = {
  rooms: Map<string, QuizRoom>;
  subscribers: Map<string, Set<ReadableStreamDefaultController<Uint8Array>>>;
};

declare global {
  // eslint-disable-next-line no-var
  var __coquiEncuestasStore: RoomStore | undefined;
}

const encoder = new TextEncoder();

function getStore() {
  if (!globalThis.__coquiEncuestasStore) {
    globalThis.__coquiEncuestasStore = {
      rooms: new Map<string, QuizRoom>(),
      subscribers: new Map<
        string,
        Set<ReadableStreamDefaultController<Uint8Array>>
      >(),
    };
  }

  return globalThis.__coquiEncuestasStore;
}

function normalizeRoomCode(roomCode: string) {
  return roomCode
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "");
}

function uniqueRoomCode(preferredRoomCode?: string) {
  const store = getStore();
  const preferred = preferredRoomCode
    ? normalizeRoomCode(preferredRoomCode)
    : "";

  if (preferred && !store.rooms.has(preferred)) {
    return preferred;
  }

  let nextRoomCode = generateRoomCode();
  while (store.rooms.has(nextRoomCode)) {
    nextRoomCode = generateRoomCode();
  }

  return nextRoomCode;
}

function publishRoom(room: QuizRoom) {
  const store = getStore();
  store.rooms.set(room.roomCode, room);

  const subscribers = store.subscribers.get(room.roomCode);
  if (!subscribers || subscribers.size === 0) {
    return room;
  }

  const payload = encoder.encode(`data: ${JSON.stringify(room)}\n\n`);
  const closedControllers: ReadableStreamDefaultController<Uint8Array>[] = [];

  for (const controller of subscribers) {
    try {
      controller.enqueue(payload);
    } catch {
      closedControllers.push(controller);
    }
  }

  for (const controller of closedControllers) {
    subscribers.delete(controller);
  }

  return room;
}

export function getRoom(roomCode: string) {
  return getStore().rooms.get(normalizeRoomCode(roomCode)) ?? null;
}

export function createRoom(input: {
  title: string;
  hostName: string;
  roomCode?: string;
  questions: QuizQuestion[];
}) {
  const roomCode = uniqueRoomCode(input.roomCode);
  const room = createLiveRoom({
    title: input.title,
    hostName: input.hostName,
    questions: input.questions.map(normalizeQuestion),
  });

  return publishRoom({
    ...room,
    roomCode,
  });
}

export function updateRoom(
  roomCode: string,
  updater: (room: QuizRoom) => QuizRoom,
) {
  const currentRoom = getRoom(roomCode);
  if (!currentRoom) {
    return null;
  }

  return publishRoom(updater(currentRoom));
}

export function joinRoom(
  roomCode: string,
  participantName: string,
  participantId: string,
) {
  return updateRoom(roomCode, (room) =>
    addOrUpdateParticipant(room, participantId, participantName),
  );
}

export function voteInRoom(
  roomCode: string,
  participantId: string,
  questionId: string,
  option: string,
) {
  return updateRoom(roomCode, (room) =>
    recordVote(room, participantId, questionId, option),
  );
}

export function advanceRoom(roomCode: string) {
  return updateRoom(roomCode, advanceQuestion);
}

export function rewindRoom(roomCode: string) {
  return updateRoom(roomCode, rewindQuestion);
}

export function closeRoom(roomCode: string) {
  return updateRoom(roomCode, (room) => ({
    ...room,
    status: "finished",
  }));
}

export function subscribeToRoom(
  roomCode: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
) {
  const store = getStore();
  const normalizedRoomCode = normalizeRoomCode(roomCode);
  const subscribers = store.subscribers.get(normalizedRoomCode) ?? new Set();
  subscribers.add(controller);
  store.subscribers.set(normalizedRoomCode, subscribers);

  const currentRoom = store.rooms.get(normalizedRoomCode);
  if (currentRoom) {
    controller.enqueue(
      encoder.encode(`data: ${JSON.stringify(currentRoom)}\n\n`),
    );
  }

  return () => {
    subscribers.delete(controller);
    if (subscribers.size === 0) {
      store.subscribers.delete(normalizedRoomCode);
    }
  };
}

export function createRoomEventStream(roomCode: string) {
  const normalizedRoomCode = normalizeRoomCode(roomCode);
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let unsubscribe = () => {};

  return new ReadableStream<Uint8Array>({
    start(controller) {
      const store = getStore();
      if (!store.rooms.has(normalizedRoomCode)) {
        controller.error(new Error("Room not found"));
        return;
      }

      unsubscribe = subscribeToRoom(normalizedRoomCode, controller);
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          if (heartbeat) {
            clearInterval(heartbeat);
          }
          unsubscribe();
        }
      }, 15000);

      controller.enqueue(encoder.encode(`: connected\n\n`));
    },
    cancel() {
      if (heartbeat) {
        clearInterval(heartbeat);
      }

      unsubscribe();
    },
  });
}
