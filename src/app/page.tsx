"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addOrUpdateParticipant,
  advanceQuestion,
  createDraftQuestions,
  createId,
  createLiveRoom,
  createQuestion,
  getQuestionScores,
  recordVote,
  rewindQuestion,
  type QuizQuestion,
  type QuizRoom,
} from "@/lib/quiz";

type DraftQuestion = QuizQuestion;

type StoredState = {
  teacherName: string;
  quizTitle: string;
  roomCode: string;
  questions: DraftQuestion[];
  liveRoom: QuizRoom | null;
  studentName: string;
  studentRoomCode: string;
  studentId: string;
};

const STORAGE_KEY = "coqui-encuestas-state";

const defaultState = (): StoredState => ({
  teacherName: "Teacher",
  quizTitle: "Class pulse check",
  roomCode: "COQUI",
  questions: createDraftQuestions(),
  liveRoom: null,
  studentName: "Student",
  studentRoomCode: "",
  studentId: createId("student"),
});

function sanitizeRoomCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

function cloneQuestion(question: DraftQuestion): DraftQuestion {
  return {
    id: question.id,
    prompt: question.prompt,
    options: [...question.options],
  };
}

export default function Home() {
  const [state, setState] = useState<StoredState>(defaultState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const rawState = window.localStorage.getItem(STORAGE_KEY);
      if (rawState) {
        const parsed = JSON.parse(rawState) as StoredState;
        setState({
          ...defaultState(),
          ...parsed,
          questions: Array.isArray(parsed.questions) && parsed.questions.length > 0 ? parsed.questions : createDraftQuestions(),
          studentId: parsed.studentId || createId("student"),
        });
      }
    } catch {
      setState(defaultState());
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, state]);

  const liveRoom = state.liveRoom;
  const activeQuestion = liveRoom?.questions[liveRoom.activeQuestionIndex] ?? null;
  const scores = useMemo(() => getQuestionScores(liveRoom, activeQuestion?.id), [activeQuestion?.id, liveRoom]);
  const activeVotes = liveRoom && activeQuestion
    ? liveRoom.participants.filter((participant) => participant.votes[activeQuestion.id]).length
    : 0;
  const studentParticipant = liveRoom?.participants.find((participant) => participant.id === state.studentId) ?? null;
  const isJoined = Boolean(liveRoom && state.studentRoomCode === liveRoom.roomCode && studentParticipant);
  const votedParticipants = liveRoom && activeQuestion
    ? liveRoom.participants
        .filter((participant) => participant.votes[activeQuestion.id])
        .map((participant) => participant.name)
    : [];

  const updateQuestion = (questionId: string, updater: (question: DraftQuestion) => DraftQuestion) => {
    setState((currentState) => ({
      ...currentState,
      questions: currentState.questions.map((question) =>
        question.id === questionId ? updater(cloneQuestion(question)) : question,
      ),
    }));
  };

  const updateQuizTitle = (value: string) => {
    setState((currentState) => ({ ...currentState, quizTitle: value }));
  };

  const updateRoomCode = (value: string) => {
    setState((currentState) => ({ ...currentState, roomCode: sanitizeRoomCode(value) }));
  };

  const addQuestion = () => {
    setState((currentState) => ({
      ...currentState,
      questions: [
        ...currentState.questions,
        createQuestion(`Question ${currentState.questions.length + 1}`, ["Option 1", "Option 2", "Option 3", "Option 4"]),
      ],
    }));
  };

  const removeQuestion = (questionId: string) => {
    setState((currentState) => {
      const remainingQuestions = currentState.questions.filter((question) => question.id !== questionId);
      return {
        ...currentState,
        questions: remainingQuestions.length > 0 ? remainingQuestions : createDraftQuestions(),
      };
    });
  };

  const addOption = (questionId: string) => {
    setState((currentState) => ({
      ...currentState,
      questions: currentState.questions.map((question) => {
        if (question.id !== questionId) {
          return question;
        }

        return {
          ...question,
          options: [...question.options, `Option ${question.options.length + 1}`],
        };
      }),
    }));
  };

  const removeOption = (questionId: string, optionIndex: number) => {
    setState((currentState) => ({
      ...currentState,
      questions: currentState.questions.map((question) => {
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

  const updateOption = (questionId: string, optionIndex: number, optionValue: string) => {
    setState((currentState) => ({
      ...currentState,
      questions: currentState.questions.map((question) => {
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

  const publishRoom = () => {
    const normalizedRoomCode = sanitizeRoomCode(state.roomCode) || "QUIZ";
    const createdRoom = createLiveRoom({
      title: state.quizTitle,
      hostName: state.teacherName,
      questions: state.questions,
    });

    setState((currentState) => ({
      ...currentState,
      roomCode: normalizedRoomCode,
      liveRoom: {
        ...createdRoom,
        roomCode: normalizedRoomCode,
      },
    }));
  };

  const joinRoom = () => {
    setState((currentState) => {
      if (!currentState.liveRoom) {
        return currentState;
      }

      const joinedCode = sanitizeRoomCode(currentState.studentRoomCode);
      if (joinedCode !== currentState.liveRoom.roomCode) {
        return {
          ...currentState,
          studentRoomCode: joinedCode,
        };
      }

      const participantId = currentState.studentId || createId("student");
      const nextRoom = addOrUpdateParticipant(
        currentState.liveRoom,
        participantId,
        currentState.studentName.trim() || "Student",
      );

      return {
        ...currentState,
        studentId: participantId,
        studentRoomCode: joinedCode,
        liveRoom: nextRoom,
      };
    });
  };

  const castVote = (option: string) => {
    if (!liveRoom || !activeQuestion || !isJoined) {
      return;
    }

    const participantId = state.studentId || createId("student");
    const participantName = studentParticipant?.name ?? (state.studentName.trim() || "Student");
    const roomWithParticipant = addOrUpdateParticipant(liveRoom, participantId, participantName);

    setState((currentState) => ({
      ...currentState,
      studentId: participantId,
      liveRoom: recordVote(roomWithParticipant, participantId, activeQuestion.id, option),
    }));
  };

  const stepQuestion = (direction: 1 | -1) => {
    if (!liveRoom) {
      return;
    }

    setState((currentState) => ({
      ...currentState,
      liveRoom: direction > 0 ? advanceQuestion(currentState.liveRoom!) : rewindQuestion(currentState.liveRoom!),
    }));
  };

  const closeRoom = () => {
    if (!liveRoom) {
      return;
    }

    setState((currentState) => ({
      ...currentState,
      liveRoom: {
        ...currentState.liveRoom!,
        status: "finished",
      },
    }));
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_#fff7e8_0%,_#f2f0ea_40%,_#e8ecf4_100%)] text-slate-950">
      <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:linear-gradient(rgba(10,10,10,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(10,10,10,0.05)_1px,transparent_1px)] [background-size:42px_42px]" />
      <div className="pointer-events-none absolute -left-24 top-16 h-72 w-72 rounded-full bg-amber-300/40 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-36 h-80 w-80 rounded-full bg-cyan-300/30 blur-3xl" />

      <section className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-6 py-8 lg:px-10">
        <header className="flex flex-col gap-6 rounded-[2rem] border border-white/70 bg-white/70 p-6 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur md:p-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl space-y-4">
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-white">
                Live classroom
              </span>
              <h1 className="text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
                Kahoot-style quizzes with teacher control and student results only.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-600 md:text-lg">
                Build a room, publish it, let students join with a code, and show live response
                distribution instead of a correct-answer reveal.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 md:min-w-[28rem]">
              <StatCard label="Room" value={liveRoom?.roomCode ?? state.roomCode} tone="slate" />
              <StatCard label="Responses" value={String(activeVotes)} tone="amber" />
              <StatCard label="Students" value={String(liveRoom?.participants.length ?? 0)} tone="cyan" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <ActionChip title="Teacher" description="Create and publish a room" accent="bg-slate-950 text-white" />
            <ActionChip title="Student" description="Join with a room code" accent="bg-amber-300 text-slate-950" />
            <ActionChip title="Results" description="Show votes, not answers" accent="bg-cyan-300 text-slate-950" />
          </div>
        </header>

        <div className="grid flex-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[2rem] border border-white/70 bg-slate-950/95 p-6 text-white shadow-[0_30px_80px_rgba(15,23,42,0.2)]">
            <div className="flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Teacher studio</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight">Design the quiz</h2>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={publishRoom}
                  className="rounded-full bg-amber-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:translate-y-[-1px] hover:bg-amber-200"
                >
                  Publish live room
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
                  value={state.quizTitle}
                  onChange={updateQuizTitle}
                  placeholder="Launch day pulse check"
                />
                <Field
                  label="Room code"
                  value={state.roomCode}
                  onChange={updateRoomCode}
                  placeholder="COQUI"
                  maxLength={6}
                />
              </div>

              <div className="space-y-4">
                {state.questions.map((question, questionIndex) => (
                  <article
                    key={question.id}
                    className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-slate-400">
                          <span>Question {questionIndex + 1}</span>
                          <span className="rounded-full border border-white/10 px-2 py-1 text-[0.65rem] tracking-[0.28em] text-slate-300">
                            Live results only
                          </span>
                        </div>
                        <textarea
                          value={question.prompt}
                          onChange={(event) => updateQuestion(question.id, (currentQuestion) => ({
                            ...currentQuestion,
                            prompt: event.target.value,
                          }))}
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
                              onClick={() => removeOption(question.id, optionIndex)}
                              className="text-[0.7rem] tracking-[0.2em] text-slate-400 transition hover:text-amber-200"
                            >
                              Delete
                            </button>
                          </div>
                          <input
                            value={option}
                            onChange={(event) => updateOption(question.id, optionIndex, event.target.value)}
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
                        Students only see the answer distribution for this question.
                      </p>
                    </div>
                  </article>
                ))}
              </div>

              {liveRoom && (
                <div className="rounded-[1.5rem] border border-emerald-400/25 bg-emerald-400/10 p-4 text-sm text-emerald-100">
                  Room {liveRoom.roomCode} is live. Students can join and vote immediately.
                </div>
              )}
            </div>
          </section>

          <section className="grid gap-6">
            <article className="rounded-[2rem] border border-slate-200 bg-white/80 p-6 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Student lobby</p>
                  <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Join and vote</h2>
                </div>
                <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-white">
                  {isJoined ? "Joined" : "Waiting"}
                </span>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
                <Field
                  label="Student name"
                  value={state.studentName}
                  onChange={(value) => setState((currentState) => ({ ...currentState, studentName: value }))}
                  placeholder="Alex"
                  light
                />
                <Field
                  label="Room code"
                  value={state.studentRoomCode}
                  onChange={(value) =>
                    setState((currentState) => ({
                      ...currentState,
                      studentRoomCode: sanitizeRoomCode(value),
                    }))
                  }
                  placeholder="COQUI"
                  maxLength={6}
                  light
                />
              </div>

              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={joinRoom}
                  className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Join room
                </button>
                <p className="text-sm text-slate-500">
                  Match the published room code to unlock the current question.
                </p>
              </div>
            </article>

            <article className="rounded-[2rem] border border-slate-200 bg-white/80 p-6 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur">
              <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Live question</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    {activeQuestion ? activeQuestion.prompt : "Publish a room to start"}
                  </h3>
                </div>

                {liveRoom && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => stepQuestion(-1)}
                      className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => stepQuestion(1)}
                      className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      Next
                    </button>
                    <button
                      type="button"
                      onClick={closeRoom}
                      className="rounded-full border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700 transition hover:border-rose-300 hover:bg-rose-50"
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-5 space-y-4">
                {!liveRoom && (
                  <div className="rounded-[1.4rem] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                    Publish the quiz from the teacher panel to open the room.
                  </div>
                )}

                {liveRoom && !isJoined && (
                  <div className="rounded-[1.4rem] border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
                    Join room {liveRoom.roomCode} to answer the current question.
                  </div>
                )}

                {activeQuestion && isJoined && (
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {activeQuestion.options.map((option, optionIndex) => {
                        const selected = studentParticipant?.votes[activeQuestion.id] === option;

                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => castVote(option)}
                            className={`rounded-[1.4rem] border p-4 text-left transition ${
                              selected
                                ? "border-cyan-400 bg-cyan-50 shadow-[0_12px_40px_rgba(34,211,238,0.18)]"
                                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">
                                Choice {optionIndex + 1}
                              </span>
                              {selected && (
                                <span className="rounded-full bg-slate-950 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-white">
                                  Your vote
                                </span>
                              )}
                            </div>
                            <p className="mt-3 text-lg font-medium text-slate-950">{option}</p>
                          </button>
                        );
                      })}
                    </div>

                    <div className="rounded-[1.4rem] bg-slate-950 p-5 text-white">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Student results</p>
                          <h4 className="mt-2 text-2xl font-semibold">Live distribution</h4>
                        </div>
                        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-slate-200">
                          {activeVotes} votes
                        </span>
                      </div>

                      <div className="mt-5 space-y-3">
                        {scores.map((result) => (
                          <div key={result.option} className="space-y-2">
                            <div className="flex items-center justify-between gap-4 text-sm text-slate-300">
                              <span>{result.option}</span>
                              <span>{result.count} votes · {result.percent}%</span>
                            </div>
                            <div className="h-3 overflow-hidden rounded-full bg-white/10">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-amber-300 via-cyan-300 to-emerald-300 transition-all"
                                style={{ width: `${Math.max(result.percent, result.count > 0 ? 12 : 0)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </article>

            <article className="rounded-[2rem] border border-slate-200 bg-white/80 p-6 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur">
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Room activity</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <InfoTile label="Current question" value={String((liveRoom?.activeQuestionIndex ?? 0) + 1)} />
                <InfoTile label="Join status" value={isJoined ? "Connected" : "Offline"} />
                <InfoTile label="Vote state" value={studentParticipant?.votes[activeQuestion?.id ?? ""] ? "Submitted" : "Ready"} />
              </div>
              <div className="mt-4 rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                This prototype intentionally avoids revealing a correct answer. The classroom only sees how students answered.
              </div>
              {votedParticipants.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {votedParticipants.map((participantName) => (
                    <span
                      key={participantName}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-600"
                    >
                      {participantName}
                    </span>
                  ))}
                </div>
              ) : null}
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
  light = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  maxLength?: number;
  light?: boolean;
}) {
  return (
    <label className="space-y-2">
      <span className={`text-xs uppercase tracking-[0.3em] ${light ? "text-slate-500" : "text-slate-300"}`}>
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 ${
          light
            ? "border-slate-200 bg-white text-slate-950 focus:border-cyan-400"
            : "border-white/10 bg-slate-900/80 text-white focus:border-amber-300"
        }`}
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

function ActionChip({
  title,
  description,
  accent,
}: {
  title: string;
  description: string;
  accent: string;
}) {
  return (
    <div className={`rounded-3xl px-4 py-3 ${accent}`}>
      <p className="text-sm font-semibold uppercase tracking-[0.24em]">{title}</p>
      <p className="mt-1 text-sm opacity-80">{description}</p>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4">
      <p className="text-xs uppercase tracking-[0.28em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}
