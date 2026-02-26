import { useState, useEffect } from 'react';

export default function DriverApp() {
    const [orders, setOrders] = useState<any[]>([]);
    const driverId = 44; // Hardcoded mock driver ID

    useEffect(() => {
        fetchAssignedOrders();
    }, []);

    const fetchAssignedOrders = async () => {
        try {
            const res = await fetch(`http://localhost:4000/api/orders?driver_id=${driverId}`);
            if (res.ok) setOrders(await res.json());
        } catch (e) { console.error(e); }
    };

    const updateStatus = async (orderId: number, nextStatus: string) => {
        try {
            await fetch(`http://localhost:4000/api/orders/${orderId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ driver_id: driverId, status: nextStatus })
            });
            fetchAssignedOrders();
        } catch (e) { console.error(e); }
    };

    const pendingDeliveries = orders.filter(o => o.status === 'Packing' || o.status === 'Handed to Driver');

    return (
        <div className="min-h-screen bg-slate-900 text-white font-sans flex flex-col max-w-md mx-auto shadow-2xl">
            <div className="bg-emerald-600 p-4 sticky top-0 z-10 shadow-md flex justify-between items-center">
                <div>
                    <h1 className="font-bold text-lg">Driver Portal</h1>
                    <p className="text-emerald-200 text-xs">ID #{driverId} • Active</p>
                </div>
                <div className="bg-emerald-800 text-emerald-100 rounded-full px-3 py-1 text-sm font-bold">
                    {pendingDeliveries.length} Stops
                </div>
            </div>

            <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4">
                {orders.map(order => (
                    <div key={order.order_id} className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                        <div className="flex justify-between items-center mb-3">
                            <span className="font-bold text-slate-200">Order #{order.order_id}</span>
                            <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded ${order.status === 'Delivered' ? 'bg-emerald-900/50 text-emerald-400' :
                                    order.status === 'Packing' ? 'bg-amber-900/50 text-amber-400' :
                                        'bg-blue-900/50 text-blue-400'
                                }`}>
                                {order.status}
                            </span>
                        </div>

                        <div className="text-slate-400 text-xs mb-4">
                            <div>Customer ID: <span className="text-slate-300 font-medium">{order.customer_id}</span></div>
                            <div>Placed: {new Date(order.created_at).toLocaleTimeString()}</div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2 mt-2">
                            {order.status === 'Packing' && (
                                <button
                                    onClick={() => updateStatus(order.order_id, 'Handed to Driver')}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition-colors"
                                >
                                    Confirm Pickup 📦
                                </button>
                            )}
                            {order.status === 'Handed to Driver' && (
                                <button
                                    onClick={() => updateStatus(order.order_id, 'Delivered')}
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-medium transition-colors"
                                >
                                    Mark Delivered ✅
                                </button>
                            )}
                            {order.status === 'Delivered' && (
                                <div className="w-full text-center text-slate-500 text-sm py-2">
                                    Delivery Complete
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {orders.length === 0 && (
                    <div className="text-center py-12 text-slate-500">
                        No active assignments.
                    </div>
                )}
            </div>
        </div>
    );
}
