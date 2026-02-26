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

    const [bookTime, setBookTime] = useState('');
    const [bookNote, setBookNote] = useState('');

    const handleBooking = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch('http://localhost:4000/api/appointments/book', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customer_id: customerId,
                    scheduled_time: bookTime,
                    symptoms_note: bookNote
                })
            });
            if (res.ok) {
                alert("Appointment booked successfully!");
                setBookTime('');
                setBookNote('');
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
                    <h2 className="text-xl font-bold mb-4">Book Consultation</h2>
                    <form onSubmit={handleBooking} className="flex flex-col gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Date & Time</label>
                            <input
                                type="datetime-local"
                                required
                                value={bookTime}
                                onChange={e => setBookTime(e.target.value)}
                                className="w-full border rounded p-2"
                            />
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
                        <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded transition-colors">
                            Schedule Now
                        </button>
                    </form>
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
