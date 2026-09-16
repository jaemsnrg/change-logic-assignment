import { useEffect, useState } from "react";
import { getUsers, type UserSummary } from "~/lib/api";
import { Card, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";

export const UserPicker = ({ onSelect }: { onSelect: (userId: string) => void }) => {
  const [users, setUsers] = useState<UserSummary[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getUsers()
      .then(setUsers)
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
        <div key={orgName} className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">{orgName}</h2>
          {orgUsers.map((user) => (
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
                  {user.name}
                  <Badge variant={user.role === "Manager" ? "default" : "secondary"}>{user.role}</Badge>
                </CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      ))}
    </div>
  );
};
