import { useState, useEffect } from 'react';
import { Search, Download, Filter, ChevronLeft, ChevronRight } from 'lucide-react';

interface AuditLog {
    log_id: number;
    emp_id: number;
    employee_name: string;
    action_type: string;
    details: string;
    timestamp: string;
}

export default function AuditLogs() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const limit = 50;

    // Filters
    const [empId, setEmpId] = useState('');
    const [actionType, setActionType] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const fetchLogs = async () => {
        try {
            const token = localStorage.getItem('token');
            const query = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                ...(empId && { emp_id: empId }),
                ...(actionType && { action_type: actionType }),
                ...(startDate && { start_date: startDate }),
                ...(endDate && { end_date: endDate }),
            }).toString();

            const res = await fetch(`http://localhost:5000/api/admin/audit-logs?${query}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                setLogs(data.data);
                setTotal(data.total);
            }
        } catch (error) {
            console.error('Failed to fetch audit logs:', error);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [page, empId, actionType, startDate, endDate]);

    const handleExport = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('http://localhost:5000/api/admin/audit-logs/export', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
                document.body.appendChild(a);
                a.click();
                a.remove();
            } else {
                alert("Failed to export logs");
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this log?')) return;
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`http://localhost:5000/api/admin/audit-logs/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                fetchLogs();
            }
        } catch (error) {
            console.error(error);
        }
    };

    const totalPages = Math.ceil(total / limit);

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">System Audit Logs</h1>
                    <p className="text-slate-500 text-sm mt-1">Track and monitor sensitive system actions</p>
                </div>
                <button
                    onClick={handleExport}
                    className="flex items-center gap-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-4 py-2 rounded-lg font-medium transition-colors border border-emerald-200"
                >
                    <Download className="w-4 h-4" />
                    Export CSV
                </button>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Employee ID</label>
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="number"
                            min="1"
                            placeholder="Search ID..."
                            value={empId}
                            onChange={(e) => setEmpId(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Action Type</label>
                    <div className="relative">
                        <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="e.g. CREATE_SALE"
                            value={actionType}
                            onChange={(e) => setActionType(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Start Date</label>
                    <input
                        type="date"
                        max={endDate || undefined}
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase">End Date</label>
                    <input
                        type="date"
                        min={startDate || undefined}
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm">
                                <th className="py-3 px-4 font-semibold">Log ID</th>
                                <th className="py-3 px-4 font-semibold">Timestamp</th>
                                <th className="py-3 px-4 font-semibold">Employee</th>
                                <th className="py-3 px-4 font-semibold">Action</th>
                                <th className="py-3 px-4 font-semibold">Details</th>
                                <th className="py-3 px-4 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-8 text-center text-slate-500">No logs found matching criteria.</td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.log_id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                        <td className="py-3 px-4 text-slate-500">#{log.log_id}</td>
                                        <td className="py-3 px-4 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                                        <td className="py-3 px-4 font-medium text-slate-800">
                                            {log.employee_name} <span className="text-slate-400 font-normal text-xs ml-1">(ID: {log.emp_id})</span>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full text-xs font-medium border border-blue-100">
                                                {log.action_type}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={log.details}>
                                            {log.details}
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <button
                                                onClick={() => handleDelete(log.log_id)}
                                                className="text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors text-xs font-medium"
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-100">
                    <div className="text-sm text-slate-500">
                        Showing <span className="font-medium text-slate-800">{(page - 1) * limit + 1}</span> to <span className="font-medium text-slate-800">{Math.min(page * limit, total)}</span> of <span className="font-medium text-slate-800">{total}</span> results
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="p-1 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-200 disabled:opacity-50 transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <span className="text-sm font-medium text-slate-700 px-2">Page {page} of {Math.max(1, totalPages)}</span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages}
                            className="p-1 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-200 disabled:opacity-50 transition-colors"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
