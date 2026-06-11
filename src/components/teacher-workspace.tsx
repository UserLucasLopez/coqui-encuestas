"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createDraftQuestions,
  createId,
  createQuestion,
  getQuestionScores,
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

const STORAGE_KEY = "coqui-encuestas-teacher-draft";

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

function defaultDraft(): DraftState {
  return {
    teacherName: "Teacher",
    quizTitle: "Class pulse check",
    roomCode: "COQUI",
    questions: createDraftQuestions(),
    activeRoomCode: null,
  };
}

export function TeacherWorkspace() {
  const [draft, setDraft] = useState<DraftState>(defaultDraft);
  const [studentMessage, setStudentMessage] = useState<string>(
    "Create a quiz, publish it, and control the room here.",
  );
  const [isPublishing, setIsPublishing] = useState(false);
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
            ? parsed.questions
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
        createQuestion(`Question ${currentDraft.questions.length + 1}`, [
          "Option 1",
          "Option 2",
          "Option 3",
          "Option 4",
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
            : createDraftQuestions(),
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
            `Option ${question.options.length + 1}`,
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
    setStudentMessage("Publishing room...");

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
      setRoom(createdRoom);
      setStudentMessage(
        `Room ${createdRoom.roomCode} is live and ready for students.`,
      );
    } catch (publishError) {
      setStudentMessage(
        publishError instanceof Error
          ? publishError.message
          : "Unable to publish the room.",
      );
      throw publishError;
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
    setDraft((currentDraft) => ({
      ...currentDraft,
      activeRoomCode: null,
    }));
    setRoom(null);
    setStudentMessage(`Room ${nextRoom.roomCode} has been closed.`);
  };

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
                Teacher control
              </span>
              <h1 className="text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
                Build the quiz and drive the live room.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-600 md:text-lg">
                Publish a room, step through questions, and watch live student
                results update from the backend in real time.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 md:min-w-[28rem]">
              <StatCard
                label="Room"
                value={room?.roomCode ?? draft.roomCode}
                tone="slate"
              />
              <StatCard
                label="Responses"
                value={String(room?.participants.length ?? 0)}
                tone="amber"
              />
              <StatCard
                label="Students"
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
                  Teacher studio
                </p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                  Design the quiz
                </h2>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={publishRoom}
                  disabled={isPublishing}
                  className="rounded-full bg-amber-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:translate-y-[-1px] hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPublishing ? "Publishing..." : "Publish room"}
                </button>
                <button
                  type="button"
                  onClick={addQuestion}
                  className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Add question
                </button>
              </div>
            </div>

            <div className="mt-6 space-y-6">
              <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
                <Field
                  label="Quiz title"
                  value={draft.quizTitle}
                  onChange={(value) => persistDraft({ quizTitle: value })}
                  placeholder="Launch day pulse check"
                />
                <Field
                  label="Room code"
                  value={draft.roomCode}
                  onChange={(value) =>
                    persistDraft({ roomCode: sanitizeRoomCode(value) })
                  }
                  placeholder="COQUI"
                  maxLength={8}
                />
              </div>

              <Field
                label="Teacher name"
                value={draft.teacherName}
                onChange={(value) => persistDraft({ teacherName: value })}
                placeholder="Teacher"
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
                          <span>Question {questionIndex + 1}</span>
                          <span className="rounded-full border border-white/10 px-2 py-1 text-[0.65rem] tracking-[0.28em] text-slate-300">
                            Results only
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
                          placeholder="Enter your question"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => removeQuestion(question.id)}
                        className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:border-rose-300 hover:text-rose-200"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {question.options.map((option, optionIndex) => (
                        <div
                          key={`${question.id}-${optionIndex}`}
                          className="rounded-2xl border border-white/10 bg-slate-900/70 p-3"
                        >
                          <div className="flex items-center justify-between gap-2 text-xs uppercase tracking-[0.24em] text-slate-400">
                            <span>Option {optionIndex + 1}</span>
                            <button
                              type="button"
                              onClick={() =>
                                removeOption(question.id, optionIndex)
                              }
                              className="text-[0.7rem] tracking-[0.2em] text-slate-400 transition hover:text-amber-200"
                            >
                              Delete
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
                            placeholder={`Option ${optionIndex + 1}`}
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
                        Add option
                      </button>
                      <p className="text-sm text-slate-400">
                        Students only see the answer distribution for this
                        question.
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
                    Live room
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    {room ? room.title : "Publish a room to start"}
                  </h3>
                </div>

                {room && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void stepRoom(-1)}
                      className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => void stepRoom(1)}
                      className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      Next
                    </button>
                    <button
                      type="button"
                      onClick={() => void finishRoom()}
                      className="rounded-full border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700 transition hover:border-rose-300 hover:bg-rose-50"
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-5 space-y-4">
                {!room && (
                  <div className="rounded-[1.4rem] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                    Publish the quiz to open the room. The backend will sync
                    student votes in real time.
                  </div>
                )}

                {currentQuestion && (
                  <div className="space-y-4">
                    <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-5">
                      <p className="text-sm uppercase tracking-[0.3em] text-slate-500">
                        Current question
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
                            Student results
                          </p>
                          <h4 className="mt-2 text-2xl font-semibold">
                            Live distribution
                          </h4>
                        </div>
                        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-slate-200">
                          {room?.participants.filter(
                            (participant) =>
                              participant.votes[currentQuestion.id],
                          ).length ?? 0}{" "}
                          votes
                        </span>
                      </div>

                      <div className="mt-5 space-y-3">
                        {scores.map((result) => (
                          <div key={result.option} className="space-y-2">
                            <div className="flex items-center justify-between gap-4 text-sm text-slate-300">
                              <span>{result.option}</span>
                              <span>
                                {result.count} vote
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
                Who voted
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
                    No one has voted on the current question yet.
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
