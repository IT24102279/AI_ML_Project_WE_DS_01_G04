import { useState, useEffect } from 'react';
import { fetchWithAuth } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { ShieldAlert, UserX, Receipt, FileText, AlertTriangle, Edit } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface PatientProfileProps {
    patientId: string;
    isOpen: boolean;
    onClose: () => void;
    currency?: string;
}

export default function PatientProfile({ patientId, isOpen, onClose, currency = '$' }: PatientProfileProps) {
    const [patient, setPatient] = useState<any>(null);
    const [discountData, setDiscountData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ name: '', phone: '', address: '', birth_year: '', clinical_notes: '' });
    const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
    const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (isOpen && patientId) {
            loadPatientData();
        }
    }, [isOpen, patientId]);

    const loadPatientData = async () => {
        setIsLoading(true);
        try {
            const [profile, discount] = await Promise.all([
                fetchWithAuth(`/patients/${patientId}`),
                fetchWithAuth(`/patients/${patientId}/discount`)
            ]);
            setPatient(profile);
            setDiscountData(discount);
            setEditForm({
                name: profile.name || '',
                phone: profile.phone || '',
                address: profile.address || '',
                birth_year: profile.birth_year || '',
                clinical_notes: profile.clinical_notes || ''
            });
        } catch (error: any) {
            toast({ title: 'Error loading profile', description: error.message, variant: 'destructive' });
            onClose();
        } finally {
            setIsLoading(false);
        }
    };

    const handleOptOut = async () => {
        if (!confirm('WARNING: This will permanently purge all PII from the database. Sales history will remain but be permanently anonymized. This action CANNOT be undone. Proceed?')) {
            return;
        }

        try {
            await fetchWithAuth(`/patients/${patientId}/opt-out`, { method: 'DELETE' });
            toast({ title: 'Data Anonymized', description: 'Patient PII has been permanently scrubbed.' });
            onClose();
        } catch (error: any) {
            toast({ title: 'Opt-Out Failed', description: error.message, variant: 'destructive' });
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await fetchWithAuth(`/patients/${patientId}`, {
                method: 'PUT',
                body: JSON.stringify({ ...editForm, birth_year: Number(editForm.birth_year) })
            });
            toast({ title: 'Profile Updated', description: 'Patient details have been updated successfully.' });
            setIsEditing(false);
            loadPatientData();
        } catch (error: any) {
            toast({ title: 'Update Failed', description: error.message, variant: 'destructive' });
        }
    };

    const viewInvoice = async (id: number) => {
        try {
            const data = await fetchWithAuth(`/pos/invoice/${id}`);
            setSelectedInvoice(data);
            setIsInvoiceModalOpen(true);
        } catch (error: any) {
            toast({ title: "Error", description: "Failed to load invoice details.", variant: "destructive" });
        }
    };

    if (isLoading) {
        return (
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent>
                    <div className="flex justify-center p-8">Loading decrypted patient file...</div>
                </DialogContent>
            </Dialog>
        );
    }

    if (!patient) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader className="border-b pb-4 mb-4">
                    <div className="flex justify-between items-start">
                        <div>
                            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                                {patient.name || 'Anonymized Patient'}
                                {patient.opted_out && <Badge variant="destructive">Data Purged</Badge>}
                            </DialogTitle>
                            <DialogDescription className="text-slate-500 mt-1">
                                Patient ID: <span className="font-mono text-xs">{patient.patient_id}</span>
                            </DialogDescription>
                        </div>
                        {!patient.opted_out && (
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setIsEditing(!isEditing)} className="gap-2">
                                    <Edit className="w-4 h-4" /> {isEditing ? 'Cancel Edit' : 'Edit Profile'}
                                </Button>
                                <Button variant="destructive" onClick={handleOptOut} className="gap-2">
                                    <UserX className="w-4 h-4" /> Process Opt-Out (GDPR)
                                </Button>
                            </div>
                        )}
                    </div>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    {/* Bio Data Section */}
                    <div className="col-span-1 md:col-span-2 space-y-4">
                        {isEditing ? (
                            <form onSubmit={handleUpdate} className="bg-slate-50 p-4 rounded-lg border space-y-4">
                                <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                                    <Edit className="w-4 h-4 text-blue-500" /> Edit Bio Data
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Full Name *</Label>
                                        <Input value={editForm.name} pattern="^[A-Za-z\s]+$" title="Name can only contain alphabetic characters and spaces" onChange={e => setEditForm({ ...editForm, name: e.target.value })} required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Phone *</Label>
                                        <Input required type="tel" pattern="[0-9\+\-\s]+" value={editForm.phone} onChange={e => setEditForm(prev => ({ ...prev, phone: e.target.value }))} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Birth Year *</Label>
                                        <Input required type="number" min="1900" max={new Date().getFullYear()} value={editForm.birth_year} onChange={e => setEditForm(prev => ({ ...prev, birth_year: e.target.value }))} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Address</Label>
                                        <Input value={editForm.address} onChange={e => setEditForm(prev => ({ ...prev, address: e.target.value }))} />
                                    </div>
                                    <div className="col-span-2 space-y-2">
                                        <Label>Clinical Notes</Label>
                                        <Textarea value={editForm.clinical_notes} onChange={e => setEditForm(prev => ({ ...prev, clinical_notes: e.target.value }))} />
                                    </div>
                                </div>
                                <Button type="submit" className="w-full">Save Changes</Button>
                            </form>
                        ) : (
                            <div className="bg-slate-50 p-4 rounded-lg border">
                                <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                                    <ShieldAlert className="w-4 h-4 text-blue-500" /> Decrypted Bio Data
                                </h3>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-slate-500 block text-xs uppercase tracking-wider">Phone</span>
                                        <span className="font-medium">{patient.phone || 'N/A'}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500 block text-xs uppercase tracking-wider">Birth Year</span>
                                        <span className="font-medium">{patient.birth_year} (Age: {new Date().getFullYear() - patient.birth_year})</span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="text-slate-500 block text-xs uppercase tracking-wider">Address</span>
                                        <span className="font-medium">{patient.address || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {!isEditing && patient.clinical_notes && (
                            <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                                <h3 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4" /> Clinical Warnings & Allergies
                                </h3>
                                <p className="text-sm text-amber-900 whitespace-pre-wrap">{patient.clinical_notes}</p>
                            </div>
                        )}
                    </div>

                    {/* Discount & Loyalty Engine */}
                    <div className="col-span-1 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-100">
                        <h3 className="font-semibold text-blue-800 mb-3 text-center">Discount Eligiblity</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-600">Senior Base (≥60):</span>
                                <span className="font-bold">{discountData?.senior_pct}%</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-600">Loyalty Earned:</span>
                                <span className="font-bold">{discountData?.loyalty_pct}%</span>
                            </div>
                            <div className="pt-3 border-t border-blue-200 flex justify-between items-center">
                                <span className="font-semibold text-blue-900">Total Approved:</span>
                                <span className="text-xl font-black text-blue-600">{discountData?.applied_discount_pct}%</span>
                            </div>
                            <div className="text-center mt-2">
                                <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-700 hover:bg-blue-100">CAPPED AT 7%</Badge>
                            </div>
                        </div>
                    </div>
                </div>

                <Tabs defaultValue="purchases" className="w-full">
                    <TabsList className="grid w-full grid-cols-1">
                        <TabsTrigger value="purchases" className="gap-2"><Receipt className="w-4 h-4" /> Purchase History</TabsTrigger>
                    </TabsList>

                    <TabsContent value="purchases" className="border rounded-md mt-2">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Invoice #</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Method</TableHead>
                                    <TableHead className="text-right">Total Amount</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {patient.history.invoices.map((inv: any) => (
                                    <TableRow key={inv.invoice_id}>
                                        <TableCell className="font-medium">INV-{inv.invoice_id}</TableCell>
                                        <TableCell>{new Date(inv.created_at).toLocaleDateString()}</TableCell>
                                        <TableCell>{inv.payment_method}</TableCell>
                                        <TableCell className="text-right font-bold">{currency}{Number(inv.total_amount).toFixed(2)}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" onClick={() => viewInvoice(inv.invoice_id)} className="text-blue-600 gap-1">
                                                <FileText className="w-4 h-4" /> View Details
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {patient.history.invoices.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center text-slate-500 py-4">No past purchases linked.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TabsContent>
                </Tabs>

                {/* Invoice Details Modal */}
                <Dialog open={isInvoiceModalOpen} onOpenChange={setIsInvoiceModalOpen}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Order Details - INV-{selectedInvoice?.invoice_id}</DialogTitle>
                            <DialogDescription>
                                Date: {selectedInvoice && new Date(selectedInvoice.received_at).toLocaleString()} | Cashier: {selectedInvoice?.cashier_name}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                            {/* Prescription Section */}
                            {selectedInvoice?.items?.filter((i: any) => i.item_type === 'rx').length > 0 && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-indigo-700 font-bold border-b pb-1 border-indigo-100">
                                        <FileText className="w-4 h-4" /> Prescription Items
                                    </div>
                                    <Table>
                                        <TableHeader className="bg-indigo-50/50">
                                            <TableRow>
                                                <TableHead>Medication</TableHead>
                                                <TableHead>Freq</TableHead>
                                                <TableHead className="text-center">Qty</TableHead>
                                                <TableHead className="text-right">Subtotal</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {selectedInvoice.items.filter((i: any) => i.item_type === 'rx').map((item: any, idx: number) => (
                                                <TableRow key={idx}>
                                                    <TableCell className="font-medium">{item.product_name}</TableCell>
                                                    <TableCell><Badge variant="outline" className="font-normal">{item.frequency || 'N/A'}</Badge></TableCell>
                                                    <TableCell className="text-center">{item.quantity}</TableCell>
                                                    <TableCell className="text-right">{currency}{(item.quantity * item.unit_price).toFixed(2)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}

                            {/* OTC Section */}
                            {selectedInvoice?.items?.filter((i: any) => i.item_type === 'otc').length > 0 && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-slate-700 font-bold border-b pb-1 border-slate-100">
                                        <Receipt className="w-4 h-4" /> Over The Counter Items
                                    </div>
                                    <Table>
                                        <TableHeader className="bg-slate-50/50">
                                            <TableRow>
                                                <TableHead>Product</TableHead>
                                                <TableHead className="text-center">Qty</TableHead>
                                                <TableHead className="text-right">Subtotal</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {selectedInvoice.items.filter((i: any) => i.item_type === 'otc').map((item: any, idx: number) => (
                                                <TableRow key={idx}>
                                                    <TableCell className="font-medium">{item.product_name}</TableCell>
                                                    <TableCell className="text-center">{item.quantity}</TableCell>
                                                    <TableCell className="text-right">{currency}{(item.quantity * item.unit_price).toFixed(2)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}

                            <div className="flex justify-between items-center py-4 border-t border-slate-200 mt-4">
                                <div className="text-sm text-slate-500">
                                    Payment Method: <span className="font-medium text-slate-800">{selectedInvoice?.payment_method}</span>
                                </div>
                                <div className="text-right">
                                    <p className="text-slate-500 text-xs">Total Amount Paid</p>
                                    <p className="text-2xl font-black text-blue-700">{currency}{Number(selectedInvoice?.total_amount).toFixed(2)}</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-4">
                            <Button variant="outline" onClick={() => window.open(`/receipt/${selectedInvoice.invoice_id}`, '_blank')}>Print Receipt</Button>
                            <Button onClick={() => setIsInvoiceModalOpen(false)}>Close</Button>
                        </div>
                    </DialogContent>
                </Dialog>

            </DialogContent>
        </Dialog >
    );
}
