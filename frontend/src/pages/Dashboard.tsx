import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchWithAuth } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import InventoryTab from '@/components/dashboard/InventoryTab';
import SuppliersTab from '@/components/dashboard/SuppliersTab';
import GRNTab from '@/components/dashboard/GRNTab';
import FinanceTab from '@/components/dashboard/FinanceTab';

interface Permission {
    perm_id: number;
    action_name: string;
    description?: string;
}

interface Role {
    role_id: number;
    role_name: string;
    permissions: { perm_id: number; action_name: string }[];
}

export default function Dashboard() {
    const [roles, setRoles] = useState<Role[]>([]);
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const navigate = useNavigate();
    const { toast } = useToast();

    // The logged-in user
    const user = JSON.parse(localStorage.getItem('user') || '{}') as any;

    const loadData = async () => {
        try {
            setIsLoading(true);
            const [rolesData, permsData] = await Promise.all([
                fetchWithAuth('/roles'),
                fetchWithAuth('/permissions')
            ]);
            setRoles(rolesData.roles);
            setPermissions(permsData.permissions);
        } catch (error: any) {
            // It's okay if /roles fails if they don't have MANAGE_ROLES perm
            if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
                if (!localStorage.getItem('token')) navigate('/login');
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!localStorage.getItem('token')) {
            navigate('/login');
            return;
        }
        loadData();
    }, [navigate]);

    const togglePermission = (roleId: number, permId: number) => {
        setRoles(prevRoles => prevRoles.map(role => {
            if (role.role_id === roleId) {
                const hasPerm = role.permissions.some(p => p.perm_id === permId);
                const updatedPerms = hasPerm
                    ? role.permissions.filter(p => p.perm_id !== permId)
                    : [...role.permissions, { perm_id: permId, action_name: '' }];
                return { ...role, permissions: updatedPerms };
            }
            return role;
        }));
    };

    const handleSave = async (roleId: number) => {
        const role = roles.find(r => r.role_id === roleId);
        if (!role) return;

        const permission_ids = role.permissions.map(p => p.perm_id);
        setIsSaving(true);

        try {
            await fetchWithAuth(`/roles/${roleId}/permissions`, {
                method: 'PUT',
                body: JSON.stringify({ permission_ids })
            });
            toast({ title: 'Saved', description: `Permissions for ${role.role_name} updated successfully.` });
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
    };

    if (isLoading) return <div className="p-8 text-center text-lg">Loading Dashboard...</div>;

    const userPerms: string[] = user.permissions || [];
    const canManageRoles = userPerms.includes('MANAGE_ROLES');
    const canViewInventory = userPerms.includes('VIEW_TAB_INVENTORY');
    const canViewSuppliers = userPerms.includes('VIEW_TAB_SUPPLIERS');
    const canViewGRN = userPerms.includes('VIEW_TAB_GRN');
    const canViewFinance = userPerms.includes('VIEW_TAB_FINANCE');

    // Determine default tab based on permissions
    let defaultTab = canManageRoles ? "rbac" : (canViewInventory ? "inventory" : (canViewSuppliers ? "suppliers" : "home"));

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8">
            <div className="max-w-6xl mx-auto space-y-6">

                <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-blue-900">Pharmacy POS System</h1>
                        <p className="text-slate-500 mt-1">Logged in as <span className="font-semibold text-slate-800">{user.name}</span> ({user.role})</p>
                    </div>
                    <Button variant="outline" onClick={handleLogout} className="border-red-200 text-red-600 hover:bg-red-50">Logout</Button>
                </div>

                <Tabs defaultValue={defaultTab} className="w-full">
                    <TabsList className="mb-6 bg-white border shadow-sm p-1 rounded-lg">
                        {canManageRoles && <TabsTrigger value="rbac">Roles & Permissions</TabsTrigger>}
                        {canViewInventory && <TabsTrigger value="inventory">Products / Alerts</TabsTrigger>}
                        {canViewSuppliers && <TabsTrigger value="suppliers">Suppliers</TabsTrigger>}
                        {canViewGRN && <TabsTrigger value="grn">Receive Stock (GRN)</TabsTrigger>}
                        {canViewFinance && <TabsTrigger value="finance">Finance Checks</TabsTrigger>}
                    </TabsList>

                    {canManageRoles && (
                        <TabsContent value="rbac">
                            <Card className="shadow-sm">
                                <CardHeader>
                                    <CardTitle>Role & Permission Manager GUI</CardTitle>
                                </CardHeader>
                                <CardContent className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[150px]">Roles</TableHead>
                                                {permissions.map(perm => (
                                                    <TableHead key={perm.perm_id} className="text-center text-xs whitespace-nowrap px-2">
                                                        {perm.action_name.replace(/_/g, ' ')}
                                                    </TableHead>
                                                ))}
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {roles.map(role => (
                                                <TableRow key={role.role_id}>
                                                    <TableCell className="font-medium">{role.role_name}</TableCell>

                                                    {permissions.map(perm => {
                                                        const isChecked = role.permissions.some(p => p.perm_id === perm.perm_id);
                                                        return (
                                                            <TableCell key={perm.perm_id} className="text-center bg-slate-50/50">
                                                                <Checkbox
                                                                    checked={isChecked}
                                                                    onCheckedChange={() => togglePermission(role.role_id, perm.perm_id)}
                                                                />
                                                            </TableCell>
                                                        );
                                                    })}

                                                    <TableCell className="text-right">
                                                        <Button size="sm" onClick={() => handleSave(role.role_id)} disabled={isSaving}>
                                                            Save Matrix
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    )}

                    {canViewInventory && (
                        <TabsContent value="inventory">
                            <Card className="shadow-sm">
                                <CardContent className="p-6">
                                    <InventoryTab />
                                </CardContent>
                            </Card>
                        </TabsContent>
                    )}

                    {canViewSuppliers && (
                        <TabsContent value="suppliers">
                            <Card className="shadow-sm">
                                <CardContent className="p-6">
                                    <SuppliersTab />
                                </CardContent>
                            </Card>
                        </TabsContent>
                    )}

                    {canViewGRN && (
                        <TabsContent value="grn">
                            <div className="bg-white rounded-xl border shadow-sm p-6">
                                <GRNTab />
                            </div>
                        </TabsContent>
                    )}

                    {canViewFinance && (
                        <TabsContent value="finance">
                            <Card className="shadow-sm">
                                <CardContent className="p-6">
                                    <FinanceTab />
                                </CardContent>
                            </Card>
                        </TabsContent>
                    )}

                    {!canManageRoles && !canViewInventory && !canViewSuppliers && !canViewGRN && !canViewFinance && (
                        <div className="text-center py-20 text-slate-500 bg-white rounded-xl border shadow-sm">
                            <p className="text-xl">Welcome to your dashboard.</p>
                            <p className="text-sm">You do not have any module permissions assigned yet.</p>
                        </div>
                    )}

                </Tabs>
            </div>
        </div>
    );
}
