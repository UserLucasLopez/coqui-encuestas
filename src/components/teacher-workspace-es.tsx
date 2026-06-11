"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createId,
  createQuestion,
  getQuestionScores,
  type QuizRoom,
  type QuizQuestion,
} from "@/lib/quiz";
import {
  advanceRoomRequest,
  closeRoomRequest,
  createRoomRequest,
  rewindRoomRequest,
} from "@/lib/room-api";
import { useRoomStream } from "@/lib/use-room-stream";

type DraftState = {
  teacherName: string;
  quizTitle: string;
  roomCode: string;
  questions: QuizQuestion[];
  activeRoomCode: string | null;
};

const STORAGE_KEY = "coqui-encuestas-teacher-draft-es";

function sanitizeRoomCode(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 8);
}

function cloneQuestion(question: QuizQuestion): QuizQuestion {
  return {
    ...question,
    options: [...question.options],
  };
}

function createSpanishDraftQuestions() {
  return [
    createQuestion("Que parte de la clase quieres repasar primero?", [
      "Calentamiento",
      "Leccion principal",
      "Actividad en grupo",
      "Cierre",
    ]),
    createQuestion("Que formato deberia usar el siguiente reto?", [
      "Opcion unica",
      "Opcion multiple",
      "Clasificacion",
      "Ronda rapida",
    ]),
  ];
}

function translateSpanishPlaceholder(value: string) {
  const translations: Record<string, string> = {
    "Which part of the class do you want to review first?":
      "Que parte de la clase quieres repasar primero?",
    "Which format should the next challenge use?":
      "Que formato deberia usar el siguiente reto?",
    "Warm-up": "Calentamiento",
    "Main lesson": "Leccion principal",
    "Group activity": "Actividad en grupo",
    "Exit ticket": "Cierre",
    "Single choice": "Opcion unica",
    "Multiple choice": "Opcion multiple",
    Ranking: "Clasificacion",
    "Speed round": "Ronda rapida",
    "New question": "Nueva pregunta",
    "Option 1": "Opcion 1",
    "Option 2": "Opcion 2",
    "Option 3": "Opcion 3",
    "Option 4": "Opcion 4",
  };

  return translations[value] ?? value;
}

function localizeSpanishQuestions(questions: QuizQuestion[]) {
  return questions.map((question) => ({
    ...question,
    prompt: translateSpanishPlaceholder(question.prompt),
    options: question.options.map(translateSpanishPlaceholder),
  }));
}

function defaultDraft(): DraftState {
  return {
    teacherName: "Profesor",
    quizTitle: "Verificación de pulso de la clase",
    roomCode: "COQUI",
    questions: createSpanishDraftQuestions(),
    activeRoomCode: null,
  };
}

