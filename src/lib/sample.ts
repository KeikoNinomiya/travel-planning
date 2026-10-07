import type { SupabaseClient } from "@supabase/supabase-js";
import type { Category } from "./types";

type SampleStop = [day: number, time: string, name: string, category: Category, cost: number, note: string, lat: number, lng: number];

const STOPS: SampleStop[] = [
  [0, "09:00", "新大阪駅", "移動", 0, "新幹線で到着。荷物はなんばのホテルへ先に預ける", 34.7334, 135.5002],
  [0, "10:00", "大阪城", "観光", 600, "天守閣の入館料。西の丸庭園の紅葉も見頃", 34.6873, 135.5262],
  [0, "12:30", "黒門市場", "食事", 2500, "食べ歩きランチ（まぐろ・焼き牡蠣）", 34.6655, 135.5063],
  [0, "14:30", "道頓堀", "観光", 0, "グリコ看板、とんぼりリバーウォーク", 34.6687, 135.5013],
  [0, "16:30", "通天閣", "観光", 1200, "展望台。夕食は新世界で串カツ", 34.6525, 135.5063],
  [0, "20:00", "なんばのホテル", "宿泊", 12000, "1泊目", 34.665, 135.501],
  [1, "08:30", "京都駅", "移動", 580, "大阪駅からJR新快速で約30分", 34.9858, 135.7588],
  [1, "09:00", "伏見稲荷大社", "観光", 0, "千本鳥居。混む前に朝いちで", 34.9671, 135.7727],
  [1, "11:30", "清水寺", "観光", 500, "拝観料。清水の舞台", 34.9949, 135.785],
  [1, "13:00", "二年坂・三年坂", "食事", 2000, "湯豆腐ランチ", 34.997, 135.781],
  [1, "15:30", "祇園・花見小路", "観光", 0, "八坂神社から歩いて散策", 35.0037, 135.7752],
  [1, "17:00", "錦市場", "買い物", 1500, "お土産（漬物・七味）", 35.005, 135.7649],
  [1, "19:30", "四条烏丸のホテル", "宿泊", 14000, "2泊目", 35.0036, 135.76],
  [2, "08:30", "嵐山 竹林の小径", "観光", 0, "朝の静かな時間に", 35.017, 135.6717],
  [2, "09:30", "天龍寺", "観光", 500, "曹源池庭園", 35.0158, 135.6738],
  [2, "10:30", "渡月橋", "食事", 1800, "橋のたもとで早めの昼食", 35.0129, 135.6777],
  [2, "13:00", "金閣寺", "観光", 500, "嵐山から市バスで約40分", 35.0394, 135.7292],
  [2, "16:30", "京都駅", "移動", 2000, "新幹線で帰路へ（京都駅でお土産）", 34.9858, 135.7588],
];

/** 大阪→京都 2泊3日のサンプル旅行を作成して ID を返す */
export async function createSampleTrip(client: SupabaseClient, userId: string): Promise<string> {
  const { data: trip, error } = await client
    .from("trips")
    .insert({
      title: "大阪→京都 2泊3日",
      start_date: "2026-11-20",
      num_days: 3,
      day_titles: ["大阪", "京都 東山", "京都 嵐山・北"],
      owner_id: userId,
    })
    .select("id")
    .single();
  if (error) throw error;

  const rows = STOPS.map(([day_index, time, name, category, cost, note, lat, lng], i) => ({
    trip_id: trip.id,
    day_index,
    position: i,
    time,
    name,
    category,
    cost,
    note,
    lat,
    lng,
  }));
  const { error: e2 } = await client.from("stops").insert(rows);
  if (e2) throw e2;
  return trip.id as string;
}
