import dayjs from "dayjs";
import type { CandidateProfile, EducationExperience, FamilyMember, WorkExperience, WrittenAnswers } from "./types";

const SESSION_KEY = "ai-interview-session-id";
const PROFILE_PREFIX = "ai-interview-profile:";
const ANSWERS_PREFIX = "ai-interview-answers:";
const ORAL_PREFIX = "ai-interview-oral:";

export const emptyProfile: CandidateProfile = {
  profile_photo_data_url: "",
  name: "",
  age: "",
  id_number: "",
  phone: "",
  email: "",
  role: "",
  fill_date: dayjs().format("YYYY-MM-DD"),
  gender: "",
  birth_month: "",
  nation: "",
  native_place: "",
  height: "",
  weight: "",
  marital_status: "",
  political_status: "",
  education_level: "",
  school: "",
  major: "",
  degree: "",
  graduation_year: "",
  registered_address: "",
  current_address: "",
  work_experiences: createRows(createEmptyWorkExperience, 3),
  education_experiences: createRows(createEmptyEducationExperience, 3),
  family_members: createRows(createEmptyFamilyMember, 3),
  emergency_contact: "",
  emergency_relation: "",
  emergency_phone: "",
  expected_salary: "",
  self_evaluation: "",
};

export function getInterviewSessionId() {
  const existing = localStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const next = crypto.randomUUID();
  localStorage.setItem(SESSION_KEY, next);
  return next;
}

export function resetInterviewSession() {
  const next = crypto.randomUUID();
  localStorage.setItem(SESSION_KEY, next);
  return next;
}

export function loadProfile(sessionId: string): CandidateProfile {
  const value = localStorage.getItem(`${PROFILE_PREFIX}${sessionId}`);
  if (!value) return emptyProfile;
  try {
    return normalizeProfile({ ...emptyProfile, ...JSON.parse(value) });
  } catch {
    return emptyProfile;
  }
}

export function saveProfile(sessionId: string, profile: CandidateProfile) {
  localStorage.setItem(`${PROFILE_PREFIX}${sessionId}`, JSON.stringify(profile));
}

export function loadAnswers(sessionId: string): WrittenAnswers {
  const value = localStorage.getItem(`${ANSWERS_PREFIX}${sessionId}`);
  if (!value) return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

export function saveAnswers(sessionId: string, answers: WrittenAnswers) {
  localStorage.setItem(`${ANSWERS_PREFIX}${sessionId}`, JSON.stringify(answers));
}

export function saveOralMessages(sessionId: string, messages: unknown[]) {
  localStorage.setItem(`${ORAL_PREFIX}${sessionId}`, JSON.stringify(messages));
}

function normalizeProfile(profile: CandidateProfile): CandidateProfile {
  return {
    ...profile,
    fill_date: profile.fill_date || dayjs().format("YYYY-MM-DD"),
    work_experiences: normalizeWorkRows(profile.work_experiences, 3),
    education_experiences: normalizeEducationRows(profile.education_experiences, 3),
    family_members: normalizeRows(profile.family_members, createEmptyFamilyMember, 3),
  };
}

function normalizeRows<T>(rows: T[] | undefined, factory: () => T, count: number) {
  const normalized = Array.isArray(rows) ? rows.slice(0, count) : [];
  while (normalized.length < count) normalized.push(factory());
  return normalized;
}

function createRows<T>(factory: () => T, count: number) {
  return Array.from({ length: count }, factory);
}

function createEmptyWorkExperience(): WorkExperience {
  return { start_date: "", end_date: "", company: "", salary: "", position: "", leave_reason: "" };
}

function createEmptyEducationExperience(): EducationExperience {
  return { start_date: "", end_date: "", college: "", major: "", certificate: "" };
}

function createEmptyFamilyMember(): FamilyMember {
  return { relation: "", company: "", address: "" };
}

function normalizeWorkRows(rows: Array<Partial<WorkExperience> & { start_month?: string; end_month?: string }> | undefined, count: number) {
  const normalized = Array.isArray(rows)
    ? rows.slice(0, count).map((row) => ({
        start_date: row.start_date || row.start_month || "",
        end_date: row.end_date || row.end_month || "",
        company: row.company || "",
        salary: row.salary || "",
        position: row.position || "",
        leave_reason: row.leave_reason || "",
      }))
    : [];
  while (normalized.length < count) normalized.push(createEmptyWorkExperience());
  return normalized;
}

function normalizeEducationRows(
  rows: Array<Partial<EducationExperience> & { start_month?: string; end_month?: string }> | undefined,
  count: number,
) {
  const normalized = Array.isArray(rows)
    ? rows.slice(0, count).map((row) => ({
        start_date: row.start_date || row.start_month || "",
        end_date: row.end_date || row.end_month || "",
        college: row.college || "",
        major: row.major || "",
        certificate: row.certificate || "",
      }))
    : [];
  while (normalized.length < count) normalized.push(createEmptyEducationExperience());
  return normalized;
}
