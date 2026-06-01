import { supabase } from "@/integrations/supabase/client";

const MATCH_PAGE_SIZE = 1000;
const DEFAULT_MATCH_FETCH_LIMIT = 5000;

type MatchOrder = {
  column: string;
  ascending?: boolean;
  nullsFirst?: boolean;
};

type FetchTournamentMatchesOptions = {
  tournamentId: string;
  columns?: string;
  orders?: MatchOrder[];
  maxRows?: number;
};

export async function fetchTournamentMatches({
  tournamentId,
  columns = "*",
  orders = [],
  maxRows = DEFAULT_MATCH_FETCH_LIMIT,
}: FetchTournamentMatchesOptions) {
  const allRows: any[] = [];

  for (let from = 0; from < maxRows; from += MATCH_PAGE_SIZE) {
    let query: any = supabase.from("matches").select(columns).eq("tournament_id", tournamentId);

    for (const order of orders) {
      query = query.order(order.column, {
        ascending: order.ascending,
        nullsFirst: order.nullsFirst,
      });
    }

    const to = Math.min(from + MATCH_PAGE_SIZE - 1, maxRows - 1);
    const { data, error } = await query.range(from, to);

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      break;
    }

    allRows.push(...data);

    if (data.length < MATCH_PAGE_SIZE) {
      break;
    }
  }

  return allRows;
}
