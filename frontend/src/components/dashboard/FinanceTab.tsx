import { useEffect, useState } from 'react';
import { fetchWithAuth } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface PendingCheck {
    invoice_id: number;
    supplier_id: number;
    supplier_name: string;
    supplier_invoice_number: string;
    total_amount: string;
    check_number: string;
    check_date: string;
    check_cleared: number;
    received_at: string;
}

export default function FinanceTab({
    currency = '$',
    onCurrencyChange
}: {
    currency?: string;
    onCurrencyChange?: (val: string) => void
}) {
    const [checks, setChecks] = useState<PendingCheck[]>([]);
    const [expenses, setExpenses] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [payrollEntries, setPayrollEntries] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [localCurrency, setLocalCurrency] = useState(currency);
    const { toast } = useToast();

    const [isExpenseOpen, setIsExpenseOpen] = useState(false);
    const [isEditingExpense, setIsEditingExpense] = useState(false);
    const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
    const [expenseForm, setExpenseForm] = useState({ amount: '', category: 'Utilities', description: '', recorded_date: new Date().toISOString().split('T')[0] });

    const [isPayrollOpen, setIsPayrollOpen] = useState(false);
    const [payrollForm, setPayrollForm] = useState({ emp_id: '', gross_pay: '', deductions: '0', net_salary: '', pay_period_start: '', pay_period_end: '', payment_date: new Date().toISOString().split('T')[0] });

    const [isSalaryOpen, setIsSalaryOpen] = useState(false);
    const [selectedEmp, setSelectedEmp] = useState<any>(null);
    const [salaryForm, setSalaryForm] = useState({ base_salary: '', hourly_rate: '', standard_deductions: '' });

    // Sync local state when prop changes
    useEffect(() => {
        setLocalCurrency(currency);
    }, [currency]);

    const loadData = async () => {
        try {
            setIsLoading(true);
            const [checksData, expensesData, employeesData, payrollData] = await Promise.all([
                fetchWithAuth('/finance/pending-checks'),
                fetchWithAuth('/admin/financial-analytics/expenses'),
                fetchWithAuth('/admin/employees'),
                fetchWithAuth('/admin/financial-analytics/payroll')
            ]);
            setChecks(checksData);
            setExpenses(expensesData);
            setEmployees(employeesData);
            setPayrollEntries(payrollData);
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const handleClearCheck = async (id: number) => {
        if (!confirm('Mark this check as cleared?')) return;
        try {
            await fetchWithAuth(`/finance/checks/${id}/clear`, { method: 'PATCH' });
            toast({ title: 'Success', description: 'Check marked as cleared.' });
            loadData(); // Refresh list
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    };

    const handleSaveCurrency = async () => {
        try {
            await fetchWithAuth('/settings/currency', {
                method: 'PUT',
                body: JSON.stringify({ value: localCurrency })
            });
            if (onCurrencyChange) onCurrencyChange(localCurrency);
            toast({ title: 'Saved', description: 'Application currency updated successfully.' });
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        }
    };

    const handleAddExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (isEditingExpense && editingExpenseId) {
                await fetchWithAuth(`/admin/financial-analytics/expenses/${editingExpenseId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ ...expenseForm, amount: Number(expenseForm.amount) })
                });
                toast({ title: 'Success', description: 'Expense updated.' });
            } else {
                await fetchWithAuth('/admin/financial-analytics/expenses', {
                    method: 'POST',
                    body: JSON.stringify({ ...expenseForm, amount: Number(expenseForm.amount) })
                });
                toast({ title: 'Success', description: 'Expense recorded.' });
            }
            setIsExpenseOpen(false);
            setExpenseForm({ amount: '', category: 'Utilities', description: '', recorded_date: new Date().toISOString().split('T')[0] });
            setIsEditingExpense(false);
            setEditingExpenseId(null);
            loadData();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    };

    const handleEditExpenseClick = (expense: any) => {
        setExpenseForm({
            amount: expense.amount,
            category: expense.category,
            description: expense.description || '',
            recorded_date: new Date(expense.recorded_date).toISOString().split('T')[0]
        });
        setIsEditingExpense(true);
        setEditingExpenseId(expense.expense_id);
        setIsExpenseOpen(true);
    };

    const handleDeleteExpense = async (id: number) => {
        if (!confirm('Delete this expense record?')) return;
        try {
            await fetchWithAuth(`/admin/financial-analytics/expenses/${id}`, { method: 'DELETE' });
            toast({ title: 'Deleted', description: 'Expense removed.' });
            loadData();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    };

    const handleSalaryUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEmp) return;
        try {
            await fetchWithAuth(`/admin/employees/${selectedEmp.emp_id}/salary`, {
                method: 'PUT',
                body: JSON.stringify({
                    base_salary: Number(salaryForm.base_salary),
                    hourly_rate: salaryForm.hourly_rate ? Number(salaryForm.hourly_rate) : null,
                    standard_deductions: Number(salaryForm.standard_deductions)
                })
            });
            toast({ title: 'Success', description: 'Salary settings updated.' });
            setIsSalaryOpen(false);
            loadData();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    };

    const handleAddPayroll = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const net = Number(payrollForm.gross_pay) - Number(payrollForm.deductions);
            await fetchWithAuth('/admin/financial-analytics/payroll', {
                method: 'POST',
                body: JSON.stringify({
                    ...payrollForm,
                    emp_id: Number(payrollForm.emp_id),
                    gross_pay: Number(payrollForm.gross_pay),
                    deductions: Number(payrollForm.deductions),
                    net_salary: net
                })
            });
            toast({ title: 'Success', description: 'Payroll entry recorded.' });
            setIsPayrollOpen(false);
            loadData();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    };

    const handleDeletePayroll = async (id: number) => {
        if (!confirm('Delete this payroll record?')) return;
        try {
            await fetchWithAuth(`/admin/financial-analytics/payroll/${id}`, { method: 'DELETE' });
            toast({ title: 'Deleted', description: 'Payroll entry removed.' });
            loadData();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    };

    if (isLoading) return <div>Loading Finance Data...</div>;

    return (
        <div className="space-y-8">
            {/* Global Settings Section integrated into Finance Tab */}
            <Card className="shadow-sm border-slate-200">
                <CardHeader className="bg-slate-50 border-b">
                    <CardTitle className="text-lg">Application Settings</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="max-w-md space-y-2">
                        <Label>Base Currency Symbol</Label>
                        <div className="flex space-x-2">
                            <Input
                                value={localCurrency}
                                onChange={e => setLocalCurrency(e.target.value)}
                                placeholder="e.g. $, LKR, €, £"
                            />
                            <Button onClick={handleSaveCurrency}>Save</Button>
                        </div>
                        <p className="text-xs text-slate-500">Changes the currency sign across all application modules.</p>
                    </div>
                </CardContent>
            </Card>

            <div className="space-y-4">
                <h2 className="text-2xl font-bold">Post-Dated Checks Tracker</h2>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Invoice #</TableHead>
                            <TableHead>Supplier</TableHead>
                            <TableHead>Total Amount</TableHead>
                            <TableHead>Check Number</TableHead>
                            <TableHead>Check Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {checks.map(c => {
                            const isOverdue = new Date(c.check_date) < new Date();
                            return (
                                <TableRow key={c.invoice_id}>
                                    <TableCell className="font-medium">{c.supplier_invoice_number}</TableCell>
                                    <TableCell>{c.supplier_name}</TableCell>
                                    <TableCell>{currency} {Number(c.total_amount).toFixed(2)}</TableCell>
                                    <TableCell>{c.check_number}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {new Date(c.check_date).toLocaleDateString()}
                                            {isOverdue && <Badge variant="destructive">Overdue</Badge>}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="text-amber-600 border-amber-600 bg-amber-50">Pending</Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button size="sm" onClick={() => handleClearCheck(c.invoice_id)}>
                                            Mark Cleared
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        {checks.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                                    No pending checks found. You're all caught up!
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="space-y-4 pt-6 border-t mt-8">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold">Operating Expenses</h2>
                    <Dialog open={isExpenseOpen} onOpenChange={setIsExpenseOpen}>
                        <DialogTrigger asChild>
                            <Button>Record Expense</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>{isEditingExpense ? 'Edit Operating Expense' : 'Log Operating Expense'}</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleAddExpense} className="space-y-4 mt-4">
                                <div className="space-y-2">
                                    <Label>Date</Label>
                                    <Input required type="date" value={expenseForm.recorded_date} onChange={e => setExpenseForm({ ...expenseForm, recorded_date: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Amount ({currency})</Label>
                                    <Input required type="number" step="0.01" min="0" value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Category</Label>
                                    <Select value={expenseForm.category} onValueChange={val => setExpenseForm({ ...expenseForm, category: val })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Utilities">Utilities</SelectItem>
                                            <SelectItem value="Rent">Rent</SelectItem>
                                            <SelectItem value="Marketing">Marketing</SelectItem>
                                            <SelectItem value="Supplies">Supplies</SelectItem>
                                            <SelectItem value="Other">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Description</Label>
                                    <Input value={expenseForm.description} onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })} />
                                </div>
                                <Button type="submit" className="w-full">{isEditingExpense ? 'Update Expense' : 'Save Expense'}</Button>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {expenses.map(e => (
                            <TableRow key={e.expense_id}>
                                <TableCell>{new Date(e.recorded_date).toLocaleDateString()}</TableCell>
                                <TableCell><Badge variant="secondary">{e.category}</Badge></TableCell>
                                <TableCell>{e.description || '-'}</TableCell>
                                <TableCell className="text-right font-medium text-red-600">
                                    -{currency} {Number(e.amount).toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button variant="outline" size="sm" onClick={() => handleEditExpenseClick(e)}>
                                            Edit
                                        </Button>
                                        <Button variant="destructive" size="sm" onClick={() => handleDeleteExpense(e.expense_id)}>
                                            Delete
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {expenses.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                                    No operating expenses logged yet.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Employee Management Section */}
            <div className="space-y-4 pt-6 border-t mt-8">
                <h2 className="text-2xl font-bold">Employee Payroll Management</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="shadow-sm">
                        <CardHeader className="bg-slate-50 border-b">
                            <CardTitle className="text-sm">Staff Salary Configuration</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Staff Name</TableHead>
                                        <TableHead>Base Salary</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {employees.map(emp => (
                                        <TableRow key={emp.emp_id}>
                                            <TableCell className="font-medium text-xs">{emp.name}</TableCell>
                                            <TableCell className="text-xs">{currency} {Number(emp.base_salary).toFixed(2)}</TableCell>
                                            <TableCell className="text-right">
                                                <Button size="sm" variant="outline" onClick={() => {
                                                    setSelectedEmp(emp);
                                                    setSalaryForm({
                                                        base_salary: emp.base_salary,
                                                        hourly_rate: emp.hourly_rate || '',
                                                        standard_deductions: emp.standard_deductions
                                                    });
                                                    setIsSalaryOpen(true);
                                                }}>Configs</Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    <Card className="shadow-sm">
                        <CardHeader className="bg-slate-50 border-b flex flex-row items-center justify-between">
                            <CardTitle className="text-sm">Quick Actions</CardTitle>
                            <Button size="sm" onClick={() => {
                                setIsPayrollOpen(true);
                                setPayrollForm(prev => ({ ...prev, emp_id: employees[0]?.emp_id.toString() || '' }));
                            }}>Log Payment</Button>
                        </CardHeader>
                        <CardContent className="p-4 space-y-4">
                            <p className="text-xs text-slate-500">Record a new payroll entry for an employee to track in financial analytics.</p>
                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                                <h4 className="text-xs font-semibold text-blue-800 mb-1">Payroll Tip</h4>
                                <p className="text-[10px] text-blue-700 leading-tight">Net salary is calculated automatically as (Gross - Deductions).</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="mt-8">
                    <h3 className="text-lg font-semibold mb-3">Payroll History</h3>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Employee</TableHead>
                                <TableHead>Period</TableHead>
                                <TableHead className="text-right">Net Paid</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {payrollEntries.map(p => (
                                <TableRow key={p.payroll_id}>
                                    <TableCell className="text-xs">{new Date(p.payment_date).toLocaleDateString()}</TableCell>
                                    <TableCell className="font-medium text-xs">{p.employee_name}</TableCell>
                                    <TableCell className="text-xs">{new Date(p.pay_period_start).toLocaleDateString()} - {new Date(p.pay_period_end).toLocaleDateString()}</TableCell>
                                    <TableCell className="text-right font-semibold text-xs text-emerald-600">{currency} {Number(p.net_salary).toFixed(2)}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm" onClick={() => handleDeletePayroll(p.payroll_id)} className="text-red-500 hover:text-red-700">Delete</Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Salary Config Dialog */}
            <Dialog open={isSalaryOpen} onOpenChange={setIsSalaryOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Salary Config: {selectedEmp?.name}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSalaryUpdate} className="space-y-4 mt-4">
                        <div className="space-y-2">
                            <Label>Base Monthly Salary</Label>
                            <Input type="number" step="0.01" value={salaryForm.base_salary} onChange={e => setSalaryForm({ ...salaryForm, base_salary: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Hourly Rate (Optional)</Label>
                            <Input type="number" step="0.01" value={salaryForm.hourly_rate} onChange={e => setSalaryForm({ ...salaryForm, hourly_rate: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Standard Deductions (Taxes/EPF)</Label>
                            <Input type="number" step="0.01" value={salaryForm.standard_deductions} onChange={e => setSalaryForm({ ...salaryForm, standard_deductions: e.target.value })} />
                        </div>
                        <Button type="submit" className="w-full">Update Configuration</Button>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Log Payroll Dialog */}
            <Dialog open={isPayrollOpen} onOpenChange={setIsPayrollOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Log Payroll Payment</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAddPayroll} className="space-y-4 mt-4">
                        <div className="space-y-2">
                            <Label>Employee</Label>
                            <Select value={payrollForm.emp_id} onValueChange={val => setPayrollForm({ ...payrollForm, emp_id: val })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {employees.map(e => <SelectItem key={e.emp_id} value={e.emp_id.toString()}>{e.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Gross Pay</Label>
                                <Input type="number" value={payrollForm.gross_pay} onChange={e => setPayrollForm({ ...payrollForm, gross_pay: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Deductions</Label>
                                <Input type="number" value={payrollForm.deductions} onChange={e => setPayrollForm({ ...payrollForm, deductions: e.target.value })} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Period Start</Label>
                                <Input type="date" value={payrollForm.pay_period_start} onChange={e => setPayrollForm({ ...payrollForm, pay_period_start: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Period End</Label>
                                <Input type="date" value={payrollForm.pay_period_end} onChange={e => setPayrollForm({ ...payrollForm, pay_period_end: e.target.value })} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Payment Date</Label>
                            <Input type="date" value={payrollForm.payment_date} onChange={e => setPayrollForm({ ...payrollForm, payment_date: e.target.value })} />
                        </div>
                        <Button type="submit" className="w-full">Process Payment</Button>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
