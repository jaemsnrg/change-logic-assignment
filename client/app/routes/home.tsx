import { useEffect, useState } from "react";
import type { Route } from "./+types/home";
import { UserPicker } from "~/components/user-picker";
import { ActiveSurveyView } from "~/components/active-survey-view";
import { clearStoredUserId, getStoredUserId, setStoredUserId } from "~/lib/session";

export const meta = ({}: Route.MetaArgs) => [
  { title: "Pulse Surveys" },
  { name: "description", content: "Weekly pulse surveys" },
];

const Home = () => {
  const [userId, setUserId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    setUserId(getStoredUserId());
  }, []);

  const handleSelect = (id: string) => {
    setStoredUserId(id);
    setUserId(id);
  };

  const handleSessionExpired = () => {
    clearStoredUserId();
    setUserId(null);
  };

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">Pulse Surveys</h1>
      {userId === undefined ? null : userId === null ? (
        <UserPicker onSelect={handleSelect} />
      ) : (
        <ActiveSurveyView userId={userId} onSessionExpired={handleSessionExpired} />
      )}
    </main>
  );
};

export default Home;
