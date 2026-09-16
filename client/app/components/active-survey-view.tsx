import { useEffect, useState } from "react";
import { ApiError, getActiveSurvey, getMe, type ActiveSurvey, type UserSummary } from "~/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";

const QUESTION_TYPE_LABEL: Record<ActiveSurvey["questions"][number]["type"], string> = {
  rating: "Rating (1–5)",
  yesNo: "Yes / No",
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

  useEffect(() => {
    setState("loading");
    setSurvey(null);

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

      {state === "ready" && survey && (
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
