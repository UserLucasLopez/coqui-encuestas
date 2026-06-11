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
import { GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { getDynamoDocumentClient, getRoomsTableName } from "@/lib/dynamodb";

const ROOM_TTL_SECONDS = 60 * 60 * 24;
const MAX_UPDATE_RETRIES = 6;

type RoomRecord = {
  roomCode: string;
  room: QuizRoom;
  version: number;
  ttl: number;
};

export type AvailableRoom = {
  roomCode: string;
  title: string;
  hostName: string;
  participantCount: number;
  status: QuizRoom["status"];
  createdAt: number;
};

type LocalStore = {
  rooms: Map<string, RoomRecord>;
};

declare global {
  // eslint-disable-next-line no-var
  var __coquiEncuestasLocalStore: LocalStore | undefined;
}

function isDevelopmentMode() {
  return process.env.NODE_ENV !== "production";
}

function getLocalStore() {
  if (!globalThis.__coquiEncuestasLocalStore) {
    globalThis.__coquiEncuestasLocalStore = {
      rooms: new Map<string, RoomRecord>(),
    };
  }

  return globalThis.__coquiEncuestasLocalStore;
}

function normalizeRoomCode(roomCode: string) {
  return roomCode
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "");
}

function computeTtl() {
  return Math.floor(Date.now() / 1000) + ROOM_TTL_SECONDS;
}

function buildRecord(room: QuizRoom, version: number): RoomRecord {
  return {
    roomCode: room.roomCode,
    room,
    version,
    ttl: computeTtl(),
  };
}

function toAvailableRoom(room: QuizRoom): AvailableRoom {
  return {
    roomCode: room.roomCode,
    title: room.title,
    hostName: room.hostName,
    participantCount: room.participants.length,
    status: room.status,
    createdAt: room.createdAt,
  };
}

async function getRoomRecord(roomCode: string) {
  const normalizedRoomCode = normalizeRoomCode(roomCode);

  if (isDevelopmentMode()) {
    return getLocalStore().rooms.get(normalizedRoomCode) ?? null;
  }

  const client = getDynamoDocumentClient();
  const tableName = getRoomsTableName();

  const response = await client.send(
    new GetCommand({
      TableName: tableName,
      Key: { roomCode: normalizedRoomCode },
      ConsistentRead: true,
    }),
  );

  return (response.Item as RoomRecord | undefined) ?? null;
}

async function tryCreateRoom(roomCode: string, room: QuizRoom) {
  const normalizedRoomCode = normalizeRoomCode(roomCode);

  if (isDevelopmentMode()) {
    const store = getLocalStore();
    if (store.rooms.has(normalizedRoomCode)) {
      return false;
    }

    store.rooms.set(
      normalizedRoomCode,
      buildRecord({ ...room, roomCode: normalizedRoomCode }, 1),
    );
    return true;
  }

  const client = getDynamoDocumentClient();
  const tableName = getRoomsTableName();

  try {
    await client.send(
      new PutCommand({
        TableName: tableName,
        Item: buildRecord({ ...room, roomCode: normalizedRoomCode }, 1),
        ConditionExpression: "attribute_not_exists(roomCode)",
      }),
    );

    return true;
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      return false;
    }

    throw error;
  }
}

export async function getRoom(roomCode: string) {
  const record = await getRoomRecord(roomCode);
  return record?.room ?? null;
}

export async function listRooms() {
  if (isDevelopmentMode()) {
    return [...getLocalStore().rooms.values()]
      .map((record) => record.room)
      .filter((room) => room.status === "live")
      .sort((leftRoom, rightRoom) => rightRoom.createdAt - leftRoom.createdAt)
      .map(toAvailableRoom);
  }

  const client = getDynamoDocumentClient();
  const tableName = getRoomsTableName();
  const response = await client.send(
    new ScanCommand({
      TableName: tableName,
      ProjectionExpression: "roomCode, room",
    }),
  );

  return ((response.Items as RoomRecord[] | undefined) ?? [])
    .map((record) => record.room)
    .filter((room) => room.status === "live")
    .sort((leftRoom, rightRoom) => rightRoom.createdAt - leftRoom.createdAt)
    .map(toAvailableRoom);
}

export async function createRoom(input: {
  title: string;
  hostName: string;
  roomCode?: string;
  questions: QuizQuestion[];
}) {
  const preferredRoomCode = input.roomCode
    ? normalizeRoomCode(input.roomCode)
    : "";
  const roomTemplate = createLiveRoom({
    title: input.title,
    hostName: input.hostName,
    questions: input.questions.map(normalizeQuestion),
  });

  if (preferredRoomCode) {
    const created = await tryCreateRoom(preferredRoomCode, roomTemplate);
    if (created) {
      return {
        ...roomTemplate,
        roomCode: preferredRoomCode,
      };
    }
  }

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const generatedRoomCode = generateRoomCode();
    const created = await tryCreateRoom(generatedRoomCode, roomTemplate);

    if (created) {
      return {
        ...roomTemplate,
        roomCode: generatedRoomCode,
      };
    }
  }

  throw new Error("Unable to allocate a unique room code.");
}

export async function updateRoom(
  roomCode: string,
  updater: (room: QuizRoom) => QuizRoom,
) {
  const normalizedRoomCode = normalizeRoomCode(roomCode);

  if (isDevelopmentMode()) {
    const store = getLocalStore();
    const currentRecord = store.rooms.get(normalizedRoomCode);
    if (!currentRecord) {
      return null;
    }

    const nextRoom = updater(currentRecord.room);
    store.rooms.set(
      normalizedRoomCode,
      buildRecord(
        { ...nextRoom, roomCode: normalizedRoomCode },
        currentRecord.version + 1,
      ),
    );

    return nextRoom;
  }

  const client = getDynamoDocumentClient();
  const tableName = getRoomsTableName();

  for (let attempt = 0; attempt < MAX_UPDATE_RETRIES; attempt += 1) {
    const currentRecord = await getRoomRecord(normalizedRoomCode);
    if (!currentRecord) {
      return null;
    }

    const nextRoom = updater(currentRecord.room);
    const nextVersion = currentRecord.version + 1;

    try {
      await client.send(
        new PutCommand({
          TableName: tableName,
          Item: buildRecord(nextRoom, nextVersion),
          ConditionExpression: "version = :expectedVersion",
          ExpressionAttributeValues: {
            ":expectedVersion": currentRecord.version,
          },
        }),
      );

      return nextRoom;
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("Failed to update room due to concurrent writes.");
}

export async function joinRoom(
  roomCode: string,
  participantName: string,
  participantId: string,
) {
  return updateRoom(roomCode, (room) =>
    addOrUpdateParticipant(room, participantId, participantName),
  );
}

export async function voteInRoom(
  roomCode: string,
  participantId: string,
  questionId: string,
  option: string,
) {
  return updateRoom(roomCode, (room) =>
    recordVote(room, participantId, questionId, option),
  );
}

export async function advanceRoom(roomCode: string) {
  return updateRoom(roomCode, advanceQuestion);
}

export async function rewindRoom(roomCode: string) {
  return updateRoom(roomCode, rewindQuestion);
}

export async function closeRoom(roomCode: string) {
  return updateRoom(roomCode, (room) => ({
    ...room,
    status: "finished",
  }));
}
