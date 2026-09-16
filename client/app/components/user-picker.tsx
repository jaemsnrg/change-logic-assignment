import { useEffect, useState } from "react";
import { getActiveSurvey, getUsers, type UserSummary } from "~/lib/api";
import { Card, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { cn } from "cn";

type SurveyStatus = "pending" | "complete";

const SURVEY_STATUS_LABEL: Record<SurveyStatus, string> = {
  pending: "Survey available",
  complete: "Survey complete",
};

const SURVEY_STATUS_CLASS: Record<SurveyStatus, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
  complete: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300",
};

const ROLE_GROUPS: UserSummary["role"][] = ["Manager", "Member"];

export const UserPicker = ({ onSelect }: { onSelect: (userId: string) => void }) => {
  const [users, setUsers] = useState<UserSummary[] | null>(null);
  const [surveyStatus, setSurveyStatus] = useState<Record<string, SurveyStatus>>({});
  const [error, setError] = useState(false);

  useEffect(() => {
    getUsers()
      .then((result) => {
        setUsers(result);

        const members = result.filter((user) => user.role === "Member");

        Promise.allSettled(members.map((user) => getActiveSurvey(user.id))).then((results) => {
          const statusByUserId: Record<string, SurveyStatus> = {};

          results.forEach((outcome, index) => {
            if (outcome.status === "fulfilled") {
              statusByUserId[members[index].id] = outcome.value.hasResponded ? "complete" : "pending";
            }
          });

          setSurveyStatus(statusByUserId);
        });
      })
      .catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Couldn't load users</AlertTitle>
        <AlertDescription>Check that the API is running and try again.</AlertDescription>
      </Alert>
    );
  }

  if (!users) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  const byOrg = users.reduce((map, user) => {
    map.set(user.orgName, [...(map.get(user.orgName) ?? []), user]);
    return map;
  }, new Map<string, UserSummary[]>());

  return (
    <div className="flex flex-col gap-6">
      {[...byOrg.entries()].map(([orgName, orgUsers]) => (
        <div key={orgName} className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold text-foreground">{orgName}</h2>
          {ROLE_GROUPS.map((role) => {
            const roleUsers = orgUsers.filter((user) => user.role === role);

            if (roleUsers.length === 0) {
              return null;
            }

            return (
              <div key={role} className="flex flex-col gap-2">
                <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{role}s</h3>
                {roleUsers.map((user) => {
                  const status = surveyStatus[user.id];

                  return (
                    <Card
                      key={user.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onSelect(user.id)}
                      onKeyDown={(e) => e.key === "Enter" && onSelect(user.id)}
                      className="cursor-pointer transition-colors hover:bg-muted/50"
                    >
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            {user.name}
                            <Badge variant={user.role === "Manager" ? "default" : "secondary"}>{user.role}</Badge>
                          </span>
                          {status && (
                            <Badge className={cn(SURVEY_STATUS_CLASS[status])}>{SURVEY_STATUS_LABEL[status]}</Badge>
                          )}
                        </CardTitle>
                      </CardHeader>
                    </Card>
                  );
                })}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};
