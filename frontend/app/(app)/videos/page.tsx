import { connection } from "next/server";
import { Videos } from "@/components/videos";
import { creatorsData } from "@/lib/supabase";

export default async function Page() {
  await connection();
  const creators = await creatorsData().catch((e: Error) => e);
  return creators instanceof Error ? <Videos creators={[]} error={creators.message} /> : <Videos creators={creators} />;
}
