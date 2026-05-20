export type WorkExperience = {
  start_date: string;
  end_date: string;
  company: string;
  salary: string;
  position: string;
  leave_reason: string;
};

export type EducationExperience = {
  start_date: string;
  end_date: string;
  college: string;
  major: string;
  certificate: string;
};

export type FamilyMember = {
  relation: string;
  company: string;
  address: string;
};

export type CandidateProfile = {
  name: string;
  age: string;
  id_number: string;
  phone: string;
  email: string;
  role: string;
  fill_date: string;
  gender: string;
  birth_month: string;
  nation: string;
  native_place: string;
  height: string;
  weight: string;
  marital_status: string;
  political_status: string;
  education_level: string;
  school: string;
  major: string;
  degree: string;
  graduation_year: string;
  registered_address: string;
  current_address: string;
  work_experiences: WorkExperience[];
  education_experiences: EducationExperience[];
  family_members: FamilyMember[];
  emergency_contact: string;
  emergency_relation: string;
  emergency_phone: string;
  expected_salary: string;
  self_evaluation: string;
};

export type Attachment = {
  id: string;
  filename: string;
  content_type: string;
  url: string;
  created_at: string;
};

export type Snapshot = {
  id: string;
  filename: string;
  url: string;
  capture_index: number;
  capture_reason: string;
  created_at: string;
};

export type OralRecording = {
  id: string;
  question_index: number;
  question_text: string;
  filename: string;
  content_type: string;
  url: string;
  duration_seconds: number;
  created_at: string;
};

export type Transcript = {
  id: number;
  speaker: "user" | "assistant";
  text: string;
  event_type: string;
  created_at: string;
};

export type InterviewSession = {
  id: string;
  role: string;
  status: string;
  candidate_profile: Partial<CandidateProfile>;
  parsed_profile: Partial<CandidateProfile>;
  resume_text: string;
  written_submission: Record<string, unknown>;
  oral_summary: Record<string, unknown>;
  attachments: Attachment[];
  transcripts: Transcript[];
  snapshots: Snapshot[];
  oral_recordings: OralRecording[];
  created_at: string;
  updated_at: string;
};

export type QuestionType = "single" | "multi" | "short" | "code";

export type Question = {
  id: string;
  title: string;
  type: QuestionType;
  options: Array<{ label: string; value: string }>;
  prompt: string;
  starter_code: string;
  language: string;
};

export type WrittenAnswers = Record<string, string | string[]>;

export type WrittenExamSubmission = {
  session_id: string;
  role: string;
  started_at: string;
  submitted_at: string;
  duration_seconds: number;
  answers: WrittenAnswers;
};

export type OralMessage = {
  id: string;
  speaker: "user" | "assistant";
  text: string;
  createdAt: string;
};

export type RiskLevel = "low" | "medium" | "high";

export type InterviewResultSummary = {
  session_id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  status: string;
  total_score: number;
  written_score: number;
  oral_score: number;
  profile_score: number;
  risk_level: RiskLevel;
  recommendation: string;
  attachments_count: number;
  snapshots_count: number;
  recordings_count: number;
  qa_count: number;
  updated_at: string;
};

export type ScoreBreakdown = {
  total_score: number;
  profile_score: number;
  written_score: number;
  oral_score: number;
  compliance_score: number;
};

export type ReportQaPair = {
  question: string;
  answer: string;
  audio_url?: string;
  duration_seconds?: number;
  at: string;
};

export type InterviewResultDetail = {
  summary: InterviewResultSummary;
  candidate_profile: Partial<CandidateProfile>;
  parsed_profile: Partial<CandidateProfile>;
  score_breakdown: ScoreBreakdown;
  report: {
    title: string;
    conclusion: string;
    overall_comment: string;
    strengths: string[];
    risks: string[];
    dimension_analysis: Array<{
      dimension: string;
      score: number;
      comment: string;
    }>;
    qa_pairs: ReportQaPair[];
  };
};
