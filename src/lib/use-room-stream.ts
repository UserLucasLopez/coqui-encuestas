"use client";

import { useCallback, useEffect, useState } from "react";
import type { QuizRoom } from "@/lib/quiz";

const POLL_INTERVAL_MS = 1500;

export function useRoomStream(roomCode: string | null) {
  const [room, setRoom] = useState<QuizRoom | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshRoom = useCallback(async () => {
    if (!roomCode) {
      setRoom(null);
      setError(null);
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
    let inFlight = false;

    const pollRoom = async () => {
      if (cancelled || inFlight) {
        return;
      }

      inFlight = true;

      try {
        await refreshRoom();
      } finally {
        inFlight = false;
      }
    };

    void pollRoom();
    const pollTimer = window.setInterval(() => {
      void pollRoom();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(pollTimer);
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
