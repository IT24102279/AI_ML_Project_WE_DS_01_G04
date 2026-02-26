import { useState } from 'react';
import { fetchWithAuth } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import PatientProfile from './PatientProfile';

export default function PatientsTab() {
    const [searchPhone, setSearchPhone] = useState('');
    const [patients, setPatients] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Register Dialog
    const [isOpen, setIsOpen] = useState(false);
    const [formData, setFormData] = useState({ name: '', phone: '', address: '', birth_year: '', clinical_notes: '', consent_given: false });

    // Patient Profile Dialog
    const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

    const { toast } = useToast();

    const handleSearch = async () => {
        if (!searchPhone) return;
        setIsLoading(true);
        try {
            const data = await fetchWithAuth(`/patients/search?phone=${encodeURIComponent(searchPhone)}`);
            setPatients(data);
        } catch (error: any) {
            toast({ title: 'Search Failed', description: error.message, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await fetchWithAuth('/patients', {
                method: 'POST',
                body: JSON.stringify({
                    ...formData,
                    birth_year: Number(formData.birth_year)
                })
            });
            toast({ title: 'Success', description: 'Patient registered successfully.' });
            setIsOpen(false);
            setSearchPhone(formData.phone);
            setFormData({ name: '', phone: '', address: '', birth_year: '', clinical_notes: '', consent_given: false });
            setTimeout(handleSearch, 500);
        } catch (error: any) {
            toast({ title: 'Registration Failed', description: error.message, variant: 'destructive' });
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border">
                <div className="flex space-x-2 flex-grow max-w-md">
                    <Input
                        placeholder="Search patient by exact phone number..."
                        value={searchPhone}
                        onChange={(e) => setSearchPhone(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <Button onClick={handleSearch} disabled={isLoading}>Search</Button>
                </div>
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button>Register New Patient</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Register Patient</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleRegister} className="space-y-4 pt-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Full Name *</Label>
                                    <Input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Phone Number *</Label>
                                    <Input required value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Birth Year *</Label>
                                    <Input type="number" required min="1900" max={new Date().getFullYear()} value={formData.birth_year} onChange={e => setFormData({ ...formData, birth_year: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Address</Label>
                                    <Input value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Clinical Notes / Allergies</Label>
                                <Textarea value={formData.clinical_notes} onChange={e => setFormData({ ...formData, clinical_notes: e.target.value })} />
                            </div>
                            <div className="flex items-start space-x-2 bg-slate-50 p-3 rounded-md border mt-4">
                                <Checkbox id="consent" checked={formData.consent_given} onCheckedChange={(c) => setFormData({ ...formData, consent_given: c as boolean })} />
                                <label htmlFor="consent" className="text-xs text-slate-600 font-medium leading-none max-w-[90%]">
                                    I confirm the patient consents to their data being stored, and I understand they can opt-out at any time. *
                                </label>
                            </div>
                            <Button type="submit" className="w-full" disabled={!formData.consent_given}>Register Patient</Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead>Patient Name</TableHead>
                            <TableHead>Phone Hash (Search Match)</TableHead>
                            <TableHead>Birth Year</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {patients.map(p => (
                            <TableRow key={p.patient_id}>
                                <TableCell className="font-medium">{p.name}</TableCell>
                                <TableCell className="text-slate-500 font-mono text-xs">{p.phone}</TableCell>
                                <TableCell>{p.birth_year}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="outline" size="sm" onClick={() => setSelectedPatientId(p.patient_id)}>
                                        View Profile
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {(patients.length === 0 && !isLoading) && (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                                    Search for a patient by phone number to display their records.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {selectedPatientId && (
                <PatientProfile
                    patientId={selectedPatientId}
                    isOpen={!!selectedPatientId}
                    onClose={() => {
                        setSelectedPatientId(null);
                        handleSearch(); // Refresh list in case of opt-out
                    }}
                />
            )}
        </div>
    );
}
