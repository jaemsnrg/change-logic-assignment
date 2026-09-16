import { useEffect, useState } from "react";
import { getSurveySummary, type SurveySummary } from "~/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";

const QUESTION_TYPE_LABEL: Record<SurveySummary["questions"][number]["type"], string> = {
  rating: "Rating (1–5)",
  yesNo: "Yes / No",
};

const formatRate = (rate: number | null) => (rate === null ? "No data yet" : `${Math.round(rate * 100)}%`);

const formatAverage = (average: number | null) => (average === null ? "No responses yet" : average.toFixed(2));

const QuestionRollup = ({ question }: { question: SurveySummary["questions"][number] }) => (
  <div key={question.questionId} className="flex flex-col gap-2 rounded-md border p-3">
    <div className="flex items-start justify-between gap-4">
      <span>{question.text}</span>
      <Badge variant="outline">{QUESTION_TYPE_LABEL[question.type]}</Badge>
    </div>
    {question.rating && (
      <p className="text-sm text-muted-foreground">
        Average: <span className="font-medium text-foreground">{formatAverage(question.rating.average)}</span>{" "}
        ({question.rating.count} response(s))
      </p>
    )}
    {question.yesNo && (
      <p className="text-sm text-muted-foreground">
        Yes: <span className="font-medium text-foreground">{question.yesNo.true}</span> · No:{" "}
        <span className="font-medium text-foreground">{question.yesNo.false}</span>
      </p>
    )}
  </div>
);

export const SurveySummaryView = ({ userId, surveyId }: { userId: string; surveyId: string }) => {
  const [summary, setSummary] = useState<SurveySummary | null>(null);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");

  useEffect(() => {
    setState("loading");
    setSummary(null);

    getSurveySummary(userId, surveyId)
      .then((result) => {
        setSummary(result);
        setState("ready");
      })
      .catch(() => {
        setState("error");
      });
  }, [userId, surveyId]);

  if (state === "loading") {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (state === "error" || !summary) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Something went wrong</AlertTitle>
        <AlertDescription>Couldn't load the survey summary. Check that the API is running.</AlertDescription>
      </Alert>
    );
  }

  const sortedQuestions = [...summary.questions].sort((a, b) => a.order - b.order);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>This week's completion</CardTitle>
          <CardDescription>Week of {summary.weekStart}</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Badge>
            {summary.completion.count} / {summary.completion.total}
          </Badge>
          <span className="text-sm text-muted-foreground">{formatRate(summary.completion.rate)}</span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Per-question breakdown</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {sortedQuestions.map((question) => (
            <QuestionRollup key={question.questionId} question={question} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
