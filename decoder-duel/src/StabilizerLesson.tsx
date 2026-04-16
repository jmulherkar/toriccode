import React, { useMemo, useState } from "react";

type LessonStep = {
  id: string;
  title: string;
  headline: string;
  concept: string;
  task: string;
  hint: string;
  success: string;
  formula?: string;
  quiz?: {
    prompt: string;
    correct: string;
    options: Array<{
      id: string;
      label: string;
      explanation: string;
    }>;
  };
};

type RepetitionSelection = 0 | 1 | 2 | 3;
type ShorError = "none" | "X" | "Z";
type SteaneError = "none" | "X" | "Z";

const LESSONS: LessonStep[] = [
  {
    id: "definition",
    title: "1. Code Space Basics",
    headline: "The code space is defined by commuting Pauli checks",
    concept:
      "The stabilizer formalism describes a quantum code through a commuting set of Pauli operators. Valid code states are the states that return +1 when measured against every generator in that set.",
    task: "Answer the first concept check and focus only on what it means for a state to belong to the code.",
    hint: "Think of the stabilizers as symmetry constraints. We describe the allowed subspace without listing every amplitude in the state vector.",
    success: "You now have the core stabilizer viewpoint: states are defined by the checks they satisfy.",
    formula: "Code space: S|psi> = |psi> for every stabilizer S in the generating set",
    quiz: {
      prompt: "What makes a state belong to a stabilizer code?",
      correct: "plus-one",
      options: [
        {
          id: "plus-one",
          label: "It is a +1 eigenstate of every stabilizer generator",
          explanation: "Correct. The joint +1 eigenspace of the commuting generators is the code space.",
        },
        {
          id: "all-paulis",
          label: "It is unchanged by every Pauli operator",
          explanation: "Not every Pauli. Only the chosen commuting stabilizers define the code.",
        },
        {
          id: "no-errors",
          label: "It contains no physical errors at all",
          explanation: "A code state can still later suffer errors. The definition is about the protected subspace itself.",
        },
      ],
    },
  },
  {
    id: "commuting",
    title: "2. Why Commuting Matters",
    headline: "The generators must be compatible checks",
    concept:
      "We want to measure several stabilizer generators and have a well-defined joint code space. That only works cleanly when the generators commute, so the code can be described as a simultaneous eigenspace of all of them.",
    task: "Answer the check and keep the goal very simple: why are commuting generators important?",
    hint: "If two operators commute, they can share eigenstates and therefore describe one consistent protected subspace.",
    success: "You’ve connected commutation to the existence of one shared code space.",
    formula: "[Si, Sj] = 0 for stabilizer generators Si and Sj",
    quiz: {
      prompt: "Why do stabilizer generators need to commute?",
      correct: "shared-eigenspace",
      options: [
        {
          id: "shared-eigenspace",
          label: "So the code can be defined as a shared eigenspace of all the checks",
          explanation: "Correct. Commuting checks are compatible measurements and can define one code space together.",
        },
        {
          id: "more-errors",
          label: "So each generator can detect every possible error by itself",
          explanation: "Not quite. A single generator is only one check. Commutation is about compatibility, not unlimited detection power.",
        },
        {
          id: "logical-readout",
          label: "So we can read out the logical qubit directly",
          explanation: "No. Stabilizer measurements are designed to avoid directly revealing the logical information.",
        },
      ],
    },
  },
  {
    id: "syndrome-intro",
    title: "3. Reading A Syndrome",
    headline: "Errors are detected through sign flips",
    concept:
      "We do not measure the logical state directly. Instead, we measure stabilizer generators. If an error anticommutes with a generator, that generator's outcome flips from +1 to -1 and contributes to the syndrome.",
    task: "Answer the check, then keep the phrase 'violated check' in mind for the next steps.",
    hint: "Look for which parity checks change sign. The syndrome tells you what was violated, not the whole quantum state.",
    success: "You’ve connected syndrome bits to violated stabilizer checks.",
    formula: "Error E anticommutes with stabilizer S => measurement of S changes sign",
    quiz: {
      prompt: "What does a syndrome bit actually record?",
      correct: "violated-check",
      options: [
        {
          id: "violated-check",
          label: "Whether a stabilizer check was violated",
          explanation: "Exactly. A syndrome bit is the measurement outcome of a stabilizer generator.",
        },
        {
          id: "full-state",
          label: "The full encoded quantum state",
          explanation: "No. The power of the formalism is that we learn about errors without fully measuring the state.",
        },
        {
          id: "logical-bit",
          label: "The value of the logical qubit",
          explanation: "That is what we are trying to preserve, not directly reveal.",
        },
      ],
    },
  },
  {
    id: "syndrome-basic",
    title: "4. What A Measurement Gives You",
    headline: "A syndrome is not the full quantum state",
    concept:
      "The stabilizer formalism is useful because it extracts the error footprint without exposing the encoded information directly. A syndrome tells you which checks were violated, not every amplitude or phase in the state.",
    task: "Answer the check before we move into the first concrete code example.",
    hint: "Ask what the measurement outcome is actually attached to: the stabilizer generators or the hidden logical state.",
    success: "You’ve separated syndrome information from full state information.",
    quiz: {
      prompt: "What does stabilizer measurement give you access to?",
      correct: "check-outcomes",
      options: [
        {
          id: "check-outcomes",
          label: "The outcomes of the stabilizer checks",
          explanation: "Correct. The measurement reveals which generators returned +1 or -1.",
        },
        {
          id: "all-amplitudes",
          label: "All amplitudes of the encoded state",
          explanation: "No. That would amount to learning much more than the stabilizer syndrome provides.",
        },
        {
          id: "logical-secret",
          label: "The protected logical value itself",
          explanation: "No. The code is built to protect that information from direct exposure during error diagnosis.",
        },
      ],
    },
  },
  {
    id: "repetition",
    title: "5. Repetition Code Explorer",
    headline: "A tiny stabilizer example",
    concept:
      "The three-qubit bit-flip code is a clean first stabilizer example. Its parity checks compare neighboring qubits, so a single X error is identified by which ZZ checks flip sign.",
    task: "Inject different X errors and see how the two parity checks distinguish the error location.",
    hint: "Try qubit 1, then qubit 2, then qubit 3. The middle qubit should flip both parity checks.",
    success: "You’ve seen how a small stabilizer code turns local errors into a readable syndrome pattern.",
    formula: "Generators: Z1Z2 and Z2Z3. Logical states are protected against one bit-flip error.",
  },
  {
    id: "repetition-readout",
    title: "6. Repetition Pattern Check",
    headline: "Syndrome patterns can point to a likely location",
    concept:
      "In the repetition code, different single-qubit X errors create different patterns of violated ZZ checks. This is the first small example of a decoder using syndrome structure to guess a correction.",
    task: "Answer the check and compare the answer to what you saw in the repetition explorer.",
    hint: "An X error on the middle qubit touches both neighboring parity checks, so both checks should flip.",
    success: "You’ve read a simple syndrome pattern and linked it to a likely error location.",
    quiz: {
      prompt: "In the 3-qubit repetition code, which single X error flips both Z1Z2 and Z2Z3?",
      correct: "middle",
      options: [
        {
          id: "middle",
          label: "An X error on qubit 2",
          explanation: "Correct. The middle qubit participates in both parity checks, so both outcomes flip.",
        },
        {
          id: "first",
          label: "An X error on qubit 1",
          explanation: "Not quite. Qubit 1 only affects the Z1Z2 check.",
        },
        {
          id: "third",
          label: "An X error on qubit 3",
          explanation: "Not quite. Qubit 3 only affects the Z2Z3 check.",
        },
      ],
    },
  },
  {
    id: "logical",
    title: "7. Logical Operators",
    headline: "Not every Pauli is detectable",
    concept:
      "A stabilizer can act trivially on the code space, while a logical operator preserves the code space but changes encoded information. Logical operators commute with the stabilizers but are not themselves in the stabilizer group.",
    task: "Answer the concept check, then compare the stabilizer and logical cards.",
    hint: "The important distinction is not just commutation. It is whether the operator is inside the stabilizer group or acts nontrivially on encoded states.",
    success: "You’ve separated stabilizers from logical operators, which is one of the most important stabilizer-formalism ideas.",
    formula: "Logical operators commute with S but are not generated by S",
    quiz: {
      prompt: "Which statement best describes a logical operator in the stabilizer formalism?",
      correct: "commutes-not-in",
      options: [
        {
          id: "commutes-not-in",
          label: "It commutes with the stabilizers but is not itself in the stabilizer group",
          explanation: "Correct. That is why it preserves the code space while acting nontrivially on encoded information.",
        },
        {
          id: "inside-group",
          label: "It is one of the stabilizer generators",
          explanation: "If it were in the stabilizer group, it would act trivially on every codeword.",
        },
        {
          id: "anticommutes-all",
          label: "It anticommutes with every stabilizer",
          explanation: "That would kick states out of the code space rather than act as a logical operator within it.",
        },
      ],
    },
  },
  {
    id: "logical-subtlety",
    title: "8. A Harder Logical Question",
    headline: "Commuting is necessary, but not the whole story",
    concept:
      "A logical operator must commute with the stabilizers so it preserves the code space, but that alone is not enough. If the operator is actually inside the stabilizer group, then it acts trivially rather than changing encoded information.",
    task: "Answer the check and focus on the extra condition beyond commutation.",
    hint: "Two operators can both commute with the stabilizers, but only one of them acts nontrivially on logical information.",
    success: "You’ve picked up the key subtlety that separates a genuine logical operator from a stabilizer.",
    quiz: {
      prompt: "Why isn’t 'commutes with all stabilizers' enough by itself to make an operator logical?",
      correct: "could-be-stabilizer",
      options: [
        {
          id: "could-be-stabilizer",
          label: "Because the operator might still be in the stabilizer group and act trivially",
          explanation: "Correct. A true logical operator commutes with the stabilizers but is not generated by them.",
        },
        {
          id: "must-anticommute",
          label: "Because logical operators should anticommute with every stabilizer",
          explanation: "No. Anticommuting with stabilizers would usually kick states out of the code space.",
        },
        {
          id: "must-measure",
          label: "Because logical operators must always be directly measurable",
          explanation: "That is not the defining issue. The key distinction is whether the operator acts nontrivially within the code space.",
        },
      ],
    },
  },
  {
    id: "shor",
    title: "9. Shor Code Explorer",
    headline: "Separate X and Z protection channels",
    concept:
      "Shor's 9-qubit code is a classic CSS-style example: one family of stabilizers detects bit flips, and another family detects phase flips. This separation is a big part of why the stabilizer formalism is so useful.",
    task: "Use the Shor-code explorer to compare how an X error and a Z error trigger different stabilizer families.",
    hint: "An X error should light up Z-type parity checks. A Z error should light up the large X-type block checks.",
    success: "You’ve seen a larger stabilizer code where different generator families diagnose different Pauli channels.",
    formula: "Example generators: Z1Z2, Z2Z3, ..., Z8Z9 and X1X2X3X4X5X6, X4X5X6X7X8X9",
  },
  {
    id: "steane-intro",
    title: "10. Steane Code Basics",
    headline: "Steane’s code is a 7-qubit CSS stabilizer code",
    concept:
      "The Steane code is another classic stabilizer example. Like other CSS codes, it separates X-type and Z-type checks into parallel families, which makes it natural to discuss bit-flip and phase-flip protection in a symmetric way.",
    task: "Answer the concept check before using the Steane support panel.",
    hint: "CSS means the code is built from separate X-check and Z-check structures rather than one mixed family.",
    success: "You’ve placed the Steane code in the bigger family of CSS stabilizer codes.",
    quiz: {
      prompt: "What is the most important structural feature of the Steane code in this lesson?",
      correct: "css",
      options: [
        {
          id: "css",
          label: "It is a CSS code with separate X-type and Z-type stabilizer families",
          explanation: "Correct. That separation is the key structural idea we want here.",
        },
        {
          id: "single-check",
          label: "It uses one giant stabilizer that detects every error alone",
          explanation: "No. Stabilizer codes use a family of checks, not one all-powerful measurement.",
        },
        {
          id: "classical-only",
          label: "It only protects classical information rather than quantum information",
          explanation: "No. The Steane code is a full quantum error-correcting code.",
        },
      ],
    },
  },
  {
    id: "steane-explorer",
    title: "11. Steane Syndrome Patterns",
    headline: "A richer code gives a richer syndrome",
    concept:
      "Compared with the repetition code, the Steane code has more checks and therefore a more detailed syndrome pattern. A single-qubit X or Z fault can trigger a distinctive subset of one stabilizer family while leaving the other family untouched.",
    task: "Use the Steane panel to switch between X and Z faults and compare the triggered check labels.",
    hint: "For a CSS code, X faults are diagnosed by Z-type checks, while Z faults are diagnosed by X-type checks.",
    success: "You’ve seen how a larger CSS code produces more informative syndrome patterns.",
    formula: "In a CSS code, X errors are caught by Z-type checks and Z errors are caught by X-type checks.",
  },
  {
    id: "steane-advanced",
    title: "12. Steane Comparison Check",
    headline: "Steane carries the same logic into a more capable code",
    concept:
      "The Steane code extends the same stabilizer logic you already used in the repetition and Shor examples, but with a structure that can correct arbitrary single-qubit errors rather than only one Pauli channel in isolation.",
    task: "Answer the check and compare Steane to the earlier examples.",
    hint: "Repetition is a narrow first example. Steane is a fuller quantum code with both X and Z protection built into its stabilizer families.",
    success: "You’ve connected the Steane code to the broader lesson arc from simple parity checks to full CSS quantum codes.",
    quiz: {
      prompt: "Why is the Steane code a stronger teaching example than the 3-qubit repetition code?",
      correct: "both-channels",
      options: [
        {
          id: "both-channels",
          label: "Because it protects against both X-type and Z-type single-qubit errors within one CSS framework",
          explanation: "Correct. That is a big conceptual step beyond the single-channel repetition example.",
        },
        {
          id: "fewer-qubits",
          label: "Because it uses fewer qubits and therefore simpler syndromes",
          explanation: "No. The Steane code uses more qubits and richer syndrome structure.",
        },
        {
          id: "no-syndrome",
          label: "Because it avoids syndrome measurements altogether",
          explanation: "No. The Steane code is still a stabilizer code and still relies on syndrome information.",
        },
      ],
    },
  },
  {
    id: "decoding",
    title: "13. Decoder Input",
    headline: "The decoder only sees the syndrome",
    concept:
      "Once the stabilizer measurements are collected, a decoder proposes a recovery operator. The decoder never sees the original state directly. It only uses the syndrome pattern and code structure to infer a likely correction.",
    task: "Answer the check, then inspect the decoder view in the side panel.",
    hint: "In both examples, the syndrome narrows down likely errors without measuring the logical information you want to keep.",
    success: "You’ve completed the stabilizer-formalism lesson and reached the main decoding idea.",
    formula: "Measure generators -> read syndrome -> infer recovery operator",
    quiz: {
      prompt: "What information does a decoder fundamentally work from?",
      correct: "syndrome",
      options: [
        {
          id: "syndrome",
          label: "The stabilizer syndrome",
          explanation: "Right. The decoder works from the measured check outcomes.",
        },
        {
          id: "wavefunction",
          label: "The full encoded wavefunction",
          explanation: "No. Directly measuring that would defeat the purpose of error correction.",
        },
        {
          id: "hidden-logical",
          label: "The hidden logical value",
          explanation: "The logical information is exactly what the code is trying to protect from direct exposure.",
        },
      ],
    },
  },
  {
    id: "decoding-hard",
    title: "14. Harder Decoding Idea",
    headline: "Decoding is about likely recovery, not perfect historical knowledge",
    concept:
      "A decoder often cannot determine the unique physical history that caused a syndrome. Different error patterns can look the same to the stabilizer measurements, so decoding is fundamentally about choosing a correction consistent with the observed syndrome and the code model.",
    task: "Answer the final harder question and focus on the difference between exact diagnosis and useful recovery.",
    hint: "The decoder’s job is not to reconstruct the past with certainty. It is to apply a correction that restores the code space without causing a logical failure.",
    success: "You’ve reached the deeper decoding viewpoint: syndrome-based recovery is an inference problem, not a direct readout of history.",
    quiz: {
      prompt: "Why can decoding be ambiguous even when the syndrome is measured perfectly?",
      correct: "same-syndrome",
      options: [
        {
          id: "same-syndrome",
          label: "Because different physical errors can produce the same syndrome pattern",
          explanation: "Correct. The decoder may only know an equivalence class of likely errors, not one unique physical event.",
        },
        {
          id: "no-checks",
          label: "Because stabilizer codes do not actually use measurement outcomes",
          explanation: "No. The syndrome is exactly the measured check data the decoder works from.",
        },
        {
          id: "logical-reveal",
          label: "Because the decoder first reads the logical qubit and then guesses the error",
          explanation: "No. Reading the logical state directly would defeat the purpose of fault-tolerant protection.",
        },
      ],
    },
  },
];

