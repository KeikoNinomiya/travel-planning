"use client";

import { useParams } from "next/navigation";
import { useRequireSession } from "@/lib/useSession";
import Planner from "@/components/Planner";

export default function TripPage() {
  const { id } = useParams<{ id: string }>();
  const session = useRequireSession();
  if (!session) return <div className="center">読み込み中…</div>;
  return <Planner tripId={id} userId={session.user.id} />;
}
