import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchWithAuth } from "@/lib/api";

interface InvoiceData {
    invoice_id: number;
    cashier_name: string;
    total_amount: number;
    money_given: number;
    received_at: string;
    payment_method: string;
    items: {
        product_name: string;
        quantity: number;
        unit_price: number;
    }[];
}

export default function Receipt() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [invoice, setInvoice] = useState<InvoiceData | null>(null);
    const [currency, setCurrency] = useState('$');
    const [settings, setSettings] = useState<Record<string, string>>({});

    useEffect(() => {
        const loadInvoice = async () => {
            try {
                // Fetch settings for currency and business details
                const settingsInfo = await fetchWithAuth('/settings');
                setCurrency(settingsInfo.currency || '$');
                setSettings(settingsInfo || {});

                // This endpoint needs to be created on the backend to fetch invoice details
                // For now, let's mock the UI print behavior, as we'll need to add a quick GET /api/pos/invoice/:id
                const invData = await fetchWithAuth(`/pos/invoice/${id}`);
                setInvoice(invData);

                // Trigger print dialog after a slight delay to allow rendering
                setTimeout(() => {
                    window.print();
                }, 500);
            } catch (error) {
                console.error("Failed to load invoice", error);
            }
        };

        if (id) loadInvoice();
    }, [id]);

    if (!invoice) return <div className="p-10 text-center text-slate-500">Loading Receipt...</div>;

    const changeDue = Math.max(0, invoice.money_given - invoice.total_amount);

    return (
        <div className="bg-white min-h-screen font-mono text-sm sm:text-base flex justify-center p-4">
            {/* The printable area */}
            <div className="w-full max-w-sm border border-slate-200 p-6 shadow-sm print:shadow-none print:border-none">
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold uppercase tracking-widest text-slate-800">
                        {settings.pharmacy_name || "Pharmacy POS"}
                    </h1>

                    {(settings.pharmacy_description || settings.pharmacy_phone || settings.pharmacy_email) ? (
                        <div className="text-slate-500 mt-2 text-xs space-y-1">
                            {settings.pharmacy_description && <p>{settings.pharmacy_description}</p>}
                            <p>
                                {settings.pharmacy_phone && <span>Tel: {settings.pharmacy_phone} </span>}
                                {settings.pharmacy_email && <span> | Email: {settings.pharmacy_email}</span>}
                            </p>
                        </div>
                    ) : (
                        <p className="text-slate-500 mt-1">Official Receipt</p>
                    )}

                    <p className="text-slate-400 text-xs mt-3">Invoice #{invoice.invoice_id}</p>
                </div>

                <div className="mb-4 text-xs text-slate-600 space-y-1 border-b border-slate-200 pb-4 flex justify-between">
                    <div>
                        <p>Date: {new Date(invoice.received_at).toLocaleString()}</p>
                        <p>Cashier: {invoice.cashier_name}</p>
                    </div>
                    <div className="text-right">
                        <p>Pay: {invoice.payment_method}</p>
                    </div>
                </div>

                <table className="w-full mb-6">
                    <thead>
                        <tr className="border-b border-slate-200 text-left text-slate-600">
                            <th className="py-2">Item</th>
                            <th className="py-2 text-center">Qty</th>
                            <th className="py-2 text-right">Amt</th>
                        </tr>
                    </thead>
                    <tbody>
                        {invoice.items.map((item, idx) => (
                            <tr key={idx} className="border-b border-slate-100 last:border-0 text-slate-800">
                                <td className="py-3">
                                    <div className="font-semibold">{item.product_name}</div>
                                    <div className="text-xs text-slate-400">@{currency}{Number(item.unit_price).toFixed(2)}</div>
                                </td>
                                <td className="py-3 text-center">{item.quantity}</td>
                                <td className="py-3 text-right font-medium text-slate-900">{currency}{(item.quantity * item.unit_price).toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="space-y-2 border-t border-slate-200 pt-4">
                    <div className="flex justify-between text-lg font-bold">
                        <span>Total</span>
                        <span>{currency}{Number(invoice.total_amount).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                        <span>Paid</span>
                        <span>{currency}{Number(invoice.money_given).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                        <span>Change</span>
                        <span>{currency}{changeDue.toFixed(2)}</span>
                    </div>
                </div>

                <div className="mt-8 text-center text-slate-400 text-xs border-dashed border-t border-slate-300 pt-4">
                    <p>Thank you for your purchase!</p>
                    <p>Please come again.</p>
                </div>

                {/* Return button hidden when printing */}
                <div className="mt-8 text-center print:hidden">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="bg-slate-800 text-white px-6 py-2 rounded-lg hover:bg-slate-700 font-sans"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        </div>
    );
}
