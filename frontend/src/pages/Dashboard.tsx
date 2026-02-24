import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchWithAuth } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

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
    const user = JSON.parse(localStorage.getItem('user') || '{}');

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
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
            if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
                navigate('/login');
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

    if (isLoading) return <div className="p-8 text-center text-lg">Loading RBAC matrix...</div>;

    const canManageRoles = user.permissions?.includes('MANAGE_ROLES');

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8">
            <div className="max-w-6xl mx-auto space-y-6">

                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Pharmacy Dashboard</h1>
                        <p className="text-slate-500">Welcome back, {user.name} ({user.role})</p>
                    </div>
                    <Button variant="outline" onClick={handleLogout}>Logout</Button>
                </div>

                {!canManageRoles && (
                    <Card>
                        <CardContent className="p-6">
                            <p className="text-lg font-medium text-center text-amber-600">
                                You do not have the MANAGE_ROLES permission. You cannot view or edit the RBAC matrix.
                            </p>
                        </CardContent>
                    </Card>
                )}

                {canManageRoles && (
                    <Card>
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
                                                {perm.action_name.replace('_', ' ')}
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
                                                    <TableCell key={perm.perm_id} className="text-center">
                                                        <Checkbox
                                                            checked={isChecked}
                                                            onCheckedChange={() => togglePermission(role.role_id, perm.perm_id)}
                                                        />
                                                    </TableCell>
                                                );
                                            })}

                                            <TableCell className="text-right">
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleSave(role.role_id)}
                                                    disabled={isSaving}
                                                >
                                                    Save
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}

            </div>
        </div>
    );
}
