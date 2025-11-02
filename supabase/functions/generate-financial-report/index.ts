import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { club_id, start_date, end_date, group_by } = await req.json();

    console.log(`[generate-financial-report] Generating report for club ${club_id} from ${start_date} to ${end_date}`);

    // Fetch all transactions in date range
    const { data: transactions, error } = await supabaseClient
      .from('transaction_ledger')
      .select('*')
      .eq('club_id', club_id)
      .gte('transaction_date', start_date)
      .lte('transaction_date', end_date)
      .order('transaction_date', { ascending: true });

    if (error) throw error;

    // Calculate totals
    const income = transactions
      .filter(t => ['enrollment_fee', 'package_fee', 'product_sale', 'facility_rental'].includes(t.transaction_type))
      .reduce((sum, t) => sum + parseFloat(t.total_amount || 0), 0);

    const expenses = transactions
      .filter(t => t.transaction_type === 'expense')
      .reduce((sum, t) => sum + parseFloat(t.total_amount || 0), 0);

    const refunds = transactions
      .filter(t => t.transaction_type === 'refund')
      .reduce((sum, t) => sum + parseFloat(t.total_amount || 0), 0);

    const netIncome = income - expenses - refunds;

    console.log(`[generate-financial-report] Income: ${income}, Expenses: ${expenses}, Refunds: ${refunds}, Net: ${netIncome}`);

    // Group by category if requested
    let groupedData = null;
    if (group_by === 'category') {
      groupedData = transactions.reduce((acc, t) => {
        const key = t.transaction_type === 'expense' ? t.category : t.transaction_type;
        if (!acc[key]) acc[key] = 0;
        acc[key] += parseFloat(t.total_amount || 0);
        return acc;
      }, {} as Record<string, number>);
    }

    // Group by month if requested
    if (group_by === 'month') {
      groupedData = transactions.reduce((acc, t) => {
        const month = new Date(t.transaction_date).toISOString().slice(0, 7); // YYYY-MM
        if (!acc[month]) {
          acc[month] = { income: 0, expenses: 0, refunds: 0 };
        }
        
        if (['enrollment_fee', 'package_fee', 'product_sale', 'facility_rental'].includes(t.transaction_type)) {
          acc[month].income += parseFloat(t.total_amount || 0);
        } else if (t.transaction_type === 'expense') {
          acc[month].expenses += parseFloat(t.total_amount || 0);
        } else if (t.transaction_type === 'refund') {
          acc[month].refunds += parseFloat(t.total_amount || 0);
        }
        
        return acc;
      }, {} as Record<string, { income: number; expenses: number; refunds: number }>);
    }

    return new Response(
      JSON.stringify({
        summary: {
          income,
          expenses,
          refunds,
          net_income: netIncome,
          transaction_count: transactions.length
        },
        grouped_data: groupedData,
        transactions
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[generate-financial-report] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
