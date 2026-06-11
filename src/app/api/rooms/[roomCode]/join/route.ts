import { NextResponse } from "next/server";
import { joinRoom } from "@/lib/room-store";

export const runtime = "nodejs";

type JoinRoomBody = {
  participantName: string;
  participantId: string;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomCode: string }> },
) {
  const { roomCode } = await params;
  const body = (await request.json()) as JoinRoomBody;

  if (!body.participantId?.trim()) {
    return NextResponse.json(
      { error: "A participant id is required." },
      { status: 400 },
    );
  }

  const room = await joinRoom(
    roomCode,
    body.participantName,
    body.participantId,
  );
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  return NextResponse.json({ room, participantId: body.participantId });
}
