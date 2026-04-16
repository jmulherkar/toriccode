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

const LESSONS: LessonStep[] = [
  {
    id: "definition",
    title: "1. What A Stabilizer Code Is",
    headline: "The code space is defined by commuting Pauli checks",
    concept:
      "The stabilizer formalism describes a quantum code through a commuting set of Pauli operators. Valid code states are the states that return +1 when measured against every generator in that set.",
    task: "Answer the concept check, then read the generator card.",
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
    id: "syndrome",
    title: "2. Syndrome As Check Outcomes",
    headline: "Errors are detected through sign flips",
    concept:
      "We do not measure the logical state directly. Instead, we measure stabilizer generators. If an error anticommutes with a generator, that generator's outcome flips from +1 to -1 and contributes to the syndrome.",
    task: "Answer the check, then use the repetition-code explorer to inject a bit flip and inspect the syndrome.",
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
    id: "repetition",
    title: "3. Bit-Flip Repetition Code",
    headline: "A tiny stabilizer example",
    concept:
      "The three-qubit bit-flip code is a clean first stabilizer example. Its parity checks compare neighboring qubits, so a single X error is identified by which ZZ checks flip sign.",
    task: "Inject different X errors and see how the two parity checks distinguish the error location.",
    hint: "Try qubit 1, then qubit 2, then qubit 3. The middle qubit should flip both parity checks.",
    success: "You’ve seen how a small stabilizer code turns local errors into a readable syndrome pattern.",
    formula: "Generators: Z1Z2 and Z2Z3. Logical states are protected against one bit-flip error.",
  },
  {
    id: "logical",
    title: "4. Logical Operators",
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
    id: "shor",
    title: "5. Shor Code As A CSS Example",
    headline: "Separate X and Z protection channels",
    concept:
      "Shor's 9-qubit code is a classic CSS-style example: one family of stabilizers detects bit flips, and another family detects phase flips. This separation is a big part of why the stabilizer formalism is so useful.",
    task: "Use the Shor-code explorer to compare how an X error and a Z error trigger different stabilizer families.",
    hint: "An X error should light up Z-type parity checks. A Z error should light up the large X-type block checks.",
    success: "You’ve seen a larger stabilizer code where different generator families diagnose different Pauli channels.",
    formula: "Example generators: Z1Z2, Z2Z3, ..., Z8Z9 and X1X2X3X4X5X6, X4X5X6X7X8X9",
  },
  {
    id: "decoding",
    title: "6. From Syndrome To Recovery",
    headline: "The decoder only sees the syndrome",
    concept:
      "Once the stabilizer measurements are collected, a decoder proposes a recovery operator. The decoder never sees the original state directly. It only uses the syndrome pattern and code structure to infer a likely correction.",
    task: "Answer the final check, then compare the repetition-code and Shor-code examples as miniature decoders.",
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
];

function panelStyle(): React.CSSProperties {
  return {
    background: "white",
    border: "1px solid #d7e1ea",
    borderRadius: 20,
    padding: 18,
    boxShadow: "0 12px 30px rgba(15, 23, 42, 0.06)",
  };
}

function buttonStyle(active: boolean): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: `1px solid ${active ? "#0f172a" : "#cbd5e1"}`,
    background: active ? "#0f172a" : "white",
    color: active ? "white" : "#0f172a",
    cursor: "pointer",
    fontWeight: 600,
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

export default function StabilizerLesson() {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [repetitionError, setRepetitionError] = useState<RepetitionSelection>(0);
  const [shorErrorType, setShorErrorType] = useState<ShorError>("none");
  const [shorQubit, setShorQubit] = useState(1);

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

  const stepComplete = useMemo(() => {
    switch (step.id) {
      case "definition":
      case "syndrome":
      case "logical":
      case "decoding":
        return quizPassed;
      case "repetition":
        return repetitionError > 0;
      case "shor":
        return shorErrorType !== "none";
      default:
        return false;
    }
  }, [step.id, quizPassed, repetitionError, shorErrorType]);

  const completedSteps = LESSONS.filter((_, index) => index < stepIndex || (index === stepIndex && stepComplete)).length;
  const quizFeedback = step.quiz?.options.find((option) => option.id === answer)?.explanation;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #f5f7fb 0%, #e9eef7 100%)",
        padding: 24,
        fontFamily: "Avenir Next, Segoe UI, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1380, margin: "0 auto", display: "grid", gridTemplateColumns: "380px 1fr", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ ...panelStyle(), background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: "#0f766e", textTransform: "uppercase" }}>
              Standalone Module
            </div>
            <h2 style={{ margin: "8px 0 6px", fontSize: 30 }}>Learn Stabilizer Formalism</h2>
            <p style={{ margin: 0, color: "#475569", fontSize: 14 }}>
              A board-free lesson using repetition-code and Shor-code examples to build stabilizer intuition step by step.
            </p>

            <div style={{ marginTop: 14, marginBottom: 10, height: 10, borderRadius: 999, background: "#dbeafe", overflow: "hidden" }}>
              <div
                style={{
                  width: `${(completedSteps / LESSONS.length) * 100}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, #0f766e 0%, #2563eb 100%)",
                }}
              />
            </div>

            <div style={{ fontSize: 12, color: "#475569", marginBottom: 14 }}>
              Progress: {completedSteps}/{LESSONS.length} steps complete
            </div>

            <div style={{ ...panelStyle(), padding: 14, background: "#f8fafc", boxShadow: "none" }}>
              <div style={{ fontSize: 12, color: "#0f766e", fontWeight: 700 }}>{step.title}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", margin: "4px 0 8px" }}>{step.headline}</div>
              <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.6, marginBottom: 10 }}>{step.concept}</div>
              <div style={tagStyle("#e0f2fe", "#0c4a6e")}>Goal: {step.task}</div>
              <div style={tagStyle("#ecfccb", "#3f6212")}>Hint: {step.hint}</div>
              {step.formula && <div style={tagStyle("#ede9fe", "#5b21b6")}>Key formula: {step.formula}</div>}
              <div
                style={{
                  marginTop: 8,
                  padding: 12,
                  borderRadius: 14,
                  background: stepComplete ? "#dcfce7" : "#fff7ed",
                  color: stepComplete ? "#166534" : "#9a3412",
                  fontSize: 13,
                  border: `1px solid ${stepComplete ? "#86efac" : "#fed7aa"}`,
                }}
              >
                {stepComplete ? step.success : "Current step is still in progress."}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 12 }}>
              <button style={buttonStyle(false)} onClick={() => setStepIndex((value) => Math.max(0, value - 1))} disabled={stepIndex === 0}>
                Previous
              </button>
              <button style={buttonStyle(false)} onClick={() => {
                setAnswers({});
                setRepetitionError(0);
                setShorErrorType("none");
                setShorQubit(1);
                setStepIndex(0);
              }}>
                Restart
              </button>
              <button
                style={buttonStyle(stepComplete)}
                onClick={() => setStepIndex((value) => Math.min(LESSONS.length - 1, value + 1))}
                disabled={!stepComplete || stepIndex === LESSONS.length - 1}
              >
                Next
              </button>
            </div>
          </div>

          <div style={panelStyle()}>
            <h3 style={{ marginTop: 0, marginBottom: 10 }}>Concept Check</h3>
            {step.quiz ? (
              <>
                <div style={{ fontSize: 14, color: "#0f172a", marginBottom: 10 }}>{step.quiz.prompt}</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {step.quiz.options.map((option) => {
                    const selected = answer === option.id;
                    const correct = option.id === step.quiz?.correct;
                    return (
                      <button
                        key={option.id}
                        onClick={() => setAnswers((prev) => ({ ...prev, [step.id]: option.id }))}
                        style={{
                          padding: "11px 12px",
                          borderRadius: 12,
                          border: `1px solid ${selected ? (correct ? "#16a34a" : "#fb923c") : "#cbd5e1"}`,
                          background: selected ? (correct ? "#f0fdf4" : "#fff7ed") : "white",
                          textAlign: "left",
                          cursor: "pointer",
                          fontWeight: 600,
                          color: "#0f172a",
                        }}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ marginTop: 10, fontSize: 13, color: quizPassed ? "#166534" : "#7c2d12" }}>
                  {quizFeedback ?? "Pick an answer to unlock the next step."}
                </div>
              </>
            ) : (
              <div style={{ color: "#64748b", fontSize: 14 }}>
                This step is driven by the interactive example on the right rather than a quiz.
              </div>
            )}
          </div>

          <div style={panelStyle()}>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Why This Matters</h3>
            <div style={{ color: "#334155", fontSize: 13, lineHeight: 1.6 }}>
              Stabilizer language is the bridge between abstract Pauli algebra and practical error correction. Once the idea of commuting checks, syndrome bits, and logical operators is clear, larger codes become much easier to reason about.
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={panelStyle()}>
            <h2 style={{ marginTop: 0, marginBottom: 8 }}>Stabilizer Generator Card</h2>
            <div style={{ color: "#475569", fontSize: 13, marginBottom: 12 }}>
              Read this card as the abstract backbone of the lesson.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ border: "1px solid #dbe5f0", borderRadius: 16, padding: 14, background: "#f8fafc" }}>
                <div style={{ fontWeight: 700, marginBottom: 6, color: "#0f172a" }}>Stabilizer Group</div>
                <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.6 }}>
                  A commuting subgroup of the Pauli group that does not contain <code>-I</code>. Its joint <code>+1</code> eigenspace is the protected code space.
                </div>
              </div>
              <div style={{ border: "1px solid #dbe5f0", borderRadius: 16, padding: 14, background: "#f8fafc" }}>
                <div style={{ fontWeight: 700, marginBottom: 6, color: "#0f172a" }}>Syndrome</div>
                <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.6 }}>
                  The list of stabilizer measurement outcomes. A <code>-1</code> marks a violated check and helps locate the likely error.
                </div>
              </div>
              <div style={{ border: "1px solid #dbe5f0", borderRadius: 16, padding: 14, background: "#f8fafc" }}>
                <div style={{ fontWeight: 700, marginBottom: 6, color: "#0f172a" }}>Logical Operators</div>
                <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.6 }}>
                  Operators that preserve the code space by commuting with all stabilizers, but still act nontrivially on the encoded qubits.
                </div>
              </div>
              <div style={{ border: "1px solid #dbe5f0", borderRadius: 16, padding: 14, background: "#f8fafc" }}>
                <div style={{ fontWeight: 700, marginBottom: 6, color: "#0f172a" }}>Decoder</div>
                <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.6 }}>
                  A rule or algorithm that maps the measured syndrome to a recovery operator, ideally without changing the logical information.
                </div>
              </div>
            </div>
          </div>

          <div style={panelStyle()}>
            <h2 style={{ marginTop: 0, marginBottom: 8 }}>3-Bit Repetition Code Explorer</h2>
            <div style={{ color: "#64748b", fontSize: 13, marginBottom: 14 }}>
              This miniature code detects one bit-flip error using parity checks <code>Z1Z2</code> and <code>Z2Z3</code>.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 14 }}>
              {([
                { value: 0 as RepetitionSelection, label: "No error" },
                { value: 1 as RepetitionSelection, label: "X on q1" },
                { value: 2 as RepetitionSelection, label: "X on q2" },
                { value: 3 as RepetitionSelection, label: "X on q3" },
              ]).map((option) => (
                <button key={option.label} style={buttonStyle(repetitionError === option.value)} onClick={() => setRepetitionError(option.value)}>
                  {option.label}
                </button>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 14 }}>
              {repetitionBits.map((bit, index) => (
                <div
                  key={index}
                  style={{
                    border: "1px solid #dbe5f0",
                    borderRadius: 16,
                    padding: 16,
                    textAlign: "center",
                    background: bit === 1 ? "#fff7ed" : "#f8fafc",
                  }}
                >
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>Qubit {index + 1}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: bit === 1 ? "#c2410c" : "#0f172a" }}>{bit}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ border: "1px solid #dbe5f0", borderRadius: 16, padding: 16, background: "#f8fafc" }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Stabilizer Z1Z2</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: repetitionSyndrome.s12 === 1 ? "#166534" : "#b45309" }}>
                  {parityLabel(repetitionSyndrome.s12)}
                </div>
                <div style={{ fontSize: 13, color: "#475569", marginTop: 6 }}>
                  {repetitionSyndrome.s12 === 1 ? "Parity agrees" : "Parity mismatch detected"}
                </div>
              </div>
              <div style={{ border: "1px solid #dbe5f0", borderRadius: 16, padding: 16, background: "#f8fafc" }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Stabilizer Z2Z3</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: repetitionSyndrome.s23 === 1 ? "#166534" : "#b45309" }}>
                  {parityLabel(repetitionSyndrome.s23)}
                </div>
                <div style={{ fontSize: 13, color: "#475569", marginTop: 6 }}>
                  {repetitionSyndrome.s23 === 1 ? "Parity agrees" : "Parity mismatch detected"}
                </div>
              </div>
            </div>
          </div>

          <div style={panelStyle()}>
            <h2 style={{ marginTop: 0, marginBottom: 8 }}>Shor Code Explorer</h2>
            <div style={{ color: "#64748b", fontSize: 13, marginBottom: 14 }}>
              This simplified view shows how different stabilizer families diagnose different Pauli error channels.
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
              {(["none", "X", "Z"] as ShorError[]).map((error) => (
                <button key={error} style={buttonStyle(shorErrorType === error)} onClick={() => setShorErrorType(error)}>
                  {error === "none" ? "No error" : `${error} error`}
                </button>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(9, 1fr)", gap: 8, marginBottom: 14 }}>
              {Array.from({ length: 9 }, (_, index) => index + 1).map((q) => {
                const selected = q === shorQubit;
                return (
                  <button
                    key={q}
                    style={{
                      ...buttonStyle(selected),
                      padding: "12px 0",
                    }}
                    onClick={() => setShorQubit(q)}
                  >
                    q{q}
                  </button>
                );
              })}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ border: "1px solid #dbe5f0", borderRadius: 16, padding: 16, background: "#f8fafc" }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Selected fault</div>
                <div style={{ fontSize: 18, color: "#0f172a" }}>
                  {shorErrorType === "none" ? "No injected error" : `${shorErrorType} on qubit ${shorQubit}`}
                </div>
                <div style={{ fontSize: 13, color: "#475569", marginTop: 8, lineHeight: 1.5 }}>
                  X faults are picked up by Z-type parity checks. Z faults are picked up by the large X-type block checks.
                </div>
              </div>
              <div style={{ border: "1px solid #dbe5f0", borderRadius: 16, padding: 16, background: "#f8fafc" }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Detected stabilizers</div>
                {shorDetections.length === 0 ? (
                  <div style={{ fontSize: 13, color: "#475569" }}>No violated stabilizers for the current selection.</div>
                ) : (
                  shorDetections.map((label) => (
                    <div key={label} style={tagStyle("#fef3c7", "#92400e")}>
                      {label} {"->"} -1
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
