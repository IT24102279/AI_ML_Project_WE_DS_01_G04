import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    // Create Permissions
    const permissionsData = [
        { action_name: 'VIEW_DASHBOARD', description: 'Can access main dashboard' },
        { action_name: 'CREATE_SALE', description: 'Can process a POS transaction' },
        { action_name: 'VOID_SALE', description: 'Can cancel a POS transaction' },
        { action_name: 'MANAGE_ROLES', description: 'Can modify user roles and permissions' },
        { action_name: 'ASSIGN_DRIVER', description: 'Can assign delivery orders to drivers' },
        { action_name: 'ADJUST_INVENTORY', description: 'Can modify stock counts' },
    ];

    for (const perm of permissionsData) {
        await prisma.permission.upsert({
            where: { action_name: perm.action_name },
            update: {},
            create: perm,
        });
    }

    // Create Roles
    const rolesData = [
        { role_name: 'Admin', description: 'System Administrator' },
        { role_name: 'Head Pharmacist', description: 'Lead pharmacist and manager' },
        { role_name: 'Assistant Pharmacist', description: 'Assists with pharmacy duties' },
        { role_name: 'Cashier', description: 'Frontend point of sale user' },
        { role_name: 'Online Shop Manager', description: 'Manages e-commerce orders' },
        { role_name: 'Delivery Guy', description: 'Handles order deliveries' },
    ];

    for (const role of rolesData) {
        await prisma.role.upsert({
            where: { role_name: role.role_name },
            update: {},
            create: role,
        });
    }

    // Fetch admin role and permissions for mapping
    const adminRole = await prisma.role.findUnique({ where: { role_name: 'Admin' } });
    const allPermissions = await prisma.permission.findMany();

    // Assign ALL permissions to Admin
    if (adminRole) {
        for (const perm of allPermissions) {
            await prisma.role_Permission.upsert({
                where: {
                    role_id_perm_id: {
                        role_id: adminRole.role_id,
                        perm_id: perm.perm_id,
                    },
                },
                update: {},
                create: {
                    role_id: adminRole.role_id,
                    perm_id: perm.perm_id,
                },
            });
        }
    }

    // Dummy Admin Employee
    if (adminRole) {
        const password_hash = await bcrypt.hash('Admin@123', 10);
        await prisma.employee.upsert({
            where: { email: 'admin@pharmacy.com' },
            update: {},
            create: {
                name: 'System Admin',
                email: 'admin@pharmacy.com',
                password_hash,
                role_id: adminRole.role_id,
            },
        });
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
