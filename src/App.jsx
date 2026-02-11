import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import './App.css';

const ICONS = { 
  FO: { icon: "fa-solid fa-hotel", label: "Front Office" }, 
  HK: { icon: "fa-solid fa-broom", label: "Housekeeping" }, 
  MAINT: { icon: "fa-solid fa-wrench", label: "Maintenance" }, 
  REQ: { icon: "fa-solid fa-boxes-stacked", label: "Requests" } 
};

// Helper to get color class based on status
const getStatusColor = (status) => {
  switch(status) {
    case 'vacant': return 'bg-green-500';
    case 'occupied': return 'bg-blue-500';
    case 'dirty': return 'bg-red-500';
    case 'maintenance': return 'bg-gray-800';
    default: return 'bg-gray-300';
  }
};

// Helper to get status label
const getStatusLabel = (status) => {
  switch(status) {
    case 'vacant': return 'Ready';
    case 'occupied': return 'Occupied';
    case 'dirty': return 'Dirty';
    case 'maintenance': return 'Maintenance';
    default: return status;
  }
};

export default function App() {
  const [rooms, setRooms] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [requests, setRequests] = useState([]);
  const [view, setView] = useState('FO');
  const [selectedRoom, setSelectedRoom] = useState(null);

  // --- 1. REAL-TIME LISTENERS ---
  useEffect(() => {
    const unsubRooms = onSnapshot(collection(db, "rooms"), (snapshot) => {
      setRooms(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const qTickets = query(collection(db, "tickets"), orderBy("createdAt", "desc"));
    const unsubTickets = onSnapshot(qTickets, (snapshot) => {
      setTickets(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubRequests = onSnapshot(collection(db, "requests"), (snapshot) => {
      setRequests(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubRooms(); unsubTickets(); unsubRequests(); };
  }, []);

  // --- 2. BUSINESS LOGIC ---
  const updateRoomStatus = async (roomId, newStatus) => {
    await updateDoc(doc(db, "rooms", roomId), { status: newStatus });
    setSelectedRoom(null);
  };

  const reportIssue = async (roomId) => {
    const issue = prompt(`What is broken/missing in Room ${roomId}?`);
    if (!issue) return;
    await addDoc(collection(db, "tickets"), {
      roomId, issue, status: 'open', createdAt: serverTimestamp()
    });
    await updateRoomStatus(roomId, 'maintenance');
  };

  const resolveTicket = async (ticket) => {
    await updateDoc(doc(db, "tickets", ticket.id), { status: 'resolved' });
    await updateDoc(doc(db, "rooms", ticket.roomId), { status: 'dirty' });
  };

  const requestItem = async (e) => {
    e.preventDefault();
    const form = e.target;
    await addDoc(collection(db, "requests"), {
      item: form.item.value, qty: form.qty.value, dept: view, status: 'pending'
    });
    form.reset();
  };

  // Calculate stats
  const stats = {
    vacant: rooms.filter(r => r.status === 'vacant').length,
    occupied: rooms.filter(r => r.status === 'occupied').length,
    dirty: rooms.filter(r => r.status === 'dirty').length,
    maintenance: rooms.filter(r => r.status === 'maintenance').length
  };

  // --- 3. UI RENDER ---
  return (
    <div className="app-container">
      <header className="header">
        <div className="header-content">
          <h1><i className="fa-solid fa-hotel" style={{marginRight: '10px'}}></i>Aladdin Dream Hotel Management</h1>
          <div className="tabs">
            {Object.keys(ICONS).map(v => (
              <button key={v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>
                <i className={ICONS[v].icon} style={{marginRight: '6px'}}></i>{ICONS[v].label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* --- VIEW 1: FRONT OFFICE (BY FLOOR) --- */}
      {view === 'FO' && (
        <div className="dashboard">
           <div className="stats-bar">
             <span className="badge green">
               <i className="fa-solid fa-circle-check"></i>Vacant: {stats.vacant}
             </span>
             <span className="badge blue">
               <i className="fa-solid fa-user"></i>Occupied: {stats.occupied}
             </span>
             <span className="badge red">
               <i className="fa-solid fa-broom"></i>Dirty: {stats.dirty}
             </span>
             <span className="badge grey">
               <i className="fa-solid fa-wrench"></i>Maintenance: {stats.maintenance}
             </span>
           </div>

           {/* LOOP THROUGH FLOORS 1, 2, 3 */}
           {[1, 2, 3].map(floorNum => {
             const floorRooms = rooms.filter(r => r.floor === floorNum).sort((a,b) => a.id - b.id);
             if (floorRooms.length === 0) return null;
             
             return (
               <div key={floorNum} className="floor-section">
                 <h2 className="floor-title">
                   <i className="fa-solid fa-building"></i>Level {floorNum}
                   <span style={{fontSize: '0.9rem', fontWeight: 500, color: '#999', marginLeft: 'auto'}}>
                     {floorRooms.length} rooms
                   </span>
                 </h2>
                 <div className="room-grid">
                   {floorRooms.map(room => (
                      <div 
                        key={room.id}
                        className={`room-card ${getStatusColor(room.status)}`}
                        onClick={() => setSelectedRoom(room)}
                        title={`${room.type} - ${getStatusLabel(room.status)}`}
                      >
                        <div className="room-number">{room.id}</div>
                        <div className="room-type">{room.type}</div>
                      </div>
                   ))}
                 </div>
               </div>
             );
           })}
        </div>
      )}

      {/* --- VIEW 2: HOUSEKEEPING --- */}
      {view === 'HK' && (
        <div className="list-view">
          <h2><i className="fa-solid fa-broom"></i>Housekeeping Tasks</h2>
          <div className="list-view-content">
            {rooms.filter(r => r.status === 'dirty').length === 0 && (
              <div style={{textAlign: 'center', padding: '40px', color: '#999'}}>
                <i className="fa-solid fa-sparkles" style={{fontSize: '3rem', marginBottom: '10px', display: 'block'}}></i>
                <p>All rooms are clean!</p>
              </div>
            )}
            {rooms.filter(r => r.status === 'dirty').map(room => (
              <div key={room.id} className="task-card">
                <div>
                  <strong style={{fontSize: '1.1rem', color: '#2c2c2c'}}>Room {room.id}</strong>
                  <span style={{marginLeft: '8px', fontSize: '0.85rem', color: '#999'}}>({room.type})</span>
                </div>
                <div className="actions">
                  <button onClick={() => updateRoomStatus(room.id, 'vacant')} className="btn green">
                    <i className="fa-solid fa-check"></i> Mark Clean
                  </button>
                  <button onClick={() => reportIssue(room.id)} className="btn orange">
                    <i className="fa-solid fa-triangle-exclamation"></i> Issue
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- VIEW 3: MAINTENANCE --- */}
      {view === 'MAINT' && (
        <div className="list-view">
          <h2><i className="fa-solid fa-wrench"></i>Maintenance Queue</h2>
          <div className="list-view-content">
            {tickets.filter(t => t.status === 'open').length === 0 && (
              <div style={{textAlign: 'center', padding: '40px', color: '#999'}}>
                <i className="fa-solid fa-circle-check" style={{fontSize: '3rem', marginBottom: '10px', display: 'block'}}></i>
                <p>No open tickets!</p>
              </div>
            )}
            {tickets.filter(t => t.status === 'open').map(ticket => (
              <div key={ticket.id} className="ticket-card open">
                <div>
                  <strong style={{fontSize: '1.1rem', color: '#2c2c2c'}}>Room {ticket.roomId}</strong>
                  <div style={{marginTop: '5px', color: '#666'}}>{ticket.issue}</div>
                </div>
                <button onClick={() => resolveTicket(ticket)} className="btn blue">
                  <i className="fa-solid fa-check"></i> Fixed
                </button>
              </div>
            ))}
            
            {tickets.filter(t => t.status === 'resolved').length > 0 && (
              <>
                <h3><i className="fa-solid fa-clock-rotate-left"></i> Recent History</h3>
                {tickets.filter(t => t.status === 'resolved').slice(0, 5).map(t => (
                  <div key={t.id} className="text-gray-400 text-sm strike" style={{padding: '8px 0'}}>
                    <s>Room {t.roomId}: {t.issue}</s>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* --- VIEW 4: REQUESTS --- */}
      {view === 'REQ' && (
        <div className="list-view">
          <h2><i className="fa-solid fa-boxes-stacked"></i>Inventory Requests</h2>
          <div className="list-view-content">
            <form onSubmit={requestItem}>
              <input 
                name="item" 
                placeholder="Item (e.g. Towels)" 
                required 
                style={{flex: 1}}
              />
              <input 
                name="qty" 
                placeholder="Qty" 
                type="number" 
                required 
                className="w-16"
              />
              <button type="submit" className="btn blue">
                <i className="fa-solid fa-plus"></i> Request
              </button>
            </form>
            
            {requests.filter(r => r.status === 'pending').length === 0 && (
              <div style={{textAlign: 'center', padding: '40px', color: '#999'}}>
                <i className="fa-solid fa-clipboard-list" style={{fontSize: '3rem', marginBottom: '10px', display: 'block'}}></i>
                <p>No pending requests</p>
              </div>
            )}
            
            {requests.filter(r => r.status === 'pending').length > 0 && (
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Dept</th>
                    <th style={{textAlign: 'center'}}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.filter(r => r.status === 'pending').map(req => (
                    <tr key={req.id}>
                      <td>{req.item}</td>
                      <td>{req.qty}</td>
                      <td>
                        <span style={{
                          background: '#ddbd88',
                          color: 'white',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '0.8rem',
                          fontWeight: 700
                        }}>
                          {req.dept}
                        </span>
                      </td>
                      <td style={{textAlign: 'center'}}>
                        <button 
                          onClick={() => updateDoc(doc(db, "requests", req.id), {status: 'done'})}
                          title="Mark as completed"
                        >
                          <i className="fa-solid fa-circle-check" style={{color: '#10b981', fontSize: '1.4rem'}}></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* --- MODAL --- */}
      {selectedRoom && (
        <div className="modal-overlay" onClick={() => setSelectedRoom(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Room {selectedRoom.id}</h2>
            <p>
              <span style={{color: '#999'}}>Type:</span> <strong>{selectedRoom.type}</strong>
              <br/>
              <span style={{color: '#999'}}>Status:</span> <strong>{getStatusLabel(selectedRoom.status).toUpperCase()}</strong>
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button 
                className="btn blue py-3" 
                onClick={() => updateRoomStatus(selectedRoom.id, 'occupied')}
                disabled={selectedRoom.status === 'occupied'}
              >
                <i className="fa-solid fa-user"></i> Check-In
              </button>
              <button 
                className="btn red py-3" 
                onClick={() => updateRoomStatus(selectedRoom.id, 'dirty')}
                disabled={selectedRoom.status === 'dirty'}
              >
                <i className="fa-solid fa-door-open"></i> Check-Out
              </button>
              <button 
                className="btn green py-3" 
                onClick={() => updateRoomStatus(selectedRoom.id, 'vacant')}
                disabled={selectedRoom.status === 'vacant'}
              >
                <i className="fa-solid fa-check"></i> Mark Ready
              </button>
              <button 
                className="btn grey py-3" 
                onClick={() => reportIssue(selectedRoom.id)}
              >
                <i className="fa-solid fa-wrench"></i> Report Issue
              </button>
            </div>
            <button className="mt-4 text-gray-500 underline" onClick={() => setSelectedRoom(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