export function TeacherWorkspace() {
  const [draft, setDraft] = useState<DraftState>(defaultDraft);
  const [studentMessage, setStudentMessage] = useState<string>(
    "Crea un cuestionario, publícalo y controla la sala aquí.",
  );
  const [isPublishing, setIsPublishing] = useState(false);
  const [closedRoomSnapshot, setClosedRoomSnapshot] = useState<QuizRoom | null>(
    null,
  );
  const [showFullscreenResults, setShowFullscreenResults] = useState(false);
  const [resultsQuestionIndex, setResultsQuestionIndex] = useState(0);
  const { room, loading, error, setRoom } = useRoomStream(draft.activeRoomCode);

  useEffect(() => {
    try {
      const rawDraft = window.localStorage.getItem(STORAGE_KEY);
      if (!rawDraft) {
        return;
      }

      const parsed = JSON.parse(rawDraft) as Partial<DraftState>;
      setDraft((currentDraft) => ({
        ...currentDraft,
        ...parsed,
        questions:
          Array.isArray(parsed.questions) && parsed.questions.length > 0
            ? localizeSpanishQuestions(parsed.questions)
            : currentDraft.questions,
        activeRoomCode: parsed.activeRoomCode ?? currentDraft.activeRoomCode,
      }));
    } catch {
      // Ignore invalid saved draft state.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [draft]);

  const currentQuestion = room?.questions[room.activeQuestionIndex] ?? null;
  const scores = useMemo(
    () => getQuestionScores(room, currentQuestion?.id),
    [currentQuestion?.id, room],
  );

  const persistDraft = (updates: Partial<DraftState>) => {
    setDraft((currentDraft) => ({ ...currentDraft, ...updates }));
  };

  const updateQuestion = (
    questionId: string,
    updater: (question: QuizQuestion) => QuizQuestion,
  ) => {
    setDraft((currentDraft) => ({
      ...currentDraft,
      questions: currentDraft.questions.map((question) =>
        question.id === questionId
          ? updater(cloneQuestion(question))
          : question,
      ),
    }));
  };

  const addQuestion = () => {
    setDraft((currentDraft) => ({
      ...currentDraft,
      questions: [
        ...currentDraft.questions,
        createQuestion(`Pregunta ${currentDraft.questions.length + 1}`, [
          "Opción 1",
          "Opción 2",
          "Opción 3",
          "Opción 4",
        ]),
      ],
    }));
  };

  const removeQuestion = (questionId: string) => {
    setDraft((currentDraft) => {
      const remainingQuestions = currentDraft.questions.filter(
        (question) => question.id !== questionId,
      );
      return {
        ...currentDraft,
        questions:
          remainingQuestions.length > 0
            ? remainingQuestions
            : createSpanishDraftQuestions(),
      };
    });
  };

  const addOption = (questionId: string) => {
    setDraft((currentDraft) => ({
      ...currentDraft,
      questions: currentDraft.questions.map((question) => {
        if (question.id !== questionId) {
          return question;
        }

        return {
          ...question,
          options: [
            ...question.options,
            `Opción ${question.options.length + 1}`,
          ],
        };
      }),
    }));
  };

  const removeOption = (questionId: string, optionIndex: number) => {
    setDraft((currentDraft) => ({
      ...currentDraft,
      questions: currentDraft.questions.map((question) => {
        if (question.id !== questionId || question.options.length <= 2) {
          return question;
        }

        return {
          ...question,
          options: question.options.filter((_, index) => index !== optionIndex),
        };
      }),
    }));
  };

  const updateOption = (
    questionId: string,
    optionIndex: number,
    optionValue: string,
  ) => {
    setDraft((currentDraft) => ({
      ...currentDraft,
      questions: currentDraft.questions.map((question) => {
        if (question.id !== questionId) {
          return question;
        }

        const options = [...question.options];
        options[optionIndex] = optionValue;

        return {
          ...question,
          options,
        };
      }),
    }));
  };

  const publishRoom = async () => {
    setIsPublishing(true);
    setStudentMessage("Publicando sala...");

    try {
      const createdRoom = await createRoomRequest({
        title: draft.quizTitle,
        hostName: draft.teacherName,
        roomCode: sanitizeRoomCode(draft.roomCode),
        questions: draft.questions,
      });

      setDraft((currentDraft) => ({
        ...currentDraft,
        activeRoomCode: createdRoom.roomCode,
        roomCode: createdRoom.roomCode,
      }));
      setClosedRoomSnapshot(null);
      setShowFullscreenResults(false);
      setResultsQuestionIndex(0);
      setRoom(createdRoom);
      setStudentMessage(
        `La sala ${createdRoom.roomCode} está en vivo y lista para estudiantes.`,
      );
    } catch (publishError) {
      setStudentMessage(
        publishError instanceof Error
          ? publishError.message
          : "No se pudo publicar la sala.",
      );
    } finally {
      setIsPublishing(false);
    }
  };

  const stepRoom = async (direction: 1 | -1) => {
    if (!draft.activeRoomCode) {
      return;
    }

    const nextRoom =
      direction > 0
        ? await advanceRoomRequest(draft.activeRoomCode)
        : await rewindRoomRequest(draft.activeRoomCode);

    setRoom(nextRoom);
  };

  const finishRoom = async () => {
    if (!draft.activeRoomCode) {
      return;
    }

    const nextRoom = await closeRoomRequest(draft.activeRoomCode);
    setClosedRoomSnapshot(nextRoom);
    setResultsQuestionIndex(nextRoom.activeQuestionIndex);
    setDraft((currentDraft) => ({
      ...currentDraft,
      activeRoomCode: null,
    }));
    setRoom(null);
    setStudentMessage(`La sala ${nextRoom.roomCode} ha sido cerrada.`);
  };

  const resultsRoom = closedRoomSnapshot;
  const resultsQuestion = resultsRoom?.questions[resultsQuestionIndex] ?? null;
  const resultsScores = getQuestionScores(resultsRoom, resultsQuestion?.id);
  const questionVoteTotal = resultsScores.reduce(
    (sum, score) => sum + score.count,
    0,
  );

  const votedParticipants =
    room?.participants.filter(
      (participant) => participant.votes[currentQuestion?.id ?? ""],
    ) ?? [];

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_#fff7e8_0%,_#f2f0ea_40%,_#e8ecf4_100%)] text-slate-950">
      <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:linear-gradient(rgba(10,10,10,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(10,10,10,0.05)_1px,transparent_1px)] [background-size:42px_42px]" />
      <div className="pointer-events-none absolute -left-24 top-16 h-72 w-72 rounded-full bg-amber-300/40 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-36 h-80 w-80 rounded-full bg-cyan-300/30 blur-3xl" />

      <section className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-6 py-8 lg:px-10">
        <header className="flex flex-col gap-6 rounded-[2rem] border border-white/70 bg-white/75 p-6 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur md:p-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl space-y-4">
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-white">
                Control del profesor
              </span>
              <h1 className="text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
                Construye el cuestionario y controla la sala en vivo.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-600 md:text-lg">
                Publica una sala, avanza a través de preguntas y observa los
                resultados en vivo de los estudiantes actualizándose desde el
                servidor en tiempo real.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 md:min-w-[28rem]">
              <StatCard
                label="Sala"
                value={room?.roomCode ?? draft.roomCode}
                tone="slate"
              />
              <StatCard
                label="Respuestas"
                value={String(room?.participants.length ?? 0)}
                tone="amber"
              />
              <StatCard
                label="Estudiantes"
                value={String(votedParticipants.length)}
                tone="cyan"
              />
            </div>
          </div>

          <p className="rounded-2xl border border-slate-200 bg-slate-950 px-4 py-3 text-sm text-white">
            {studentMessage}
            {error ? ` ${error}` : ""}
          </p>
        </header>

        <div className="grid flex-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[2rem] border border-white/70 bg-slate-950/95 p-6 text-white shadow-[0_30px_80px_rgba(15,23,42,0.2)]">
            <div className="flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
                  Estudio del profesor
                </p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                  Diseña el cuestionario
                </h2>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={publishRoom}
                  disabled={isPublishing}
                  className="rounded-full bg-amber-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:translate-y-[-1px] hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPublishing ? "Publicando..." : "Publicar sala"}
                </button>
                <button
                  type="button"
                  onClick={addQuestion}
                  className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Agregar pregunta
                </button>
              </div>
            </div>

            <div className="mt-6 space-y-6">
              <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
                <Field
                  label="Título del cuestionario"
                  value={draft.quizTitle}
                  onChange={(value) => persistDraft({ quizTitle: value })}
                  placeholder="Verificación del lanzamiento"
                />
                <Field
                  label="Código de sala"
                  value={draft.roomCode}
                  onChange={(value) =>
                    persistDraft({ roomCode: sanitizeRoomCode(value) })
                  }
                  placeholder="COQUI"
                  maxLength={8}
                />
              </div>

              <Field
                label="Nombre del profesor"
                value={draft.teacherName}
                onChange={(value) => persistDraft({ teacherName: value })}
                placeholder="Profesor"
              />

              <div className="space-y-4">
                {draft.questions.map((question, questionIndex) => (
                  <article
                    key={question.id}
                    className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-slate-400">
                          <span>Pregunta {questionIndex + 1}</span>
                          <span className="rounded-full border border-white/10 px-2 py-1 text-[0.65rem] tracking-[0.28em] text-slate-300">
                            Solo resultados
                          </span>
                        </div>
                        <textarea
                          value={question.prompt}
                          onChange={(event) =>
                            updateQuestion(question.id, (currentQuestion) => ({
                              ...currentQuestion,
                              prompt: event.target.value,
                            }))
                          }
                          rows={2}
                          className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-amber-300"
                          placeholder="Ingresa tu pregunta"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => removeQuestion(question.id)}
                        className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:border-rose-300 hover:text-rose-200"
                      >
                        Eliminar
                      </button>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {question.options.map((option, optionIndex) => (
                        <div
                          key={`${question.id}-${optionIndex}`}
                          className="rounded-2xl border border-white/10 bg-slate-900/70 p-3"
                        >
                          <div className="flex items-center justify-between gap-2 text-xs uppercase tracking-[0.24em] text-slate-400">
                            <span>Opción {optionIndex + 1}</span>
                            <button
                              type="button"
                              onClick={() =>
                                removeOption(question.id, optionIndex)
                              }
                              className="text-[0.7rem] tracking-[0.2em] text-slate-400 transition hover:text-amber-200"
                            >
                              Eliminar
                            </button>
                          </div>
                          <input
                            value={option}
                            onChange={(event) =>
                              updateOption(
                                question.id,
                                optionIndex,
                                event.target.value,
                              )
                            }
                            className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                            placeholder={`Opción ${optionIndex + 1}`}
                          />
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => addOption(question.id)}
                        className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10"
                      >
                        Agregar opción
                      </button>
                      <p className="text-sm text-slate-400">
                        Los estudiantes solo ven la distribución de respuestas
                        para esta pregunta.
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-6">
            <article className="rounded-[2rem] border border-slate-200 bg-white/80 p-6 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur">
              <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-slate-500">
                    Sala en vivo
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    {room ? room.title : "Publica una sala para comenzar"}
                  </h3>
                </div>

                {room && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void stepRoom(-1)}
                      className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      Anterior
                    </button>
                    <button
                      type="button"
                      onClick={() => void stepRoom(1)}
                      className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      Siguiente
                    </button>
                    <button
                      type="button"
                      onClick={() => void finishRoom()}
                      className="rounded-full border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700 transition hover:border-rose-300 hover:bg-rose-50"
                    >
                      Cerrar
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-5 space-y-4">
                {!room && (
                  <div className="rounded-[1.4rem] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                    Publica el cuestionario para abrir la sala. El servidor
                    sincronizará los votos de los estudiantes en tiempo real.
                  </div>
                )}

                {!room && closedRoomSnapshot && (
                  <button
                    type="button"
                    onClick={() => setShowFullscreenResults(true)}
                    className="w-full rounded-[1.4rem] border border-slate-200 bg-white px-5 py-4 text-left transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                      Resultados de sala cerrada
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">
                      Ver resultados en pantalla completa
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Sala {closedRoomSnapshot.roomCode} ·{" "}
                      {closedRoomSnapshot.title}
                    </p>
                  </button>
                )}

                {currentQuestion && (
                  <div className="space-y-4">
                    <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-5">
                      <p className="text-sm uppercase tracking-[0.3em] text-slate-500">
                        Pregunta actual
                      </p>
                      <h4 className="mt-2 text-xl font-semibold text-slate-950">
                        {currentQuestion.prompt}
                      </h4>
                      <p className="mt-2 text-sm text-slate-500">
                        {room ? room.activeQuestionIndex + 1 : 0} /{" "}
                        {room ? room.questions.length : 0}
                      </p>
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
                          {room?.participants.filter(
                            (participant) =>
                              participant.votes[currentQuestion.id],
                          ).length ?? 0}{" "}
                          votos
                        </span>
                      </div>

                      <div className="mt-5 space-y-3">
                        {scores.map((result) => (
                          <div key={result.option} className="space-y-2">
                            <div className="flex items-center justify-between gap-4 text-sm text-slate-300">
                              <span>{result.option}</span>
                              <span>
                                {result.count} voto
                                {result.count === 1 ? "" : "s"} ·{" "}
                                {result.percent}%
                              </span>
                            </div>
                            <div className="h-3 overflow-hidden rounded-full bg-white/10">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-amber-300 via-cyan-300 to-emerald-300 transition-all"
                                style={{
                                  width: `${Math.max(result.percent, result.count > 0 ? 12 : 0)}%`,
                                }}
                              />
                            </div>
                            {result.voters.length > 0 ? (
                              <p className="text-xs text-slate-400">
                                {result.voters.join(", ")}
                              </p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </article>

            <article className="rounded-[2rem] border border-slate-200 bg-white/80 p-6 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur">
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">
                Quién votó
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {votedParticipants.length > 0 ? (
                  votedParticipants.map((participant) => (
                    <span
                      key={participant.id}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-600"
                    >
                      {participant.name}
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

      {showFullscreenResults && resultsRoom && resultsQuestion && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950 p-4 sm:p-6">
          <div className="mx-auto w-full max-w-6xl rounded-[2rem] border border-white/15 bg-slate-950 p-5 text-white shadow-[0_30px_90px_rgba(0,0,0,0.35)] sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  Resultados en pantalla completa
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                  {resultsRoom.title}
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Pregunta {resultsQuestionIndex + 1} de{" "}
                  {resultsRoom.questions.length}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowFullscreenResults(false)}
                className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
              >
                Cerrar pantalla completa
              </button>
            </div>

            <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
              <h3 className="text-xl font-semibold text-white sm:text-2xl">
                {resultsQuestion.prompt}
              </h3>
              <p className="mt-2 text-sm text-slate-300">
                {questionVoteTotal} voto{questionVoteTotal === 1 ? "" : "s"} en
                esta pregunta
              </p>

              <div className="mt-5 space-y-4">
                {resultsScores.map((result) => (
                  <div key={result.option} className="space-y-2">
                    <div className="flex items-center justify-between gap-4 text-sm text-slate-200">
                      <span className="font-medium">{result.option}</span>
                      <span>
                        {result.count} voto{result.count === 1 ? "" : "s"} ·{" "}
                        {result.percent}%
                      </span>
                    </div>
                    <div className="h-4 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-300 via-cyan-300 to-emerald-300 transition-all"
                        style={{
                          width: `${Math.max(result.percent, result.count > 0 ? 8 : 0)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() =>
                  setResultsQuestionIndex((currentIndex) =>
                    Math.max(0, currentIndex - 1),
                  )
                }
                disabled={resultsQuestionIndex <= 0}
                className="rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Pregunta anterior
              </button>

              <button
                type="button"
                onClick={() =>
                  setResultsQuestionIndex((currentIndex) =>
                    Math.min(
                      resultsRoom.questions.length - 1,
                      currentIndex + 1,
                    ),
                  )
                }
                disabled={
                  resultsQuestionIndex >= resultsRoom.questions.length - 1
                }
                className="rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Siguiente pregunta
              </button>
            </div>
          </div>
        </div>
      )}
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
      <span className="text-xs uppercase tracking-[0.3em] text-slate-300">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-400 focus:border-amber-300"
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
  tone: "slate" | "amber" | "cyan";
}) {
  const toneClasses = {
    slate: "bg-slate-950 text-white",
    amber: "bg-amber-300 text-slate-950",
    cyan: "bg-cyan-300 text-slate-950",
  };

  return (
    <div className={`rounded-3xl p-4 shadow-sm ${toneClasses[tone]}`}>
      <p className="text-xs uppercase tracking-[0.28em] opacity-70">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}
