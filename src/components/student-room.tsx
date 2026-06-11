"use client";

import { useEffect, useState } from "react";
import { createFunnyStudentName, createId } from "@/lib/quiz";
import {
  joinRoomRequest,
  listRoomsRequest,
  type AvailableRoom,
  voteRequest,
} from "@/lib/room-api";
import { useRoomStream } from "@/lib/use-room-stream";

type StudentState = {
  roomCode: string;
  participantName: string;
  participantId: string;
  joinedRoomCode: string | null;
};

type Locale = "en" | "es";

type StudentRoomText = {
  genericNames: string[];
  noticeJoin: string;
  noticeCodeFirst: string;
  noticeJoined: string;
  noticeJoinError: string;
  noticeVoted: string;
  noticeVoteError: string;
  roomLoadError: string;
  headerBadge: string;
  headerTitle: string;
  headerDescription: string;
  cardRoom: string;
  cardLiveRooms: string;
  cardStatus: string;
  cardReady: string;
  inConnected: string;
  inConnecting: string;
  inWaiting: string;
  inRoomPrefix: string;
  inWaitingQuestion: string;
  inQuestionLabel: string;
  inQuestionOf: string;
  inFinished: string;
  inNoQuestion: string;
  choice: string;
  yourVote: string;
  availableRooms: string;
  joinLiveClass: string;
  refresh: string;
  loadingRooms: string;
  hostedBy: string;
  join: string;
  studentsInsideSuffix: string;
  studentSingular: string;
  studentPlural: string;
  noRooms: string;
  joinWithCode: string;
  keepRosterFun: string;
  defaultAlias: string;
  aliasDescription: string;
  studentName: string;
  roomCode: string;
  joinRoom: string;
  studentPlaceholder: string;
  leaveRoom: string;
  roomClosedReturn: string;
};

const STORAGE_KEY = "coqui-encuestas-student-state";

const TEXT: Record<Locale, StudentRoomText> = {
  en: {
    genericNames: ["Student", "Anonymous"],
    noticeJoin: "Join a published room and vote on the active question.",
    noticeCodeFirst: "Enter a room code first.",
    noticeJoined: "Joined room",
    noticeJoinError: "Unable to join the room.",
    noticeVoted: "You voted for",
    noticeVoteError: "Unable to record your vote.",
    roomLoadError: "Unable to load rooms.",
    headerBadge: "Student room",
    headerTitle: "Pick a room and jump in.",
    headerDescription:
      "Start with an available room or use a room code. Your name is prefilled with a funny alias so the roster stays readable.",
    cardRoom: "Room",
    cardLiveRooms: "Live rooms",
    cardStatus: "Status",
    cardReady: "ready",
    inConnected: "Connected",
    inConnecting: "Connecting",
    inWaiting: "Waiting",
    inRoomPrefix: "Room",
    inWaitingQuestion: "Waiting for the next question",
    inQuestionLabel: "Question",
    inQuestionOf: "of",
    inFinished: "The room has finished. Your latest vote has been saved.",
    inNoQuestion:
      "Your teacher has not opened a question yet. Keep this screen open and the quiz will appear automatically.",
    choice: "Choice",
    yourVote: "Your vote",
    availableRooms: "Available rooms",
    joinLiveClass: "Join a live class",
    refresh: "Refresh",
    loadingRooms: "Loading live rooms...",
    hostedBy: "Hosted by",
    join: "Join",
    studentsInsideSuffix: "inside",
    studentSingular: "student",
    studentPlural: "students",
    noRooms:
      "No live rooms are available right now. You can still join with a room code.",
    joinWithCode: "Join with a code",
    keepRosterFun: "Keep the roster fun",
    defaultAlias: "Default alias",
    aliasDescription:
      "Change it if you want, or keep the funny name so every student stays distinct.",
    studentName: "Student name",
    roomCode: "Room code",
    joinRoom: "Join room",
    studentPlaceholder: "Turbo Taco",
    leaveRoom: "Leave room",
    roomClosedReturn: "Room was closed. Back to lobby.",
  },
  es: {
    genericNames: ["Estudiante", "Anonimo", "Anonymous"],
    noticeJoin: "Unete a una sala publicada y vota sobre la pregunta activa.",
    noticeCodeFirst: "Ingresa un codigo de sala primero.",
    noticeJoined: "Te uniste a la sala",
    noticeJoinError: "No se pudo unir a la sala.",
    noticeVoted: "Votaste por",
    noticeVoteError: "No se pudo registrar tu voto.",
    roomLoadError: "No se pudieron cargar las salas.",
    headerBadge: "Sala de estudiantes",
    headerTitle: "Elige una sala y entra rapido.",
    headerDescription:
      "Empieza con una sala disponible o con un codigo. Tu nombre llega con un alias divertido para evitar estudiantes repetidos.",
    cardRoom: "Sala",
    cardLiveRooms: "Salas activas",
    cardStatus: "Estado",
    cardReady: "listo",
    inConnected: "Conectado",
    inConnecting: "Conectando",
    inWaiting: "Esperando",
    inRoomPrefix: "Sala",
    inWaitingQuestion: "Esperando la siguiente pregunta",
    inQuestionLabel: "Pregunta",
    inQuestionOf: "de",
    inFinished: "La sala ya termino. Tu ultimo voto quedo guardado.",
    inNoQuestion:
      "Tu profesor todavia no abre una pregunta. Deja esta pantalla abierta y el quiz aparecera automaticamente.",
    choice: "Opcion",
    yourVote: "Tu voto",
    availableRooms: "Salas disponibles",
    joinLiveClass: "Entra a una clase en vivo",
    refresh: "Actualizar",
    loadingRooms: "Cargando salas activas...",
    hostedBy: "Guiada por",
    join: "Entrar",
    studentsInsideSuffix: "dentro",
    studentSingular: "estudiante",
    studentPlural: "estudiantes",
    noRooms:
      "No hay salas activas ahora mismo. Igual puedes entrar con un codigo.",
    joinWithCode: "Entrar con codigo",
    keepRosterFun: "Mantengamos la lista divertida",
    defaultAlias: "Alias por defecto",
    aliasDescription:
      "Cambialo si quieres, o deja el nombre divertido para que nadie aparezca como estudiante repetido.",
    studentName: "Nombre del estudiante",
    roomCode: "Codigo de sala",
    joinRoom: "Unirse a sala",
    studentPlaceholder: "Turbo Taco",
    leaveRoom: "Salir de la sala",
    roomClosedReturn: "La sala fue cerrada. Volviste al inicio.",
  },
};

