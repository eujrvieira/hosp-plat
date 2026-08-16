export type CourseRole = "instructor" | "assistant" | "student";
export type MembershipStatus = "invited" | "active" | "suspended" | "archived";
export type AssignmentState = "not_started" | "active" | "completed" | "archived";
export type SubmissionStatus = "draft" | "submitted" | "reopened" | "graded";
export type Priority = "low" | "moderate" | "high" | "critical";

export type ProblemInput = {
  category: string;
  description: string;
  evidence: string;
};

export type InterventionInput = {
  problemIndex: number;
  recommendation: string;
  priority: Priority;
  target: string;
};

export type MonitoringInput = {
  problemIndex: number;
  parameter: string;
  target: string;
  timeframe: string;
};
