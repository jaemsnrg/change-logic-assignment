const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface UserSummary {
  id: string;
  name: string;
  role: "Manager" | "Member";
  orgId: string;
  orgName: string;
}

export interface Question {
  id: string;
  type: "rating" | "yesNo";
  text: string;
  order: number;
}

export interface ActiveSurvey {
  id: string;
  title: string;
  isActive: boolean;
  questions: Question[];
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const apiFetch = async <T>(path: string, userId?: string): Promise<T> => {
  const res = await fetch(`${API_URL}${path}`, {
    headers: userId ? { "X-User-Id": userId } : undefined,
  });

  if (!res.ok) {
    throw new ApiError(res.status, `${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
};

export const getUsers = () => apiFetch<UserSummary[]>("/users");

export const getMe = (userId: string) => apiFetch<UserSummary>("/me", userId);

export const getActiveSurvey = (userId: string) => apiFetch<ActiveSurvey>("/surveys/active", userId);
