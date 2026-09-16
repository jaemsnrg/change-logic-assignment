import { useEffect, useState } from "react";
import {
  ApiError,
  getActiveSurvey,
  getMe,
  submitSurveyResponse,
  type ActiveSurvey,
  type AnswerInput,
  type UserSummary,
} from "~/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";

const QUESTION_TYPE_LABEL: Record<ActiveSurvey["questions"][number]["type"], string> = {
  rating: "Rating (1–5)",
  yesNo: "Yes / No",
};

const RATING_VALUES = [1, 2, 3, 4, 5];

const QuestionInput = ({
  question,
  value,
  onChange,
}: {
  question: ActiveSurvey["questions"][number];
  value: number | boolean | undefined;
  onChange: (value: number | boolean) => void;
}) => {
  if (question.type === "rating") {
    return (
      <div className="flex gap-1.5">
        {RATING_VALUES.map((rating) => (
          <Button
            key={rating}
            type="button"
            size="icon"
            variant={value === rating ? "default" : "outline"}
            onClick={() => onChange(rating)}
            aria-pressed={value === rating}
          >
            {rating}
          </Button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-1.5">
      <Button
        type="button"
        variant={value === true ? "default" : "outline"}
        onClick={() => onChange(true)}
        aria-pressed={value === true}
      >
        Yes
      </Button>
      <Button
        type="button"
        variant={value === false ? "default" : "outline"}
        onClick={() => onChange(false)}
        aria-pressed={value === false}
      >
        No
      </Button>
    </div>
  );
};

const SurveyForm = ({
  survey,
  userId,
  onSubmitted,
}: {
  survey: ActiveSurvey;
  userId: string;
  onSubmitted: () => void;
}) => {
  const [answers, setAnswers] = useState<Record<string, number | boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allAnswered = survey.questions.every((q) => answers[q.id] !== undefined);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    const payload: AnswerInput[] = survey.questions.map((q) => ({
      questionId: q.id,
      value: answers[q.id],
    }));

    try {
      await submitSurveyResponse(userId, survey.id, payload);
      onSubmitted();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        onSubmitted();
        return;
      }
      setError("Couldn't submit your response. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{survey.title}</CardTitle>
        <CardDescription>{survey.questions.length} question(s)</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Submission failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {survey.questions.map((q) => (
          <div key={q.id} className="flex flex-col gap-2 rounded-md border p-3">
            <div className="flex items-start justify-between gap-4">
              <span>{q.text}</span>
              <Badge variant="outline">{QUESTION_TYPE_LABEL[q.type]}</Badge>
            </div>
            <QuestionInput
              question={q}
              value={answers[q.id]}
              onChange={(value) => setAnswers((prev) => ({ ...prev, [q.id]: value }))}
            />
          </div>
        ))}
        <Button disabled={!allAnswered || submitting} onClick={handleSubmit}>
          {submitting ? "Submitting…" : "Submit"}
        </Button>
      </CardContent>
    </Card>
  );
};

export const ActiveSurveyView = ({
  userId,
  onSessionExpired,
}: {
  userId: string;
  onSessionExpired: () => void;
}) => {
  const [me, setMe] = useState<UserSummary | null>(null);
  const [survey, setSurvey] = useState<ActiveSurvey | null>(null);
  const [state, setState] = useState<"loading" | "no-survey" | "error" | "ready">("loading");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setState("loading");
    setSurvey(null);
    setSubmitted(false);

    Promise.all([getMe(userId), getActiveSurvey(userId)])
      .then(([meResult, surveyResult]) => {
        setMe(meResult);
        setSurvey(surveyResult);
        setState("ready");
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) {
          onSessionExpired();
          return;
        }
        if (err instanceof ApiError && err.status === 404) {
          setState("no-survey");
          getMe(userId)
            .then(setMe)
            .catch(() => {});
          return;
        }
        setState("error");
      });
  }, [userId, onSessionExpired]);

  if (state === "loading") {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (state === "error") {
    return (
      <Alert variant="destructive">
        <AlertTitle>Something went wrong</AlertTitle>
        <AlertDescription>Couldn't load the active survey. Check that the API is running.</AlertDescription>
      </Alert>
    );
  }

  const showForm = state === "ready" && survey && me?.role === "Member";
  const alreadyResponded = Boolean(survey?.hasResponded) || submitted;

  return (
    <div className="flex flex-col gap-4">
      {me && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Viewing as <span className="font-medium text-foreground">{me.name}</span> ({me.orgName})
          </p>
          <Button variant="outline" size="sm" onClick={onSessionExpired}>
            Switch user
          </Button>
        </div>
      )}

      {state === "no-survey" && (
        <Alert>
          <AlertTitle>No active survey</AlertTitle>
          <AlertDescription>Your organization doesn't have an active pulse survey right now.</AlertDescription>
        </Alert>
      )}

      {state === "ready" && survey && showForm && alreadyResponded && (
        <Alert>
          <AlertTitle>You're all set</AlertTitle>
          <AlertDescription>Thanks for submitting your response to "{survey.title}" this week.</AlertDescription>
        </Alert>
      )}

      {state === "ready" && survey && showForm && !alreadyResponded && (
        <SurveyForm survey={survey} userId={userId} onSubmitted={() => setSubmitted(true)} />
      )}

      {state === "ready" && survey && !showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{survey.title}</CardTitle>
            <CardDescription>{survey.questions.length} question(s)</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {survey.questions.map((q) => (
              <div key={q.id} className="flex items-start justify-between gap-4 rounded-md border p-3">
                <span>{q.text}</span>
                <Badge variant="outline">{QUESTION_TYPE_LABEL[q.type]}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
