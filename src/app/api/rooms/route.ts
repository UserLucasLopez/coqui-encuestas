import { NextResponse } from "next/server";
import { createRoom } from "@/lib/room-store";
import type { QuizQuestion } from "@/lib/quiz";

export const runtime = "nodejs";

type CreateRoomBody = {
  title: string;
  hostName: string;
  roomCode?: string;
  questions: QuizQuestion[];
};

export async function POST(request: Request) {
  const body = (await request.json()) as CreateRoomBody;

  if (
    !body.title?.trim() ||
    !body.hostName?.trim() ||
    !Array.isArray(body.questions) ||
    body.questions.length === 0
  ) {
    return NextResponse.json(
      { error: "A title, host name, and at least one question are required." },
      { status: 400 },
    );
  }

  const room = await createRoom({
    title: body.title,
    hostName: body.hostName,
    roomCode: body.roomCode,
    questions: body.questions,
  });

  return NextResponse.json(room);
}
