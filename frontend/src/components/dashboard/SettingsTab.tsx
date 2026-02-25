import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function SettingsTab() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [settings, setSettings] = useState({
        pharmacy_name: "",
        pharmacy_phone: "",
        pharmacy_email: "",
        pharmacy_description: ""
    });

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setIsLoading(true);
        try {
            const data = await fetchWithAuth('/settings');
            setSettings({
                pharmacy_name: data.pharmacy_name || "",
                pharmacy_phone: data.pharmacy_phone || "",
                pharmacy_email: data.pharmacy_email || "",
                pharmacy_description: data.pharmacy_description || ""
            });
        } catch (error: any) {
            toast({ title: "Error", description: "Failed to load settings.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            for (const [key, value] of Object.entries(settings)) {
                await fetchWithAuth(`/settings/${key}`, {
                    method: 'PUT',
                    body: JSON.stringify({ value })
                });
            }
            toast({ title: "Settings Saved", description: "Pharmacy details updated successfully." });
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return <div className="p-8 text-center">Loading settings...</div>;

    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <h3 className="text-lg font-medium">Pharmacy Business Details</h3>
                <p className="text-sm text-slate-500">
                    These details will be displayed on the official receipt and other public-facing documents.
                </p>
            </div>

            <div className="grid gap-4">
                <div className="space-y-2">
                    <Label htmlFor="pharmacy_name">Pharmacy Name</Label>
                    <Input
                        id="pharmacy_name"
                        value={settings.pharmacy_name}
                        onChange={(e) => setSettings({ ...settings, pharmacy_name: e.target.value })}
                        placeholder="E.g. City Central Pharmacy"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="pharmacy_phone">Phone Number</Label>
                    <Input
                        id="pharmacy_phone"
                        value={settings.pharmacy_phone}
                        onChange={(e) => setSettings({ ...settings, pharmacy_phone: e.target.value })}
                        placeholder="E.g. +1 555-123-4567"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="pharmacy_email">Email Address</Label>
                    <Input
                        id="pharmacy_email"
                        type="email"
                        value={settings.pharmacy_email}
                        onChange={(e) => setSettings({ ...settings, pharmacy_email: e.target.value })}
                        placeholder="E.g. contact@citypharmacy.com"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="pharmacy_description">Address & Tagline</Label>
                    <Textarea
                        id="pharmacy_description"
                        value={settings.pharmacy_description}
                        onChange={(e: any) => setSettings({ ...settings, pharmacy_description: e.target.value })}
                        placeholder="E.g. 123 Health Ave, NY. 'Your health is our priority!'"
                        rows={3}
                    />
                </div>
            </div>

            <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Saving details..." : "Save Details"}
            </Button>
        </div>
    );
}
