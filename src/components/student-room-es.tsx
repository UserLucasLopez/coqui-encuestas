"use client";

import { useEffect, useMemo, useState } from "react";
import { createId, getQuestionScores, type QuizRoom } from "@/lib/quiz";
import { joinRoomRequest, voteRequest } from "@/lib/room-api";
import { useRoomStream } from "@/lib/use-room-stream";

type StudentState = {
  roomCode: string;
  participantName: string;
  participantId: string;
  joinedRoomCode: string | null;
};

const STORAGE_KEY = "coqui-encuestas-student-state-es";

function sanitizeRoomCode(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 8);
}

function defaultState(): StudentState {
  return {
    roomCode: "",
    participantName: "Estudiante",
    participantId: createId("student"),
    joinedRoomCode: null,
  };
}

export function StudentRoom() {
  const [state, setState] = useState<StudentState>(defaultState);
  const [notice, setNotice] = useState(
    "Únete a una sala publicada y vota sobre la pregunta activa.",
  );
  const { room, loading, error, setRoom } = useRoomStream(state.joinedRoomCode);

  useEffect(() => {
    try {
      const rawState = window.localStorage.getItem(STORAGE_KEY);
      if (!rawState) {
        return;
      }

      const parsed = JSON.parse(rawState) as Partial<StudentState>;
      setState((currentState) => ({
        ...currentState,
        ...parsed,
        participantId: parsed.participantId || currentState.participantId,
        roomCode: parsed.roomCode
          ? sanitizeRoomCode(parsed.roomCode)
          : currentState.roomCode,
      }));
    } catch {
      // Ignore bad saved state.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const currentQuestion = room?.questions[room.activeQuestionIndex] ?? null;
  const scores = useMemo(
    () => getQuestionScores(room, currentQuestion?.id),
    [currentQuestion?.id, room],
  );
  const joinedParticipant =
    room?.participants.find(
      (participant) => participant.id === state.participantId,
    ) ?? null;
  const hasJoined = Boolean(
    room && state.joinedRoomCode === room.roomCode && joinedParticipant,
  );

  const joinRoom = async () => {
    if (!state.roomCode.trim()) {
      setNotice("Ingresa un código de sala primero.");
      return;
    }

    try {
      const response = await joinRoomRequest({
        roomCode: sanitizeRoomCode(state.roomCode),
        participantName: state.participantName.trim() || "Estudiante",
        participantId: state.participantId,
      });

      setState((currentState) => ({
        ...currentState,
        roomCode: response.room.roomCode,
        joinedRoomCode: response.room.roomCode,
        participantId: response.participantId,
      }));
      setRoom(response.room);
      setNotice(`Te uniste a la sala ${response.room.roomCode}.`);
    } catch (joinError) {
      setNotice(
        joinError instanceof Error
          ? joinError.message
          : "No se pudo unir a la sala.",
      );
    }
  };

  const vote = async (option: string) => {
    if (!room || !currentQuestion || !hasJoined) {
      return;
    }

    try {
      const nextRoom = await voteRequest({
        roomCode: room.roomCode,
        participantId: state.participantId,
        questionId: currentQuestion.id,
        option,
      });

      setRoom(nextRoom);
      setNotice(`Votaste por ${option}.`);
    } catch (voteError) {
      setNotice(
        voteError instanceof Error
          ? voteError.message
          : "No se pudo registrar tu voto.",
      );
    }
  };

  const participantNames =
    room?.participants
      .filter((participant) => participant.votes[currentQuestion?.id ?? ""])
      .map((participant) => participant.name) ?? [];

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_#fff7e8_0%,_#f2f0ea_40%,_#e8ecf4_100%)] text-slate-950">
      <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:linear-gradient(rgba(10,10,10,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(10,10,10,0.05)_1px,transparent_1px)] [background-size:42px_42px]" />
      <div className="pointer-events-none absolute -left-24 top-16 h-72 w-72 rounded-full bg-emerald-300/35 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-36 h-80 w-80 rounded-full bg-cyan-300/30 blur-3xl" />

      <section className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-6 py-8 lg:px-10">
        <header className="flex flex-col gap-6 rounded-[2rem] border border-white/70 bg-white/75 p-6 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur md:p-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl space-y-4">
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-white">
                Sala de estudiantes
              </span>
              <h1 className="text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
                Únete a la sala y vota en vivo.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-600 md:text-lg">
                Ingresa el código de tu profesor, conéctate a la sala en vivo y
                responde preguntas mientras solo se revelan los resultados.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 md:min-w-[28rem]">
              <StatCard
                label="Sala"
                value={(room?.roomCode ?? state.roomCode) || "-"}
                tone="slate"
              />
              <StatCard
                label="Votos"
                value={String(
                  room?.participants.filter(
                    (participant) =>
                      participant.votes[currentQuestion?.id ?? ""],
                  ).length ?? 0,
                )}
                tone="emerald"
              />
              <StatCard
                label="Estado"
                value={room?.status ?? "idle"}
                tone="cyan"
              />
            </div>
          </div>

          <p className="rounded-2xl border border-slate-200 bg-slate-950 px-4 py-3 text-sm text-white">
            {notice}
            {error ? ` ${error}` : ""}
          </p>
        </header>

        <div className="grid flex-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-[2rem] border border-slate-200 bg-white/80 p-6 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-4">
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">
                Unirse a sala
              </p>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
                Conecta tu identidad de estudiante
              </h2>
            </div>

            <div className="mt-6 space-y-4">
              <Field
                label="Nombre del estudiante"
                value={state.participantName}
                onChange={(value) =>
                  setState((currentState) => ({
                    ...currentState,
                    participantName: value,
                  }))
                }
                placeholder="Alex"
              />
              <Field
                label="Código de sala"
                value={state.roomCode}
                onChange={(value) =>
                  setState((currentState) => ({
                    ...currentState,
                    roomCode: sanitizeRoomCode(value),
                  }))
                }
                placeholder="KQ-1234"
                maxLength={8}
              />

              <button
                type="button"
                onClick={() => void joinRoom()}
                className="w-full rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Unirse a sala
              </button>
            </div>

            <div className="mt-6 rounded-[1.4rem] border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
              Una vez que te unas, tus votos actualizan el panel de control del
              profesor en tiempo real a través del flujo del servidor.
            </div>
          </section>

          <section className="grid gap-6">
            <article className="rounded-[2rem] border border-slate-200 bg-white/80 p-6 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur">
              <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-slate-500">
                    Pregunta en vivo
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    {currentQuestion
                      ? currentQuestion.prompt
                      : "Esperando una sala en vivo"}
                  </h3>
                </div>
                <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-white">
                  {hasJoined
                    ? "Conectado"
                    : loading
                      ? "Conectando"
                      : "Esperando"}
                </span>
              </div>

              {!currentQuestion ? (
                <div className="mt-5 rounded-[1.4rem] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                  Únete a una sala en vivo para ver la pregunta actual y las
                  opciones de respuesta.
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {currentQuestion.options.map((option, optionIndex) => {
                      const selected =
                        joinedParticipant?.votes[currentQuestion.id] === option;

                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => void vote(option)}
                          className={`rounded-[1.4rem] border p-4 text-left transition ${
                            selected
                              ? "border-cyan-400 bg-cyan-50 shadow-[0_12px_40px_rgba(34,211,238,0.18)]"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">
                              Opción {optionIndex + 1}
                            </span>
                            {selected && (
                              <span className="rounded-full bg-slate-950 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-white">
                                Tu voto
                              </span>
                            )}
                          </div>
                          <p className="mt-3 text-lg font-medium text-slate-950">
                            {option}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  <div className="rounded-[1.4rem] bg-slate-950 p-5 text-white">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
                          Resultados de estudiantes
                        </p>
                        <h4 className="mt-2 text-2xl font-semibold">
                          Distribución en vivo
                        </h4>
                      </div>
                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-slate-200">
                        {scores.reduce((sum, score) => sum + score.count, 0)}{" "}
                        votos
                      </span>
                    </div>

                    <div className="mt-5 space-y-3">
                      {scores.map((result) => (
                        <div key={result.option} className="space-y-2">
                          <div className="flex items-center justify-between gap-4 text-sm text-slate-300">
                            <span>{result.option}</span>
                            <span>
                              {result.count} voto{result.count === 1 ? "" : "s"}{" "}
                              · {result.percent}%
                            </span>
                          </div>
                          <div className="h-3 overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-cyan-300 to-amber-300 transition-all"
                              style={{
                                width: `${Math.max(result.percent, result.count > 0 ? 12 : 0)}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </article>

            <article className="rounded-[2rem] border border-slate-200 bg-white/80 p-6 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur">
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">
                Quién votó
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {participantNames.length > 0 ? (
                  participantNames.map((name) => (
                    <span
                      key={name}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-600"
                    >
                      {name}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">
                    Nadie ha votado sobre la pregunta actual todavía.
                  </p>
                )}
              </div>
            </article>
          </section>
        </div>
      </section>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  maxLength?: number;
}) {
  return (
    <label className="space-y-2">
      <span className="text-xs uppercase tracking-[0.3em] text-slate-500">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-400"
      />
    </label>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "slate" | "emerald" | "cyan";
}) {
  const toneClasses = {
    slate: "bg-slate-950 text-white",
    emerald: "bg-emerald-300 text-slate-950",
    cyan: "bg-cyan-300 text-slate-950",
  };

  return (
    <div className={`rounded-3xl p-4 shadow-sm ${toneClasses[tone]}`}>
      <p className="text-xs uppercase tracking-[0.28em] opacity-70">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}
