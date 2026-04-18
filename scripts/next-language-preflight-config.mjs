export const PREFLIGHT_CALIBRATION_PROFILES = {
  original: {
    name: "original",
    description: "Initial Japanese-informed safety-first preflight behavior.",
    checkLevelOverrides: {},
    combinationRules: [],
  },
  calibrated: {
    name: "calibrated",
    description: "Phase 3 calibration that keeps structural and answer-key safety checks strong while downgrading noisy topic/image/trust checks to warnings.",
    checkLevelOverrides: {
      "topic-subtopic-drift-risk": {
        moderate: "warning",
        severe: "warning",
      },
      "image-sign-symbol-mismatch-risk": {
        moderate: "warning",
      },
      "trust-band-caution": {
        moderate: "warning",
      },
    },
    combinationRules: [],
  },
  "combination-promoted": {
    name: "combination-promoted",
    description: "Phase 4 profile that keeps single weak checks as warnings but promotes a few empirically risky warning combinations back to soft downgrades.",
    checkLevelOverrides: {
      "topic-subtopic-drift-risk": {
        moderate: "warning",
        severe: "warning",
      },
      "image-sign-symbol-mismatch-risk": {
        moderate: "warning",
      },
      "trust-band-caution": {
        moderate: "warning",
      },
    },
    combinationRules: [
      {
        code: "combo-image-sign-context-risk",
        level: "moderate",
        whenAllCodes: ["image-sign-symbol-mismatch-risk"],
        conditions: {
          sourceType: "MCQ",
          hasImage: true,
          minPromptSimilarity: 0.3,
          anyOf: [
            { hasSourceAnswerEvidence: true },
            { maxTopicConfidence: 0.8 },
            { candidateTopicPresent: true },
          ],
        },
        message: "Image/sign mismatch plus stronger source-side context matches the historically risky override pattern better than a warning-only outcome.",
      },
      {
        code: "combo-trust-option-dominant-risk",
        level: "moderate",
        whenAllCodes: ["trust-band-caution"],
        conditions: {
          sourceType: "MCQ",
          candidateTopicInformativeMissing: true,
          minTopicConfidence: 1,
          maxPromptSimilarity: 0.15,
          minOptionSimilarity: 0.75,
          minOptionExactSet: 0.45,
        },
        message: "High-band trust with an option-dominant near-match and missing candidate topic should fall back to manual review.",
      },
      {
        code: "combo-trust-answer-context-risk",
        level: "moderate",
        whenAllCodes: ["trust-band-caution"],
        conditions: {
          sourceType: "MCQ",
          hasImage: true,
          hasSourceAnswerEvidence: true,
        },
        message: "Trust-band caution plus explicit answer evidence on an image-backed MCQ remains risky enough for manual review.",
      },
      {
        code: "combo-topic-option-dominant-risk",
        level: "moderate",
        whenAllCodes: ["topic-subtopic-drift-risk"],
        conditions: {
          sourceType: "MCQ",
          candidateTopicInformativeMissing: true,
          minTopicConfidence: 1,
          maxPromptSimilarity: 0.2,
          minOptionSimilarity: 0.8,
          minOptionExactSet: 0.7,
        },
        message: "Topic drift plus an option-dominant near-match with no candidate topic metadata has been historically override-prone.",
      },
      {
        code: "combo-silent-option-dominant-risk",
        level: "moderate",
        whenNoCodes: true,
        conditions: {
          sourceType: "MCQ",
          candidateTopicInformativeMissing: true,
          minTopicConfidence: 1,
          maxPromptSimilarity: 0.15,
          minOptionSimilarity: 0.8,
          minOptionExactSet: 0.7,
          maxCorrectAnswerMeaning: 0.5,
        },
        message: "A silent option-dominant near-match with no candidate topic metadata is risky enough to avoid auto-match.",
      },
    ],
  },
  "final-targeted": {
    name: "final-targeted",
    description: "Final Japanese-side pass that keeps the combination-promoted behavior and only adds a narrow severe escalation for the recurring image-backed ROW survivor cluster.",
    checkLevelOverrides: {
      "topic-subtopic-drift-risk": {
        moderate: "warning",
        severe: "warning",
      },
      "image-sign-symbol-mismatch-risk": {
        moderate: "warning",
      },
      "trust-band-caution": {
        moderate: "warning",
      },
    },
    combinationRules: [
      {
        code: "combo-image-sign-context-risk",
        level: "moderate",
        whenAllCodes: ["image-sign-symbol-mismatch-risk"],
        conditions: {
          sourceType: "MCQ",
          hasImage: true,
          minPromptSimilarity: 0.3,
          anyOf: [
            { hasSourceAnswerEvidence: true },
            { maxTopicConfidence: 0.8 },
            { candidateTopicPresent: true },
          ],
        },
        message: "Image/sign mismatch plus stronger source-side context matches the historically risky override pattern better than a warning-only outcome.",
      },
      {
        code: "combo-trust-option-dominant-risk",
        level: "moderate",
        whenAllCodes: ["trust-band-caution"],
        conditions: {
          sourceType: "MCQ",
          candidateTopicInformativeMissing: true,
          minTopicConfidence: 1,
          maxPromptSimilarity: 0.15,
          minOptionSimilarity: 0.75,
          minOptionExactSet: 0.45,
        },
        message: "High-band trust with an option-dominant near-match and missing candidate topic should fall back to manual review.",
      },
      {
        code: "combo-trust-answer-context-risk",
        level: "moderate",
        whenAllCodes: ["trust-band-caution"],
        conditions: {
          sourceType: "MCQ",
          hasImage: true,
          hasSourceAnswerEvidence: true,
        },
        message: "Trust-band caution plus explicit answer evidence on an image-backed MCQ remains risky enough for manual review.",
      },
      {
        code: "combo-topic-option-dominant-risk",
        level: "moderate",
        whenAllCodes: ["topic-subtopic-drift-risk"],
        conditions: {
          sourceType: "MCQ",
          candidateTopicInformativeMissing: true,
          minTopicConfidence: 1,
          maxPromptSimilarity: 0.2,
          minOptionSimilarity: 0.8,
          minOptionExactSet: 0.7,
        },
        message: "Topic drift plus an option-dominant near-match with no candidate topic metadata has been historically override-prone.",
      },
      {
        code: "combo-silent-option-dominant-risk",
        level: "moderate",
        whenNoCodes: true,
        conditions: {
          sourceType: "MCQ",
          candidateTopicInformativeMissing: true,
          minTopicConfidence: 1,
          maxPromptSimilarity: 0.15,
          minOptionSimilarity: 0.8,
          minOptionExactSet: 0.7,
          maxCorrectAnswerMeaning: 0.5,
        },
        message: "A silent option-dominant near-match with no candidate topic metadata is risky enough to avoid auto-match.",
      },
      {
        code: "combo-row-image-topic-weakness-risk",
        level: "severe",
        whenAllCodes: ["image-sign-symbol-mismatch-risk"],
        conditions: {
          sourceType: "ROW",
          hasImage: true,
          sourceTopicPresent: true,
          maxTopicConfidence: 0.8,
          minPromptSimilarity: 0.3,
          anyOf: [
            { candidateTopicInformativeMissing: true },
            { candidateTopicDiffersFromSource: true },
          ],
        },
        message: "Image-backed ROW indicator/sign items with weak or mismatched candidate topic context still align with the recurring Japanese override cluster and should not stay warning-only.",
      },
    ],
  },
};

export function getPreflightCalibrationProfile(name = "original") {
  return PREFLIGHT_CALIBRATION_PROFILES[name] ?? PREFLIGHT_CALIBRATION_PROFILES.original;
}
