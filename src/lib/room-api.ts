import type { QuizQuestion, QuizRoom } from "@/lib/quiz";

export type AvailableRoom = {
  roomCode: string;
  title: string;
  hostName: string;
  participantCount: number;
  status: "live" | "finished";
  createdAt: number;
};

async function requestJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(
      (await response.text()) || `Request failed with ${response.status}`,
    );
  }

  return (await response.json()) as T;
}

export function createRoomRequest(input: {
  title: string;
  hostName: string;
  roomCode: string;
  questions: QuizQuestion[];
}) {
  return requestJson<QuizRoom>("/api/rooms", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listRoomsRequest() {
  return requestJson<AvailableRoom[]>("/api/rooms", { method: "GET" });
}

export function getRoomRequest(roomCode: string) {
  return requestJson<QuizRoom>(`/api/rooms/${roomCode}`, { method: "GET" });
}

export function joinRoomRequest(input: {
  roomCode: string;
  participantName: string;
  participantId: string;
}) {
  return requestJson<{ room: QuizRoom; participantId: string }>(
    `/api/rooms/${input.roomCode}/join`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function voteRequest(input: {
  roomCode: string;
  participantId: string;
  questionId: string;
  option: string;
}) {
  return requestJson<QuizRoom>(`/api/rooms/${input.roomCode}/vote`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function advanceRoomRequest(roomCode: string) {
  return requestJson<QuizRoom>(`/api/rooms/${roomCode}/advance`, {
    method: "POST",
  });
}

export function rewindRoomRequest(roomCode: string) {
  return requestJson<QuizRoom>(`/api/rooms/${roomCode}/rewind`, {
    method: "POST",
  });
}

export function closeRoomRequest(roomCode: string) {
  return requestJson<QuizRoom>(`/api/rooms/${roomCode}/close`, {
    method: "POST",
  });
}
