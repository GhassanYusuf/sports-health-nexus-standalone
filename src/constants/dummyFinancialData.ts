/**
 * Dummy Financial Data for EMPEROR TAEKWONDO ACADEMY
 * This data represents monthly revenue, expenses, and profit for demonstration purposes
 */

export interface MonthlyFinancialData {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

export const EMPEROR_TAEKWONDO_FINANCIAL_DATA: MonthlyFinancialData[] = [
  {
    month: 'Jan',
    revenue: 18500,
    expenses: 9200,
    profit: 9300
  },
  {
    month: 'Feb',
    revenue: 22000,
    expenses: 10500,
    profit: 11500
  },
  {
    month: 'Mar',
    revenue: 25400,
    expenses: 11800,
    profit: 13600
  },
  {
    month: 'Apr',
    revenue: 23800,
    expenses: 10200,
    profit: 13600
  },
  {
    month: 'May',
    revenue: 27500,
    expenses: 12400,
    profit: 15100
  },
  {
    month: 'Jun',
    revenue: 29200,
    expenses: 13100,
    profit: 16100
  },
  {
    month: 'Jul',
    revenue: 31000,
    expenses: 14200,
    profit: 16800
  },
  {
    month: 'Aug',
    revenue: 28500,
    expenses: 12900,
    profit: 15600
  },
  {
    month: 'Sep',
    revenue: 26800,
    expenses: 11700,
    profit: 15100
  },
  {
    month: 'Oct',
    revenue: 24500,
    expenses: 10800,
    profit: 13700
  },
  {
    month: 'Nov',
    revenue: 21200,
    expenses: 9600,
    profit: 11600
  },
  {
    month: 'Dec',
    revenue: 19800,
    expenses: 8900,
    profit: 10900
  }
];

// Summary statistics for EMPEROR TAEKWONDO ACADEMY
export const EMPEROR_TAEKWONDO_SUMMARY = {
  totalRevenue: 298200,
  totalExpenses: 135300,
  totalProfit: 162900,
  averageMonthlyRevenue: 24850,
  averageMonthlyExpenses: 11275,
  averageMonthlyProfit: 13575,
  bestMonth: { month: 'Jul', revenue: 31000, profit: 16800 },
  worstMonth: { month: 'Jan', revenue: 18500, profit: 9300 }
};