function panelStyle(): React.CSSProperties {
  return {
    background: "white",
    border: "1px solid #d7e1ea",
    borderRadius: 24,
    padding: 22,
    boxShadow: "0 18px 45px rgba(15, 23, 42, 0.07)",
  };
}

function buttonStyle(active: boolean, disabled = false): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: `1px solid ${
      disabled ? "#cbd5e1" : active ? "#0f172a" : "#cbd5e1"
    }`,
    background: disabled ? "#f8fafc" : active ? "#0f172a" : "white",
    color: disabled ? "#94a3b8" : active ? "white" : "#0f172a",
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 600,
    opacity: disabled ? 0.72 : 1,
  };
}

function tagStyle(background: string, color: string): React.CSSProperties {
  return {
    display: "inline-block",
    padding: "7px 11px",
    borderRadius: 999,
    background,
    color,
    fontSize: 12,
    marginRight: 8,
    marginBottom: 8,
  };
}

function parityLabel(value: number) {
  return value === 1 ? "+1" : "-1";
}

const KEY_TERMS = [
  {
    title: "Stabilizer Group",
    body: (
      <>
        A commuting subgroup of the Pauli group that does not contain <code>-I</code>.
        Its joint <code>+1</code> eigenspace is the protected code space.
      </>
    ),
  },
  {
    title: "Syndrome",
    body: (
      <>
        The list of stabilizer measurement outcomes. A <code>-1</code> marks a violated
        check and helps locate the likely error.
      </>
    ),
  },
  {
    title: "Logical Operators",
    body: (
      <>
        Operators that preserve the code space by commuting with all stabilizers, but still
        act nontrivially on the encoded qubits.
      </>
    ),
  },
  {
    title: "Decoder",
    body: (
      <>
        A rule or algorithm that maps the measured syndrome to a recovery operator, ideally
        without changing the logical information.
      </>
    ),
  },
];

