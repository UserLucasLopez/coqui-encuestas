import { NextResponse } from "next/server";
import { voteInRoom } from "@/lib/room-store";

export const runtime = "nodejs";

type VoteBody = {
  participantId: string;
  questionId: string;
  option: string;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomCode: string }> },
) {
  const { roomCode } = await params;
  const body = (await request.json()) as VoteBody;

  if (
    !body.participantId?.trim() ||
    !body.questionId?.trim() ||
    !body.option?.trim()
  ) {
    return NextResponse.json(
      { error: "participantId, questionId, and option are required." },
      { status: 400 },
    );
  }

  const room = voteInRoom(
    roomCode,
    body.participantId,
    body.questionId,
    body.option,
  );
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  return NextResponse.json(room);
}
