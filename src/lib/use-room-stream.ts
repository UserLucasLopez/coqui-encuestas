"use client";

import { useCallback, useEffect, useState } from "react";
import type { QuizRoom } from "@/lib/quiz";

export function useRoomStream(roomCode: string | null) {
  const [room, setRoom] = useState<QuizRoom | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshRoom = useCallback(async () => {
    if (!roomCode) {
      setRoom(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/rooms/${roomCode}`);
      if (!response.ok) {
        if (response.status === 404) {
          setRoom(null);
          return;
        }

        throw new Error(
          (await response.text()) || `Request failed with ${response.status}`,
        );
      }

      setRoom((await response.json()) as QuizRoom);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Unable to load room",
      );
    } finally {
      setLoading(false);
    }
  }, [roomCode]);

  useEffect(() => {
    if (!roomCode) {
      setRoom(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const eventSource = new EventSource(`/api/rooms/${roomCode}/events`);

    eventSource.onmessage = (event) => {
      if (cancelled) {
        return;
      }

      setRoom(JSON.parse(event.data) as QuizRoom);
    };

    eventSource.onerror = () => {
      if (!cancelled) {
        setError("Live connection interrupted. Reconnecting...");
      }
    };

    void refreshRoom();

    return () => {
      cancelled = true;
      eventSource.close();
    };
  }, [refreshRoom, roomCode]);

  return {
    room,
    loading,
    error,
    refreshRoom,
    setRoom,
  };
}
