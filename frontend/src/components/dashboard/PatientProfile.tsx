import { useState, useEffect } from 'react';
import { fetchWithAuth } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { ShieldAlert, UserX, Receipt, FileText, AlertTriangle } from 'lucide-react';

interface PatientProfileProps {
    patientId: string;
    isOpen: boolean;
    onClose: () => void;
}

export default function PatientProfile({ patientId, isOpen, onClose }: PatientProfileProps) {
    const [patient, setPatient] = useState<any>(null);
    const [discountData, setDiscountData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
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
                            <Button variant="destructive" onClick={handleOptOut} className="gap-2">
                                <UserX className="w-4 h-4" /> Process Opt-Out (GDPR)
                            </Button>
                        )}
                    </div>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    {/* Bio Data Section */}
                    <div className="col-span-1 md:col-span-2 space-y-4">
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

                        {patient.clinical_notes && (
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
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="purchases" className="gap-2"><Receipt className="w-4 h-4" /> Purchase History</TabsTrigger>
                        <TabsTrigger value="prescriptions" className="gap-2"><FileText className="w-4 h-4" /> Digital Prescriptions</TabsTrigger>
                    </TabsList>

                    <TabsContent value="purchases" className="border rounded-md mt-2">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Invoice #</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Method</TableHead>
                                    <TableHead className="text-right">Total Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {patient.history.invoices.map((inv: any) => (
                                    <TableRow key={inv.invoice_id}>
                                        <TableCell className="font-medium">INV-{inv.invoice_id}</TableCell>
                                        <TableCell>{new Date(inv.created_at).toLocaleDateString()}</TableCell>
                                        <TableCell>{inv.payment_method}</TableCell>
                                        <TableCell className="text-right font-bold">${Number(inv.total_amount).toFixed(2)}</TableCell>
                                    </TableRow>
                                ))}
                                {patient.history.invoices.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center text-slate-500 py-4">No past purchases linked.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TabsContent>

                    <TabsContent value="prescriptions" className="border rounded-md mt-2">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Script ID</TableHead>
                                    <TableHead>Date Uploaded</TableHead>
                                    <TableHead>Verification Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {patient.history.prescriptions.map((rx: any) => (
                                    <TableRow key={rx.prescription_id}>
                                        <TableCell className="font-medium">RX-{rx.prescription_id}</TableCell>
                                        <TableCell>{new Date(rx.created_at).toLocaleDateString()}</TableCell>
                                        <TableCell>
                                            <Badge variant={rx.status === 'Verified' ? 'default' : 'secondary'}>
                                                {rx.status}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {patient.history.prescriptions.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center text-slate-500 py-4">No prescriptions logged.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TabsContent>
                </Tabs>

            </DialogContent>
        </Dialog>
    );
}
