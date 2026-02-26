import { useState } from 'react';
import { fetchWithAuth } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, UserCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PatientSelectorProps {
    onPatientSelect: (patientId: string | null, discountPct: number) => void;
}

export default function PatientSelector({ onPatientSelect }: PatientSelectorProps) {
    const [searchPhone, setSearchPhone] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState<any>(null);
    const [discountInfo, setDiscountInfo] = useState<{ applied_discount_pct: number } | null>(null);
    const { toast } = useToast();

    const handleSearch = async () => {
        if (!searchPhone || searchPhone.length < 4) return;
        setIsLoading(true);
        try {
            const results = await fetchWithAuth(`/patients/search?phone=${encodeURIComponent(searchPhone)}`);
            if (results.length > 0) {
                const patient = results[0]; // Take best match
                // Fetch discount info
                const discount = await fetchWithAuth(`/patients/${patient.patient_id}/discount`);
                setSelectedPatient(patient);
                setDiscountInfo(discount);
                onPatientSelect(patient.patient_id, discount.applied_discount_pct || 0);
                toast({ title: 'Patient Linked', description: `${patient.name} added to cart.` });
            } else {
                toast({ title: 'Not Found', description: 'No patient registered with that exact phone number.', variant: 'destructive' });
            }
        } catch (error: any) {
            toast({ title: 'Search Failed', description: error.message, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleClear = () => {
        setSearchPhone('');
        setSelectedPatient(null);
        setDiscountInfo(null);
        onPatientSelect(null, 0);
    };

    if (selectedPatient) {
        return (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                    <UserCheck className="text-blue-600 w-5 h-5" />
                    <div>
                        <div className="font-semibold text-blue-900">{selectedPatient.name}</div>
                        <div className="text-xs text-blue-600">
                            Linked to transaction.
                        </div>
                    </div>
                </div>
                <div className="text-right flex items-center gap-3">
                    {discountInfo && discountInfo.applied_discount_pct > 0 && (
                        <Badge variant="default" className="bg-blue-600">
                            {discountInfo.applied_discount_pct}% Discount Applied
                        </Badge>
                    )}
                    <Button variant="ghost" size="sm" onClick={handleClear} className="text-red-600 hover:text-red-800 hover:bg-red-50">
                        Remove
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex gap-2 mb-4">
            <div className="relative flex-grow">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                <Input
                    placeholder="Link Patient (Search by exact phone number)..."
                    className="pl-9"
                    value={searchPhone}
                    onChange={(e) => setSearchPhone(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
            </div>
            <Button onClick={handleSearch} disabled={isLoading} variant="secondary">
                Find Patient
            </Button>
        </div>
    );
}
