import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { DollarSign, TrendingDown, TrendingUp, Calendar as CalendarIcon, Wallet, ArrowRightLeft } from 'lucide-react';

interface AnalyticsData {
    summary: {
        gross_revenue: number;
        cogs: number;
        operating_expenses: number;
        payroll: number;
        net_profit: number;
    };
    time_series: {
        date: string;
        revenue: number;
        expenses: number;
    }[];
}

export default function FinancialAnalytics() {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    const fetchData = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`http://localhost:5000/api/admin/financial-analytics?start_date=${startDate}&end_date=${endDate}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                setData(await res.json());
            }
        } catch (error) {
            console.error("Failed to fetch analytics", error);
        }
    };

    useEffect(() => {
        fetchData();
    }, [startDate, endDate]);

    if (!data) return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;

    const { summary, time_series } = data;
    const isProfitPositive = summary.net_profit >= 0;
    const totalExpenses = summary.cogs + summary.operating_expenses + summary.payroll;

    const pieData = [
        { name: 'COGS', value: summary.cogs },
        { name: 'Operating Exp.', value: summary.operating_expenses },
        { name: 'Payroll', value: summary.payroll }
    ].filter(d => d.value > 0);
    const COLORS = ['#ef4444', '#f59e0b', '#8b5cf6'];

    // Format Currency LKR
    const formatCurrency = (val: number) => `₨ ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header & Date Range */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Wallet className="w-6 h-6 text-blue-600" />
                        Financial Analytics Overview
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Real-time profitability and expense breakdown</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
                        <CalendarIcon className="w-4 h-4 text-slate-500" />
                        <input
                            type="date"
                            className="bg-transparent text-sm text-slate-700 outline-none"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                        />
                    </div>
                    <span className="text-slate-400">to</span>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
                        <CalendarIcon className="w-4 h-4 text-slate-500" />
                        <input
                            type="date"
                            className="bg-transparent text-sm text-slate-700 outline-none"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -z-0 transition-transform group-hover:scale-110"></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 text-slate-500 mb-2">
                            <TrendingUp className="w-5 h-5 text-blue-500" />
                            <h3 className="font-semibold text-sm uppercase tracking-wider">Gross Revenue</h3>
                        </div>
                        <p className="text-3xl font-bold text-slate-800">{formatCurrency(summary.gross_revenue)}</p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-orange-50 rounded-bl-full -z-0 transition-transform group-hover:scale-110"></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 text-slate-500 mb-2">
                            <TrendingDown className="w-5 h-5 text-orange-500" />
                            <h3 className="font-semibold text-sm uppercase tracking-wider">Total Expenses</h3>
                        </div>
                        <p className="text-3xl font-bold text-slate-800">{formatCurrency(totalExpenses)}</p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between relative overflow-hidden group">
                    <div className={`absolute top-0 right-0 w-24 h-24 ${isProfitPositive ? 'bg-emerald-50' : 'bg-red-50'} rounded-bl-full -z-0 transition-transform group-hover:scale-110`}></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 text-slate-500 mb-2">
                            <DollarSign className={`w-5 h-5 ${isProfitPositive ? 'text-emerald-500' : 'text-red-500'}`} />
                            <h3 className="font-semibold text-sm uppercase tracking-wider">Net Profit</h3>
                        </div>
                        <p className={`text-3xl font-bold ${isProfitPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                            {isProfitPositive ? '+' : ''}{formatCurrency(summary.net_profit)}
                        </p>
                    </div>
                </div>
            </div>

            {/* Charts Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Time Series Area Chart */}
                <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <ArrowRightLeft className="w-5 h-5 text-slate-400" />
                        Revenue vs. Expenses (30 Days)
                    </h3>
                    <div className="h-80">
                        {time_series.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-slate-400">No data for selected period</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={time_series} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis
                                        dataKey="date"
                                        tickFormatter={(tick) => {
                                            const d = new Date(tick);
                                            return `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;
                                        }}
                                        stroke="#94a3b8"
                                        fontSize={12}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        stroke="#94a3b8"
                                        fontSize={12}
                                        tickFormatter={(value) => `₨${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <Tooltip
                                        formatter={(value: any) => formatCurrency(Number(value))}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                    <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                                    <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#ef4444" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Expense Breakdown Donut */}
                <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex flex-col">
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Expense Breakdown</h3>
                    <p className="text-sm text-slate-500 mb-6">Distribution of pharmacy costs</p>

                    <div className="h-64 flex-1">
                        {pieData.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-slate-400">No expenses recorded</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {pieData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value: any) => formatCurrency(Number(value))}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>

                    {/* Legend Custom */}
                    <div className="mt-4 space-y-3">
                        {pieData.map((entry, index) => (
                            <div key={entry.name} className="flex justify-between items-center text-sm">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                    <span className="text-slate-600 font-medium">{entry.name}</span>
                                </div>
                                <span className="font-bold text-slate-800">{formatCurrency(entry.value)}</span>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
}