function sanitizeRoomCode(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 8);
}

function defaultState(locale: Locale): StudentState {
  return {
    roomCode: "",
    participantName: locale === "es" ? "Estudiante" : "Student",
    participantId: "",
    joinedRoomCode: null,
  };
}

export function StudentRoom({ locale = "en" }: { locale?: Locale }) {
  const t = TEXT[locale];
  const storageKey = `${STORAGE_KEY}-${locale}`;

  const [state, setState] = useState<StudentState>(() => defaultState(locale));
  const [notice, setNotice] = useState<string>(t.noticeJoin);
  const [availableRooms, setAvailableRooms] = useState<AvailableRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const { room, loading, error, setRoom } = useRoomStream(state.joinedRoomCode);

  useEffect(() => {
    try {
      const rawState = window.localStorage.getItem(storageKey);
      const fallbackName = createFunnyStudentName(locale);
      const fallbackParticipantId = createId("student");

      if (!rawState) {
        setState((currentState) => ({
          ...currentState,
          participantName: fallbackName,
          participantId: fallbackParticipantId,
        }));
        return;
      }

      const parsed = JSON.parse(rawState) as Partial<StudentState>;
      const nextName = parsed.participantName?.trim();

      setState((currentState) => ({
        ...currentState,
        ...parsed,
        participantName:
          nextName && !t.genericNames.includes(nextName)
            ? nextName
            : fallbackName,
        participantId: parsed.participantId || fallbackParticipantId,
        roomCode: parsed.roomCode
          ? sanitizeRoomCode(parsed.roomCode)
          : currentState.roomCode,
      }));
    } catch {
      // Ignore bad saved state.
    }
  }, [locale, storageKey, t.genericNames]);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [state, storageKey]);

  const hasJoined = Boolean(state.joinedRoomCode);

  useEffect(() => {
    if (hasJoined) {
      return;
    }

    const controller = new AbortController();

    const loadRooms = async () => {
      setRoomsLoading(true);
      setRoomsError(null);

      try {
        const rooms = await listRoomsRequest();
        if (!controller.signal.aborted) {
          setAvailableRooms(rooms);
        }
      } catch (roomsLoadError) {
        if (!controller.signal.aborted) {
          setRoomsError(
            roomsLoadError instanceof Error
              ? roomsLoadError.message
              : t.roomLoadError,
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setRoomsLoading(false);
        }
      }
    };

    void loadRooms();

    return () => {
      controller.abort();
    };
  }, [hasJoined, t.roomLoadError]);

  const currentQuestion = room?.questions[room.activeQuestionIndex] ?? null;
  const joinedParticipant =
    room?.participants.find(
      (participant) => participant.id === state.participantId,
    ) ?? null;
  const isConnected = Boolean(
    room && state.joinedRoomCode === room.roomCode && joinedParticipant,
  );

  const leaveRoom = (message?: string) => {
    setState((currentState) => ({
      ...currentState,
      joinedRoomCode: null,
    }));
    setRoom(null);
    setNotice(message ?? t.noticeJoin);
  };

  useEffect(() => {
    if (hasJoined && room?.status === "finished") {
      leaveRoom(t.roomClosedReturn);
    }
  }, [hasJoined, room?.status, t.roomClosedReturn]);

  const joinRoom = async (roomCode = state.roomCode) => {
    const normalizedRoomCode = sanitizeRoomCode(roomCode);
    if (!normalizedRoomCode) {
      setNotice(t.noticeCodeFirst);
      return;
    }

    const fallbackName =
      state.participantName.trim() || createFunnyStudentName(locale);
    const participantId = state.participantId || createId("student");

    try {
      const response = await joinRoomRequest({
        roomCode: normalizedRoomCode,
        participantName: fallbackName,
        participantId,
      });

      setState((currentState) => ({
        ...currentState,
        participantName: currentState.participantName.trim() || fallbackName,
        roomCode: response.room.roomCode,
        joinedRoomCode: response.room.roomCode,
        participantId: response.participantId || participantId,
      }));
      setRoom(response.room);
      setNotice(`${t.noticeJoined} ${response.room.roomCode}.`);
    } catch (joinError) {
      setNotice(
        joinError instanceof Error ? joinError.message : t.noticeJoinError,
      );
    }
  };

  const vote = async (option: string) => {
    if (!room || !currentQuestion || !isConnected) {
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
      setNotice(`${t.noticeVoted} ${option}.`);
    } catch (voteError) {
      setNotice(
        voteError instanceof Error ? voteError.message : t.noticeVoteError,
      );
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_#fff7e8_0%,_#f2f0ea_40%,_#e8ecf4_100%)] text-slate-950">
      <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:linear-gradient(rgba(10,10,10,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(10,10,10,0.05)_1px,transparent_1px)] [background-size:42px_42px]" />
      <div className="pointer-events-none absolute -left-24 top-16 h-72 w-72 rounded-full bg-emerald-300/35 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-36 h-80 w-80 rounded-full bg-cyan-300/30 blur-3xl" />

      <section className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        {!hasJoined ? (
          <header className="flex flex-col gap-6 rounded-[2rem] border border-white/70 bg-white/75 p-6 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur md:p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="max-w-3xl space-y-4">
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-white">
                  {t.headerBadge}
                </span>
                <h1 className="text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
                  {t.headerTitle}
                </h1>
                <p className="max-w-2xl text-base leading-7 text-slate-600 md:text-lg">
                  {t.headerDescription}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 md:min-w-[24rem]">
                <StatCard
                  label={t.cardRoom}
                  value={(room?.roomCode ?? state.roomCode) || "-"}
                  tone="slate"
                />
                <StatCard
                  label={hasJoined ? t.studentName : t.cardLiveRooms}
                  value={
                    hasJoined
                      ? state.participantName
                      : String(availableRooms.length)
                  }
                  tone="emerald"
                />
                <StatCard
                  label={t.cardStatus}
                  value={hasJoined ? (room?.status ?? "loading") : t.cardReady}
                  tone="cyan"
                />
              </div>
            </div>

            <p className="rounded-2xl border border-slate-200 bg-slate-950 px-4 py-3 text-sm text-white">
              {notice}
              {error ? ` ${error}` : ""}
            </p>
          </header>
        ) : null}

        {hasJoined ? (
          <article className="rounded-[2rem] border border-slate-200 bg-white/85 p-5 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur sm:p-6">
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-4">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => leaveRoom()}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  {t.leaveRoom}
                </button>
              </div>
              <p className="rounded-2xl border border-slate-200 bg-slate-950 px-4 py-3 text-sm text-white">
                {notice}
                {error ? ` ${error}` : ""}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-white">
                  {isConnected
                    ? t.inConnected
                    : loading
                      ? t.inConnecting
                      : t.inWaiting}
                </span>
                {room && (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                    {room.title}
                  </span>
                )}
              </div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">
                {room
                  ? `${t.inRoomPrefix} ${room.roomCode}`
                  : `${t.inRoomPrefix} ${state.joinedRoomCode}`}
              </p>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                {currentQuestion ? currentQuestion.prompt : t.inWaitingQuestion}
              </h2>
              {room && currentQuestion ? (
                <p className="text-sm text-slate-500">
                  {t.inQuestionLabel} {room.activeQuestionIndex + 1}{" "}
                  {t.inQuestionOf} {room.questions.length}
                </p>
              ) : null}
            </div>

            {!currentQuestion ? (
              <div className="mt-5 rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-6 text-slate-600">
                {room?.status === "finished" ? t.inFinished : t.inNoQuestion}
              </div>
            ) : (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {currentQuestion.options.map((option, optionIndex) => {
                  const selected =
                    joinedParticipant?.votes[currentQuestion.id] === option;

                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => void vote(option)}
                      className={`rounded-[1.5rem] border p-4 text-left transition sm:p-5 ${
                        selected
                          ? "border-cyan-400 bg-cyan-50 shadow-[0_12px_40px_rgba(34,211,238,0.18)]"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                          {t.choice} {optionIndex + 1}
                        </span>
                        {selected ? (
                          <span className="rounded-full bg-slate-950 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-white">
                            {t.yourVote}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-3 text-lg font-medium leading-6 text-slate-950 sm:text-xl">
                        {option}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </article>
        ) : (
          <div className="grid flex-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-[2rem] border border-slate-200 bg-white/85 p-5 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur sm:p-6">
              <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-slate-500">
                    {t.availableRooms}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    {t.joinLiveClass}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRoomsLoading(true);
                    void listRoomsRequest()
                      .then((rooms) => {
                        setAvailableRooms(rooms);
                        setRoomsError(null);
                      })
                      .catch((roomsLoadError) => {
                        setRoomsError(
                          roomsLoadError instanceof Error
                            ? roomsLoadError.message
                            : t.roomLoadError,
                        );
                      })
                      .finally(() => {
                        setRoomsLoading(false);
                      });
                  }}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  {t.refresh}
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {roomsLoading ? (
                  <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                    {t.loadingRooms}
                  </div>
                ) : availableRooms.length > 0 ? (
                  availableRooms.map((availableRoom) => (
                    <button
                      key={availableRoom.roomCode}
                      type="button"
                      onClick={() => {
                        setState((currentState) => ({
                          ...currentState,
                          roomCode: availableRoom.roomCode,
                        }));
                        void joinRoom(availableRoom.roomCode);
                      }}
                      className="w-full rounded-[1.5rem] border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_16px_45px_rgba(15,23,42,0.08)]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                            {availableRoom.roomCode}
                          </p>
                          <h3 className="mt-2 text-lg font-semibold text-slate-950">
                            {availableRoom.title}
                          </h3>
                          <p className="mt-1 text-sm text-slate-600">
                            {t.hostedBy} {availableRoom.hostName}
                          </p>
                        </div>
                        <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                          {t.join}
                        </span>
                      </div>
                      <p className="mt-4 text-sm text-slate-500">
                        {availableRoom.participantCount}{" "}
                        {availableRoom.participantCount === 1
                          ? t.studentSingular
                          : t.studentPlural}{" "}
                        {t.studentsInsideSuffix}
                      </p>
                    </button>
                  ))
                ) : (
                  <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                    {t.noRooms}
                  </div>
                )}
                {roomsError ? (
                  <p className="text-sm text-rose-600">{roomsError}</p>
                ) : null}
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white/85 p-5 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur sm:p-6">
              <div className="border-b border-slate-200 pb-4">
                <p className="text-sm uppercase tracking-[0.3em] text-slate-500">
                  {t.joinWithCode}
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  {t.keepRosterFun}
                </h2>
              </div>

              <div className="mt-5 rounded-[1.5rem] bg-slate-950 p-4 text-white">
                <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                  {t.defaultAlias}
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight">
                  {state.participantName}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  {t.aliasDescription}
                </p>
              </div>

              <div className="mt-5 space-y-4">
                <Field
                  label={t.studentName}
                  value={state.participantName}
                  onChange={(value) =>
                    setState((currentState) => ({
                      ...currentState,
                      participantName: value,
                    }))
                  }
                  placeholder={t.studentPlaceholder}
                />
                <Field
                  label={t.roomCode}
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
                  {t.joinRoom}
                </button>
              </div>
            </section>
          </div>
        )}
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
