import { useState, useEffect, useRef } from 'react';

interface Message {
    message_id?: number;
    sender: 'Customer' | 'LLM' | 'Pharmacist';
    content: string;
    timestamp?: string;
}

export default function CustomerChat() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputStr, setInputStr] = useState('');
    const [sessionId] = useState(() => crypto.randomUUID());
    const [customerId] = useState(1); // Hardcoded mock user ID 1
    const endOfMessagesRef = useRef<HTMLDivElement>(null);

    // Auto-scroll inside useEffect
    useEffect(() => {
        endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Polling for live Pharmacist messages
    useEffect(() => {
        const fetchMsgs = async () => {
            try {
                const res = await fetch(`http://localhost:4000/api/chat/sessions/${sessionId}/messages`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.length > messages.length) {
                        setMessages(data);
                    }
                }
            } catch (e) { }
        };

        const intervalId = setInterval(fetchMsgs, 3000);
        return () => clearInterval(intervalId);
    }, [sessionId, messages.length]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputStr.trim()) return;

        const userMsg = inputStr;
        setInputStr('');

        // Optistic UI Update
        setMessages(prev => [...prev, { sender: 'Customer', content: userMsg }]);

        try {
            const res = await fetch('http://localhost:4000/api/chat/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customer_id: customerId,
                    session_id: sessionId,
                    content: userMsg
                })
            });

            const data = await res.json();
            if (data.llm_reply) {
                setMessages(prev => [...prev, { sender: 'LLM', content: data.llm_reply }]);
            }
        } catch (e) {
            console.error(e);
            setMessages(prev => [...prev, { sender: 'LLM', content: 'Connection error while reaching the assistant.' }]);
        }
    };

    const [bookDate, setBookDate] = useState('');
    const [bookTimeOnly, setBookTimeOnly] = useState('');
    const [bookNote, setBookNote] = useState('');
    const [myAppointments, setMyAppointments] = useState<any[]>([]);
    const [editingAppointmentId, setEditingAppointmentId] = useState<number | null>(null);

    const fetchMyAppointments = async () => {
        try {
            const res = await fetch(`http://localhost:4000/api/customers/${customerId}/appointments`);
            if (res.ok) setMyAppointments(await res.json());
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        fetchMyAppointments();
    }, [customerId]);

    const handleEditClick = (app: any) => {
        setEditingAppointmentId(app.id);
        const dateObj = new Date(app.scheduled_time);

        // Extract YYYY-MM-DD
        const Y = dateObj.getFullYear();
        const M = String(dateObj.getMonth() + 1).padStart(2, '0');
        const D = String(dateObj.getDate()).padStart(2, '0');
        setBookDate(`${Y}-${M}-${D}`);

        // Extract HH:MM
        const h = String(dateObj.getHours()).padStart(2, '0');
        const m = String(dateObj.getMinutes()).padStart(2, '0');
        setBookTimeOnly(`${h}:${m}`);

        setBookNote(app.symptoms_note || '');
    };

    const handleDeleteAppointment = async (id: number) => {
        if (!confirm('Cancel this appointment?')) return;
        try {
            await fetch(`http://localhost:4000/api/appointments/${id}`, { method: 'DELETE' });
            fetchMyAppointments();
        } catch (e) { console.error(e); }
    };

    const handleBooking = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const url = editingAppointmentId
                ? `http://localhost:4000/api/appointments/${editingAppointmentId}`
                : 'http://localhost:4000/api/appointments/book';

            const method = editingAppointmentId ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customer_id: customerId,
                    scheduled_time: `${bookDate}T${bookTimeOnly}`,
                    symptoms_note: bookNote
                })
            });
            if (res.ok) {
                alert(editingAppointmentId ? "Appointment updated!" : "Appointment booked successfully!");
                setBookDate('');
                setBookTimeOnly('');
                setBookNote('');
                setEditingAppointmentId(null);
                fetchMyAppointments();
            } else {
                alert("Failed to book appointment.");
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleOptOut = async () => {
        if (!confirm('This action will permanently purge your identifiable data. Proceed?')) return;
        try {
            await fetch(`http://localhost:4000/api/customers/${customerId}/opt-out`, { method: 'DELETE' });
            alert("Account anonymized.");
            window.location.reload();
        } catch (e) { console.error(e); }
    };

    return (
        <div className="flex flex-col md:flex-row h-[calc(100vh-40px)] w-full max-w-7xl mx-auto p-4 gap-6">

            {/* Sidebar Operations */}
            <div className="w-full md:w-1/3 flex flex-col gap-6">
                <div className="bg-white border rounded-lg p-6 shadow-sm">
                    <h2 className="text-xl font-bold mb-4">{editingAppointmentId ? 'Reschedule' : 'Book'} Consultation</h2>
                    <form onSubmit={handleBooking} className="flex flex-col gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Date & Time</label>
                            <div className="flex gap-2">
                                <input
                                    type="date"
                                    required
                                    value={bookDate}
                                    onChange={e => setBookDate(e.target.value)}
                                    className="flex-1 border rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                />
                                <select
                                    required
                                    value={bookTimeOnly}
                                    onChange={e => setBookTimeOnly(e.target.value)}
                                    className="w-32 border rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                >
                                    <option value="" disabled>Time</option>
                                    {[...Array(17)].map((_, i) => {
                                        const hour = Math.floor(i / 2) + 9;
                                        const minute = (i % 2) * 30;
                                        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                                        return (
                                            <option key={timeStr} value={timeStr}>
                                                {hour > 12 ? hour - 12 : hour}:{minute.toString().padStart(2, '0')} {hour >= 12 ? 'PM' : 'AM'}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Symptoms (Optional)</label>
                            <textarea
                                rows={3}
                                value={bookNote}
                                onChange={e => setBookNote(e.target.value)}
                                className="w-full border rounded p-2"
                                placeholder="Briefly describe your health concern..."
                            ></textarea>
                        </div>
                        <div className="flex gap-2">
                            <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded transition-colors">
                                {editingAppointmentId ? 'Update Appointment' : 'Schedule Now'}
                            </button>
                            {editingAppointmentId && (
                                <button type="button" onClick={() => {
                                    setEditingAppointmentId(null);
                                    setBookDate('');
                                    setBookTimeOnly('');
                                    setBookNote('');
                                }} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-medium py-2 px-4 rounded transition-colors">
                                    Cancel
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                <div className="bg-white border rounded-lg p-6 shadow-sm flex flex-col gap-3">
                    <h3 className="font-semibold text-slate-800">My Appointments</h3>
                    {myAppointments.length === 0 ? (
                        <p className="text-sm text-slate-500">No upcoming appointments.</p>
                    ) : (
                        <div className="flex flex-col gap-3 max-h-48 overflow-y-auto pr-1">
                            {myAppointments.map(app => (
                                <div key={app.id} className="border rounded p-3 text-sm flex justify-between items-center bg-slate-50 transition-colors">
                                    <div className="overflow-hidden">
                                        <div className="font-medium text-slate-800">{new Date(app.scheduled_time).toLocaleString(undefined, {
                                            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                                        })}</div>
                                        {app.symptoms_note && <div className="text-slate-500 text-xs mt-1 truncate max-w-[150px]">{app.symptoms_note}</div>}
                                    </div>
                                    <div className="flex gap-2 pl-2">
                                        <button onClick={() => handleEditClick(app)} className="text-blue-600 hover:text-blue-800 font-semibold px-1">Edit</button>
                                        <button onClick={() => handleDeleteAppointment(app.id)} className="text-red-600 hover:text-red-800 font-semibold px-1">Cancel</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="bg-white border rounded-lg p-6 shadow-sm flex flex-col gap-2 mt-auto">
                    <h3 className="font-semibold">Privacy Controls</h3>
                    <p className="text-sm text-slate-500 mb-2">Request GDPR data purge of personal identifiers.</p>
                    <button onClick={handleOptOut} className="border border-red-300 text-red-600 hover:bg-red-50 font-medium py-2 rounded transition-colors">
                        Opt-Out & Delete Data
                    </button>
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="w-full md:w-2/3 bg-white border rounded-lg shadow-sm flex flex-col overflow-hidden">
                <div className="bg-blue-50 border-b p-4 flex justify-between items-center">
                    <div>
                        <h1 className="text-xl font-bold text-blue-900">Pharmacy AI Support</h1>
                        <p className="text-sm text-blue-700">Powered by our local LLM model & Staff verified.</p>
                    </div>
                    <a href="/shop" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors text-sm flex items-center gap-2">
                        🛒 Shop Groceries
                    </a>
                </div>

                <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4 bg-slate-50/50">
                    {messages.length === 0 && (
                        <div className="text-center text-slate-400 mt-20">Start a conversation with our virtual assistant...</div>
                    )}
                    {messages.map((m, idx) => (
                        <div key={idx} className={`max-w-[80%] rounded-lg p-3 ${m.sender === 'Customer' ? 'bg-blue-600 text-white self-end rounded-br-none' :
                            m.sender === 'LLM' ? 'bg-slate-200 text-slate-900 self-start rounded-bl-none' :
                                'bg-emerald-100 border border-emerald-200 text-emerald-900 self-start rounded-bl-none shadow-sm'
                            }`}>
                            {m.sender === 'Pharmacist' && <div className="text-xs font-bold text-emerald-700 mb-1 flex items-center gap-1">⚕️ Pharmacist Connected</div>}
                            {m.sender === 'LLM' && <div className="text-xs font-bold text-slate-500 mb-1">🤖 Virtual Assistant</div>}
                            <div className="whitespace-pre-wrap text-sm">{m.content}</div>
                        </div>
                    ))}
                    <div ref={endOfMessagesRef} />
                </div>

                <div className="p-4 border-t bg-white">
                    <form onSubmit={handleSend} className="flex gap-2">
                        <input
                            type="text"
                            value={inputStr}
                            onChange={e => setInputStr(e.target.value)}
                            placeholder="Ask about medications, stock, or advice..."
                            className="flex-1 border rounded p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 rounded transition-colors">
                            Send
                        </button>
                    </form>
                </div>
            </div>

        </div>
    );
}
