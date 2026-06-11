export type QuizQuestion = {
  id: string;
  prompt: string;
  options: string[];
};

export type QuizParticipant = {
  id: string;
  name: string;
  votes: Record<string, string>;
};

export type QuizRoom = {
  roomCode: string;
  title: string;
  hostName: string;
  questions: QuizQuestion[];
  activeQuestionIndex: number;
  participants: QuizParticipant[];
  status: "live" | "finished";
  createdAt: number;
};

export type QuizScore = {
  option: string;
  count: number;
  percent: number;
  voters: string[];
};

export const STORAGE_KEY = "coqui-encuestas-room";
export const CHANNEL_NAME = "coqui-encuestas-room-sync";

export function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createFunnyStudentName(locale: "en" | "es" = "en") {
  const dictionaries = {
    en: {
      adjectives: [
        "Bouncy",
        "Cosmic",
        "Dizzy",
        "Jazz",
        "Lucky",
        "Moon",
        "Sneaky",
        "Turbo",
        "Wobbly",
        "Zippy",
      ],
      nouns: [
        "Avocado",
        "Banana",
        "Burrito",
        "Llama",
        "Muffin",
        "Noodle",
        "Otter",
        "Pickle",
        "Pineapple",
        "Taco",
      ],
    },
    es: {
      adjectives: [
        "Bailarin",
        "Chispa",
        "Cosmico",
        "Gelatina",
        "Lunar",
        "Picante",
        "Saltarin",
        "Sigiloso",
        "Tambor",
        "Turbo",
      ],
      nouns: [
        "Aguacate",
        "Arepa",
        "Burrito",
        "Fideo",
        "Llama",
        "Mapache",
        "Nube",
        "Pepinillo",
        "Taco",
        "Tomate",
      ],
    },
  };

  const dictionary = dictionaries[locale];
  const adjective =
    dictionary.adjectives[
      Math.floor(Math.random() * dictionary.adjectives.length)
    ];
  const noun =
    dictionary.nouns[Math.floor(Math.random() * dictionary.nouns.length)];

  return `${adjective} ${noun}`;
}

export function generateRoomCode() {
  return `KQ-${Math.floor(1000 + Math.random() * 9000)}`;
}

export function createQuestion(
  prompt = "New question",
  options = ["Option 1", "Option 2", "Option 3", "Option 4"],
): QuizQuestion {
  return {
    id: createId("q"),
    prompt,
    options,
  };
}

export function createDraftQuestions() {
  return [
    createQuestion("Which part of the class do you want to review first?", [
      "Warm-up",
      "Main lesson",
      "Group activity",
      "Exit ticket",
    ]),
    createQuestion("Which format should the next challenge use?", [
      "Single choice",
      "Multiple choice",
      "Ranking",
      "Speed round",
    ]),
  ];
}

export function normalizeQuestion(question: QuizQuestion): QuizQuestion {
  return {
    id: question.id,
    prompt: question.prompt.trim() || "Untitled question",
    options: question.options
      .slice(0, 4)
      .map((option, index) => option.trim() || `Option ${index + 1}`),
  };
}

export function createLiveRoom(input: {
  title: string;
  hostName: string;
  questions: QuizQuestion[];
}): QuizRoom {
  return {
    roomCode: generateRoomCode(),
    title: input.title.trim() || "Untitled quiz",
    hostName: input.hostName.trim() || "Teacher",
    questions: input.questions.map(normalizeQuestion),
    activeQuestionIndex: 0,
    participants: [],
    status: "live",
    createdAt: Date.now(),
  };
}

export function addOrUpdateParticipant(
  room: QuizRoom,
  participantId: string,
  name: string,
): QuizRoom {
  const participantIndex = room.participants.findIndex(
    (participant) => participant.id === participantId,
  );

  const nextParticipant = {
    id: participantId,
    name: name.trim() || "Anonymous",
    votes: room.participants[participantIndex]?.votes ?? {},
  };

  if (participantIndex === -1) {
    return {
      ...room,
      participants: [...room.participants, nextParticipant],
    };
  }

  const participants = [...room.participants];
  participants[participantIndex] = nextParticipant;

  return {
    ...room,
    participants,
  };
}

export function recordVote(
  room: QuizRoom,
  participantId: string,
  questionId: string,
  option: string,
): QuizRoom {
  return {
    ...room,
    participants: room.participants.map((participant) => {
      if (participant.id !== participantId) {
        return participant;
      }

      return {
        ...participant,
        votes: {
          ...participant.votes,
          [questionId]: option,
        },
      };
    }),
  };
}

export function advanceQuestion(room: QuizRoom): QuizRoom {
  if (room.activeQuestionIndex >= room.questions.length - 1) {
    return {
      ...room,
      status: "finished",
    };
  }

  return {
    ...room,
    activeQuestionIndex: room.activeQuestionIndex + 1,
  };
}

export function rewindQuestion(room: QuizRoom): QuizRoom {
  return {
    ...room,
    activeQuestionIndex: Math.max(0, room.activeQuestionIndex - 1),
  };
}

export function getQuestionScores(
  room: QuizRoom | null,
  questionId?: string,
): QuizScore[] {
  if (!room || !questionId) {
    return [];
  }

  const question = room.questions.find((item) => item.id === questionId);
  if (!question) {
    return [];
  }

  const scores = question.options.map((option) => ({
    option,
    count: 0,
    percent: 0,
    voters: [] as string[],
  }));

  for (const participant of room.participants) {
    const vote = participant.votes[questionId];
    if (!vote) {
      continue;
    }

    const score = scores.find((entry) => entry.option === vote);
    if (!score) {
      continue;
    }

    score.count += 1;
    score.voters.push(participant.name);
  }

  const totalVotes = scores.reduce((sum, score) => sum + score.count, 0);

  return scores.map((score) => ({
    ...score,
    percent:
      totalVotes === 0 ? 0 : Math.round((score.count / totalVotes) * 100),
  }));
}