export default function StabilizerLesson() {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [repetitionError, setRepetitionError] = useState<RepetitionSelection>(0);
  const [shorErrorType, setShorErrorType] = useState<ShorError>("none");
  const [shorQubit, setShorQubit] = useState(1);
  const [steaneErrorType, setSteaneErrorType] = useState<SteaneError>("none");
  const [steaneQubit, setSteaneQubit] = useState(1);

  const step = LESSONS[stepIndex];
  const answer = answers[step.id];
  const quizPassed = !step.quiz || answer === step.quiz.correct;

  const repetitionBits = useMemo(() => {
    const bits = [0, 0, 0];
    if (repetitionError > 0) bits[repetitionError - 1] = 1;
    return bits;
  }, [repetitionError]);

  const repetitionSyndrome = useMemo(() => {
    const s12 = repetitionBits[0] === repetitionBits[1] ? 1 : -1;
    const s23 = repetitionBits[1] === repetitionBits[2] ? 1 : -1;
    return { s12, s23 };
  }, [repetitionBits]);

  const shorDetections = useMemo(() => {
    if (shorErrorType === "none") return [] as string[];
    const q = shorQubit;
    if (shorErrorType === "X") {
      const checks: string[] = [];
      const pairs = [
        { label: "Z1Z2", qubits: [1, 2] },
        { label: "Z2Z3", qubits: [2, 3] },
        { label: "Z4Z5", qubits: [4, 5] },
        { label: "Z5Z6", qubits: [5, 6] },
        { label: "Z7Z8", qubits: [7, 8] },
        { label: "Z8Z9", qubits: [8, 9] },
      ];
      for (const pair of pairs) {
        if (pair.qubits.includes(q)) checks.push(pair.label);
      }
      return checks;
    }

    const checks: string[] = [];
    if (q >= 1 && q <= 6) checks.push("X1X2X3X4X5X6");
    if (q >= 4 && q <= 9) checks.push("X4X5X6X7X8X9");
    return checks;
  }, [shorErrorType, shorQubit]);

  const steaneDetections = useMemo(() => {
    if (steaneErrorType === "none") return [] as string[];
    const parityChecks = [
      { zLabel: "Z-type A", xLabel: "X-type A", qubits: [1, 3, 5, 7] },
      { zLabel: "Z-type B", xLabel: "X-type B", qubits: [2, 3, 6, 7] },
      { zLabel: "Z-type C", xLabel: "X-type C", qubits: [4, 5, 6, 7] },
    ];

    return parityChecks
      .filter((check) => check.qubits.includes(steaneQubit))
      .map((check) => (steaneErrorType === "X" ? check.zLabel : check.xLabel));
  }, [steaneErrorType, steaneQubit]);

  const stepComplete = useMemo(() => {
    switch (step.id) {
      case "definition":
      case "commuting":
      case "syndrome-intro":
      case "syndrome-basic":
      case "repetition-readout":
      case "logical":
      case "logical-subtlety":
      case "steane-intro":
      case "steane-advanced":
      case "decoding":
      case "decoding-hard":
        return quizPassed;
      case "repetition":
        return repetitionError > 0;
      case "shor":
        return shorErrorType !== "none";
      case "steane-explorer":
        return steaneErrorType !== "none";
      default:
        return false;
    }
  }, [step.id, quizPassed, repetitionError, shorErrorType, steaneErrorType]);

  const completedSteps = LESSONS.filter((_, index) => index < stepIndex || (index === stepIndex && stepComplete)).length;
  const quizFeedback = step.quiz?.options.find((option) => option.id === answer)?.explanation;
  const progressPercent = (completedSteps / LESSONS.length) * 100;
  const isExplorerStep =
    step.id === "repetition" || step.id === "shor" || step.id === "steane-explorer";
  const stepActionLabel = step.quiz
    ? "Answer the check to continue."
    : isExplorerStep
      ? "Use the interactive panel to complete this step."
      : "Review the support panel, then continue.";

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, #dff7f1 0%, transparent 30%), linear-gradient(180deg, #f7fbff 0%, #eef4fb 52%, #e6edf7 100%)",
        padding: 24,
        fontFamily: "Avenir Next, Segoe UI, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", flexDirection: "column", gap: 22 }}>
        <div
          style={{
            ...panelStyle(),
            padding: 24,
            background: "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(239,248,255,0.94) 100%)",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 18,
              marginBottom: 18,
            }}
          >
            <div style={{ maxWidth: 640 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  color: "#0f766e",
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                Standalone Module
              </div>
              <h1 style={{ margin: "0 0 8px", fontSize: 34, color: "#0f172a" }}>
                Learn Stabilizer Formalism
              </h1>
              <p style={{ margin: 0, color: "#475569", fontSize: 15, lineHeight: 1.6 }}>
                A guided walkthrough from stabilizer definitions to syndrome-based recovery,
                with each step revealing only the reference or simulator you need next.
              </p>
            </div>

            <div style={{ minWidth: 220 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#0f766e", marginBottom: 8 }}>
                Progress
              </div>
              <div
                style={{
                  height: 12,
                  borderRadius: 999,
                  background: "#dbeafe",
                  overflow: "hidden",
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    width: `${progressPercent}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, #0f766e 0%, #2563eb 100%)",
                  }}
                />
              </div>
              <div style={{ fontSize: 13, color: "#475569" }}>
                {completedSteps} of {LESSONS.length} steps complete
              </div>
            </div>
          </div>

        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.35fr) minmax(320px, 0.9fr)",
            gap: 22,
            alignItems: "start",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ ...panelStyle(), padding: 28 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                <div style={tagStyle("#ccfbf1", "#115e59")}>Step {stepIndex + 1}</div>
                <div style={tagStyle("#e0e7ff", "#3730a3")}>
                  {stepComplete ? "Completed" : "In progress"}
                </div>
              </div>

              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f766e", marginBottom: 8 }}>
                {step.title}
              </div>
              <h2 style={{ margin: "0 0 14px", fontSize: 32, lineHeight: 1.15, color: "#0f172a" }}>
                {step.headline}
              </h2>
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.75, color: "#334155" }}>
                {step.concept}
              </p>

              <div
                style={{
                  marginTop: 20,
                  border: "1px solid #dbe5f0",
                  borderRadius: 18,
                  padding: 18,
                  background: "#f8fbff",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: "#0f766e", marginBottom: 8 }}>
                  Your task
                </div>
                <div style={{ fontSize: 15, color: "#0f172a", lineHeight: 1.6, marginBottom: 8 }}>
                  {step.task}
                </div>
                <div style={{ fontSize: 13, color: "#64748b" }}>{stepActionLabel}</div>
              </div>

              {step.quiz && (
                <div style={{ marginTop: 22 }}>
                  <h3 style={{ margin: "0 0 10px", fontSize: 20, color: "#0f172a" }}>
                    Concept check
                  </h3>
                  <div style={{ fontSize: 15, color: "#0f172a", marginBottom: 12 }}>
                    {step.quiz.prompt}
                  </div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {step.quiz.options.map((option) => {
                      const selected = answer === option.id;
                      const correct = option.id === step.quiz?.correct;
                      return (
                        <button
                          key={option.id}
                          onClick={() => setAnswers((prev) => ({ ...prev, [step.id]: option.id }))}
                          style={{
                            padding: "14px 16px",
                            borderRadius: 16,
                            border: `1px solid ${
                              selected ? (correct ? "#16a34a" : "#fb923c") : "#cbd5e1"
                            }`,
                            background: selected
                              ? correct
                                ? "#f0fdf4"
                                : "#fff7ed"
                              : "white",
                            textAlign: "left",
                            cursor: "pointer",
                            fontWeight: 600,
                            color: "#0f172a",
                            lineHeight: 1.5,
                          }}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  <div
                    style={{
                      marginTop: 12,
                      fontSize: 14,
                      lineHeight: 1.6,
                      color: quizPassed ? "#166534" : "#7c2d12",
                    }}
                  >
                    {quizFeedback ?? "Pick an answer to unlock the next step."}
                  </div>
                </div>
              )}

              {!step.quiz && (
                <div
                  style={{
                    marginTop: 22,
                    padding: 18,
                    borderRadius: 18,
                    background: "#fff7ed",
                    border: "1px solid #fed7aa",
                    color: "#9a3412",
                    fontSize: 14,
                    lineHeight: 1.6,
                  }}
                >
                  This step is completed by working in the contextual panel on the right.
                  Try a selection there, then continue once the idea clicks.
                </div>
              )}

              <div
                style={{
                  marginTop: 22,
                  padding: 18,
                  borderRadius: 18,
                  background: stepComplete ? "#dcfce7" : "#f8fafc",
                  border: `1px solid ${stepComplete ? "#86efac" : "#dbe5f0"}`,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: "#0f766e", marginBottom: 6 }}>
                  Takeaway
                </div>
                <div
                  style={{
                    fontSize: 14,
                    lineHeight: 1.65,
                    color: stepComplete ? "#166534" : "#475569",
                  }}
                >
                  {stepComplete
                    ? step.success
                    : "Finish the current check or interaction to unlock the next step."}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: 24,
                }}
              >
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    style={buttonStyle(false, stepIndex === 0)}
                    onClick={() => setStepIndex((value) => Math.max(0, value - 1))}
                    disabled={stepIndex === 0}
                  >
                    Previous
                  </button>
                  <button
                    style={buttonStyle(false)}
                    onClick={() => {
                      setAnswers({});
                      setRepetitionError(0);
                      setShorErrorType("none");
                      setShorQubit(1);
                      setSteaneErrorType("none");
                      setSteaneQubit(1);
                      setStepIndex(0);
                    }}
                  >
                    Restart lesson
                  </button>
                </div>

                <button
                  style={buttonStyle(stepComplete, !stepComplete || stepIndex === LESSONS.length - 1)}
                  onClick={() => setStepIndex((value) => Math.min(LESSONS.length - 1, value + 1))}
                  disabled={!stepComplete || stepIndex === LESSONS.length - 1}
                >
                  {stepIndex === LESSONS.length - 1 ? "Lesson complete" : "Continue"}
                </button>
              </div>
            </div>

            <div style={panelStyle()}>
              <h3 style={{ margin: "0 0 10px", color: "#0f172a" }}>Why this matters</h3>
              <div style={{ color: "#334155", fontSize: 14, lineHeight: 1.7 }}>
                Stabilizer language is the bridge between abstract Pauli algebra and practical
                error correction. Once commuting checks, syndrome bits, and logical operators
                feel intuitive, larger codes become much easier to reason about.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={panelStyle()}>
              {step.id === "definition" ||
              step.id === "commuting" ||
              step.id === "logical" ||
              step.id === "logical-subtlety" ? (
                <>
                  <h3 style={{ margin: "0 0 8px", color: "#0f172a" }}>Key terms</h3>
                  <div style={{ color: "#64748b", fontSize: 14, lineHeight: 1.6, marginBottom: 14 }}>
                    Keep this reference nearby while you build the algebraic picture.
                  </div>
                  <div style={{ display: "grid", gap: 12 }}>
                    {KEY_TERMS.map((term) => (
                      <div
                        key={term.title}
                        style={{
                          border: "1px solid #dbe5f0",
                          borderRadius: 18,
                          padding: 16,
                          background: "#f8fafc",
                        }}
                      >
                        <div style={{ fontWeight: 700, marginBottom: 6, color: "#0f172a" }}>
                          {term.title}
                        </div>
                        <div style={{ fontSize: 14, color: "#334155", lineHeight: 1.65 }}>
                          {term.body}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : step.id === "syndrome-intro" ||
                step.id === "syndrome-basic" ||
                step.id === "repetition" ||
                step.id === "repetition-readout" ? (
                <>
                  <h3 style={{ margin: "0 0 8px", color: "#0f172a" }}>
                    3-Bit Repetition Code Explorer
                  </h3>
                  <div style={{ color: "#64748b", fontSize: 14, lineHeight: 1.6, marginBottom: 14 }}>
                    Watch how a single X fault changes the ZZ parity checks and creates a
                    readable syndrome pattern.
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8, marginBottom: 14 }}>
                    {([
                      { value: 0 as RepetitionSelection, label: "No error" },
                      { value: 1 as RepetitionSelection, label: "X on q1" },
                      { value: 2 as RepetitionSelection, label: "X on q2" },
                      { value: 3 as RepetitionSelection, label: "X on q3" },
                    ]).map((option) => (
                      <button
                        key={option.label}
                        style={buttonStyle(repetitionError === option.value)}
                        onClick={() => setRepetitionError(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginBottom: 14 }}>
                    {repetitionBits.map((bit, index) => (
                      <div
                        key={index}
                        style={{
                          border: "1px solid #dbe5f0",
                          borderRadius: 18,
                          padding: 16,
                          textAlign: "center",
                          background: bit === 1 ? "#fff7ed" : "#f8fafc",
                        }}
                      >
                        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>
                          Qubit {index + 1}
                        </div>
                        <div
                          style={{
                            fontSize: 28,
                            fontWeight: 700,
                            color: bit === 1 ? "#c2410c" : "#0f172a",
                          }}
                        >
                          {bit}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div
                      style={{
                        border: "1px solid #dbe5f0",
                        borderRadius: 18,
                        padding: 16,
                        background: "#f8fafc",
                      }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>Stabilizer Z1Z2</div>
                      <div
                        style={{
                          fontSize: 28,
                          fontWeight: 700,
                          color: repetitionSyndrome.s12 === 1 ? "#166534" : "#b45309",
                        }}
                      >
                        {parityLabel(repetitionSyndrome.s12)}
                      </div>
                      <div style={{ fontSize: 13, color: "#475569", marginTop: 6 }}>
                        {repetitionSyndrome.s12 === 1
                          ? "Parity agrees"
                          : "Parity mismatch detected"}
                      </div>
                    </div>
                    <div
                      style={{
                        border: "1px solid #dbe5f0",
                        borderRadius: 18,
                        padding: 16,
                        background: "#f8fafc",
                      }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>Stabilizer Z2Z3</div>
                      <div
                        style={{
                          fontSize: 28,
                          fontWeight: 700,
                          color: repetitionSyndrome.s23 === 1 ? "#166534" : "#b45309",
                        }}
                      >
                        {parityLabel(repetitionSyndrome.s23)}
                      </div>
                      <div style={{ fontSize: 13, color: "#475569", marginTop: 6 }}>
                        {repetitionSyndrome.s23 === 1
                          ? "Parity agrees"
                          : "Parity mismatch detected"}
                      </div>
                    </div>
                  </div>
                </>
              ) : step.id === "shor" ? (
                <>
                  <h3 style={{ margin: "0 0 8px", color: "#0f172a" }}>Shor Code Explorer</h3>
                  <div style={{ color: "#64748b", fontSize: 14, lineHeight: 1.6, marginBottom: 14 }}>
                    Compare how X and Z faults trigger different stabilizer families in a
                    simple CSS-style picture.
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                    {(["none", "X", "Z"] as ShorError[]).map((error) => (
                      <button
                        key={error}
                        style={buttonStyle(shorErrorType === error)}
                        onClick={() => setShorErrorType(error)}
                      >
                        {error === "none" ? "No error" : `${error} error`}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(9, minmax(0, 1fr))", gap: 8, marginBottom: 14 }}>
                    {Array.from({ length: 9 }, (_, index) => index + 1).map((q) => {
                      const selected = q === shorQubit;
                      return (
                        <button
                          key={q}
                          style={{ ...buttonStyle(selected), padding: "12px 0" }}
                          onClick={() => setShorQubit(q)}
                        >
                          q{q}
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div
                      style={{
                        border: "1px solid #dbe5f0",
                        borderRadius: 18,
                        padding: 16,
                        background: "#f8fafc",
                      }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: 8 }}>Selected fault</div>
                      <div style={{ fontSize: 18, color: "#0f172a" }}>
                        {shorErrorType === "none"
                          ? "No injected error"
                          : `${shorErrorType} on qubit ${shorQubit}`}
                      </div>
                      <div style={{ fontSize: 13, color: "#475569", marginTop: 8, lineHeight: 1.6 }}>
                        X faults are picked up by Z-type parity checks. Z faults are picked up
                        by the large X-type block checks.
                      </div>
                    </div>
                    <div
                      style={{
                        border: "1px solid #dbe5f0",
                        borderRadius: 18,
                        padding: 16,
                        background: "#f8fafc",
                      }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: 8 }}>Detected stabilizers</div>
                      {shorDetections.length === 0 ? (
                        <div style={{ fontSize: 13, color: "#475569" }}>
                          No violated stabilizers for the current selection.
                        </div>
                      ) : (
                        shorDetections.map((label) => (
                          <div key={label} style={tagStyle("#fef3c7", "#92400e")}>
                            {label} {"->"} -1
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              ) : step.id === "steane-intro" ||
                step.id === "steane-explorer" ||
                step.id === "steane-advanced" ? (
                <>
                  <h3 style={{ margin: "0 0 8px", color: "#0f172a" }}>Steane Code Panel</h3>
                  <div style={{ color: "#64748b", fontSize: 14, lineHeight: 1.6, marginBottom: 14 }}>
                    This simplified panel highlights the CSS structure of the 7-qubit Steane
                    code. Use it to connect X faults to Z-type checks and Z faults to X-type
                    checks.
                  </div>

                  <div
                    style={{
                      border: "1px solid #dbe5f0",
                      borderRadius: 18,
                      padding: 16,
                      background: "#f8fafc",
                      marginBottom: 14,
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>Why Steane matters here</div>
                    <div style={{ fontSize: 14, lineHeight: 1.65, color: "#334155" }}>
                      The repetition code showed a single error channel clearly. Shor showed
                      separate stabilizer families. Steane keeps that CSS logic but in a more
                      balanced 7-qubit code that can diagnose both X-type and Z-type single-qubit
                      faults.
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                    {(["none", "X", "Z"] as SteaneError[]).map((error) => (
                      <button
                        key={error}
                        style={buttonStyle(steaneErrorType === error)}
                        onClick={() => setSteaneErrorType(error)}
                      >
                        {error === "none" ? "No error" : `${error} error`}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 8, marginBottom: 14 }}>
                    {Array.from({ length: 7 }, (_, index) => index + 1).map((q) => {
                      const selected = q === steaneQubit;
                      return (
                        <button
                          key={q}
                          style={{ ...buttonStyle(selected), padding: "12px 0" }}
                          onClick={() => setSteaneQubit(q)}
                        >
                          q{q}
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ display: "grid", gap: 12 }}>
                    <div
                      style={{
                        border: "1px solid #dbe5f0",
                        borderRadius: 18,
                        padding: 16,
                        background: "#f8fafc",
                      }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: 8 }}>Selected fault</div>
                      <div style={{ fontSize: 18, color: "#0f172a" }}>
                        {steaneErrorType === "none"
                          ? "No injected error"
                          : `${steaneErrorType} on qubit ${steaneQubit}`}
                      </div>
                      <div style={{ fontSize: 13, color: "#475569", marginTop: 8, lineHeight: 1.6 }}>
                        In this simplified view, each qubit belongs to a recognizable subset of
                        three parity checks. That subset becomes the syndrome signature for a
                        single-qubit error in the opposite stabilizer family.
                      </div>
                    </div>

                    <div
                      style={{
                        border: "1px solid #dbe5f0",
                        borderRadius: 18,
                        padding: 16,
                        background: "#f8fafc",
                      }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: 8 }}>Triggered checks</div>
                      {steaneDetections.length === 0 ? (
                        <div style={{ fontSize: 13, color: "#475569" }}>
                          No violated checks for the current selection.
                        </div>
                      ) : (
                        steaneDetections.map((label) => (
                          <div key={label} style={tagStyle("#dbeafe", "#1d4ed8")}>
                            {label} {"->"} -1
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <h3 style={{ margin: "0 0 8px", color: "#0f172a" }}>Decoder view</h3>
                  <div style={{ color: "#64748b", fontSize: 14, lineHeight: 1.6, marginBottom: 14 }}>
                    The decoder never sees the quantum state itself. It only sees syndrome
                    evidence like the patterns below and proposes a likely recovery.
                  </div>

                  <div style={{ display: "grid", gap: 12 }}>
                    <div
                      style={{
                        border: "1px solid #dbe5f0",
                        borderRadius: 18,
                        padding: 16,
                        background: "#f8fafc",
                      }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>Repetition-code snapshot</div>
                      <div style={{ fontSize: 14, color: "#334155", lineHeight: 1.6 }}>
                        Current selection:{" "}
                        {repetitionError === 0 ? "no error selected" : `X on q${repetitionError}`}
                      </div>
                      <div style={{ marginTop: 10 }}>
                        <span style={tagStyle("#dcfce7", "#166534")}>
                          Z1Z2 {parityLabel(repetitionSyndrome.s12)}
                        </span>
                        <span style={tagStyle("#dcfce7", "#166534")}>
                          Z2Z3 {parityLabel(repetitionSyndrome.s23)}
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        border: "1px solid #dbe5f0",
                        borderRadius: 18,
                        padding: 16,
                        background: "#f8fafc",
                      }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>Shor-code snapshot</div>
                      <div style={{ fontSize: 14, color: "#334155", lineHeight: 1.6 }}>
                        Current selection:{" "}
                        {shorErrorType === "none"
                          ? "no injected fault"
                          : `${shorErrorType} on qubit ${shorQubit}`}
                      </div>
                      <div style={{ marginTop: 10 }}>
                        {shorDetections.length === 0 ? (
                          <span style={tagStyle("#e2e8f0", "#475569")}>No violated checks</span>
                        ) : (
                          shorDetections.map((label) => (
                            <span key={label} style={tagStyle("#fef3c7", "#92400e")}>
                              {label} {"->"} -1
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        border: "1px solid #dbe5f0",
                        borderRadius: 18,
                        padding: 16,
                        background: "#f8fafc",
                      }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>Steane-code snapshot</div>
                      <div style={{ fontSize: 14, color: "#334155", lineHeight: 1.6 }}>
                        Current selection:{" "}
                        {steaneErrorType === "none"
                          ? "no injected fault"
                          : `${steaneErrorType} on qubit ${steaneQubit}`}
                      </div>
                      <div style={{ marginTop: 10 }}>
                        {steaneDetections.length === 0 ? (
                          <span style={tagStyle("#e2e8f0", "#475569")}>No violated checks</span>
                        ) : (
                          steaneDetections.map((label) => (
                            <span key={label} style={tagStyle("#dbeafe", "#1d4ed8")}>
                              {label} {"->"} -1
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div style={panelStyle()}>
              <details>
                <summary style={{ cursor: "pointer", fontWeight: 700, color: "#0f172a" }}>
                  Need a hint or formula?
                </summary>
                <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
                  <div
                    style={{
                      border: "1px solid #dbe5f0",
                      borderRadius: 18,
                      padding: 16,
                      background: "#f8fafc",
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#0f766e", marginBottom: 6 }}>
                      Hint
                    </div>
                    <div style={{ fontSize: 14, lineHeight: 1.65, color: "#334155" }}>
                      {step.hint}
                    </div>
                  </div>
                  {step.formula && (
                    <div
                      style={{
                        border: "1px solid #ddd6fe",
                        borderRadius: 18,
                        padding: 16,
                        background: "#f5f3ff",
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#6d28d9", marginBottom: 6 }}>
                        Key formula
                      </div>
                      <div style={{ fontSize: 14, lineHeight: 1.65, color: "#4c1d95" }}>
                        {step.formula}
                      </div>
                    </div>
                  )}
                </div>
              </details>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
