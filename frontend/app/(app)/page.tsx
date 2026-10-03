import { connection } from "next/server";
import { MissionControl } from "@/components/mission-control";
import { missionData } from "@/lib/supabase";

export default async function Page() {
  await connection();
  const data = await missionData().catch((e: Error) => e);
  return data instanceof Error ? <MissionControl summary={null} history={[]} error={data.message} /> : <MissionControl {...data} />;
}
