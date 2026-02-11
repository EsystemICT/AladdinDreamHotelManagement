import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc, serverTimestamp, query, orderBy, where, getDocs } from 'firebase/firestore';
import './App.css';

// ICONS CONFIGURATION
const ICONS = { 
  FO: { icon: "fa-solid fa-hotel", label: "Front Office" }, 
  HK: { icon: "fa-solid fa-broom", label: "Housekeeping" }, 
  MAINT: { icon: "fa-solid fa-wrench", label: "Maintenance" }, 
  REQ: { icon: "fa-solid fa-boxes-stacked", label: "Requests" } 
};

// HELPERS
const getStatusColor = (status) => {
  switch(status) {
    case 'vacant': return 'bg-green-500';
    case 'occupied': return 'bg-blue-500';
    case 'dirty': return 'bg-red-500';
    case 'maintenance': return 'bg-gray-800';
    default: return 'bg-gray-300';
  }
};

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
  // --- STATE ---
  const [currentUser, setCurrentUser] = useState(null); // Auth State
  const [view, setView] = useState('FO');
  
  // Data State
  const [rooms, setRooms] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [requests, setRequests] = useState([]);
  const [users, setUsers] = useState([]); // List of staff (for admin)

  // UI State
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  
  // Login Inputs
  const [loginId, setLoginId] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');

  // --- 1. REAL-TIME LISTENERS ---
  useEffect(() => {
    // Always listen to rooms
    const unsubRooms = onSnapshot(collection(db, "rooms"), (snap) => {
      setRooms(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubRooms();
  }, []);

  // Listen to other collections ONLY when logged in to save bandwidth/security
  useEffect(() => {
    if (!currentUser) return;

    const qTickets = query(collection(db, "tickets"), orderBy("createdAt", "desc"));
    const unsubTickets = onSnapshot(qTickets, (snap) => {
      setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubRequests = onSnapshot(collection(db, "requests"), (snap) => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Only Admin needs to see user list
    let unsubUsers = () => {};
    if (currentUser.role === 'admin') {
      unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
        setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
    }

    return () => { unsubTickets(); unsubRequests(); unsubUsers(); };
  }, [currentUser]);

  // --- 2. AUTHENTICATION LOGIC ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    
    // Simple query to find user by ID
    // NOTE: In a real app, use Firebase Auth. This is a simple Firestore simulation per request.
    const q = query(collection(db, "users"), where("userid", "==", loginId));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      setLoginError('User ID not found');
      return;
    }

    const userData = querySnapshot.docs[0].data();
    const docId = querySnapshot.docs[0].id;

    if (userData.password === loginPass) {
      setCurrentUser({ dbId: docId, ...userData });
      setView(userData.role === 'admin' ? 'ADMIN' : 'FO');
    } else {
      setLoginError('Incorrect Password');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    const newPass = e.target.newPass.value;
    await updateDoc(doc(db, "users", currentUser.dbId), { password: newPass });
    setShowPasswordModal(false);
    alert("Password updated!");
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    const f = e.target;
    await addDoc(collection(db, "users"), {
      userid: f.userid.value,
      name: f.name.value,
      password: f.password.value,
      role: f.role.value
    });
    f.reset();
    alert("User Created!");
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setLoginId('');
    setLoginPass('');
    setView('FO');
  };

  // Temporary function to create first admin if DB is empty
  const initAdmin = async () => {
    await addDoc(collection(db, "users"), {
      userid: "admin", name: "System Admin", password: "1234", role: "admin"
    });
    alert("Admin created! ID: admin, Pass: 1234");
  };

  // --- 3. BUSINESS LOGIC ---
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
    await updateDoc(doc(db, "tickets", ticket.id), { status: 'resolved', resolvedAt: serverTimestamp() });
    // Note: We don't auto-clean room, HK must do it. But we can mark it dirty.
    await updateDoc(doc(db, "rooms", ticket.roomId), { status: 'dirty' });
  };

  const requestItem = async (e) => {
    e.preventDefault();
    const form = e.target;
    await addDoc(collection(db, "requests"), {
      item: form.item.value, qty: form.qty.value, dept: currentUser.name, status: 'pending', createdAt: serverTimestamp()
    });
    form.reset();
  };

  // Stats Calculation
  const stats = {
    vacant: rooms.filter(r => r.status === 'vacant').length,
    occupied: rooms.filter(r => r.status === 'occupied').length,
    dirty: rooms.filter(r => r.status === 'dirty').length,
    maintenance: rooms.filter(r => r.status === 'maintenance').length
  };

  // --- 4. RENDER: LOGIN SCREEN ---
  if (!currentUser) {
    return (
      <div className="app-container">
        <div className="login-container">
          <form className="login-card" onSubmit={handleLogin}>
            <h1><i className="fa-solid fa-hotel"></i> Aladdin Hotel</h1>
            <h3 style={{color:'#666', marginBottom:'20px'}}>Staff Login</h3>
            
            <input 
              placeholder="User ID" 
              value={loginId} 
              onChange={e => setLoginId(e.target.value)} 
              required 
            />
            <input 
              type="password" 
              placeholder="Password" 
              value={loginPass} 
              onChange={e => setLoginPass(e.target.value)} 
              required 
            />
            
            {loginError && <p style={{color:'red'}}>{loginError}</p>}
            
            <button type="submit" className="btn blue" style={{justifyContent:'center'}}>Login</button>
            
            {/* Secret button to seed DB if empty */}
            <button type="button" onClick={initAdmin} style={{marginTop:'20px', background:'none', border:'none', fontSize:'0.7rem', color:'#eee', cursor:'pointer'}}>
              (Init Admin)
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- 5. RENDER: MAIN APP ---
  return (
    <div className="app-container">
      <header className="header">
        <div className="header-content">
          <h1>
             Aladdin Dream Hotel
             <div className="user-profile" onClick={() => setShowPasswordModal(true)} title="Change Password">
               <i className="fa-solid fa-circle-user" style={{color: '#ddbd88'}}></i>
               <span style={{fontSize: '0.9rem', fontWeight: 'normal'}}>{currentUser.name}</span>
             </div>
          </h1>
          
          <div className="tabs">
            {Object.keys(ICONS).map(v => (
              <button key={v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>
                <i className={ICONS[v].icon}></i> {ICONS[v].label}
              </button>
            ))}
            {/* Admin Tab */}
            {currentUser.role === 'admin' && (
              <button className={view === 'ADMIN' ? 'active' : ''} onClick={() => setView('ADMIN')}>
                <i className="fa-solid fa-lock"></i> Admin
              </button>
            )}
            <button onClick={handleLogout} style={{marginLeft:'10px', color: '#ef4444'}}>
              <i className="fa-solid fa-right-from-bracket"></i>
            </button>
          </div>
        </div>
      </header>

      {/* VIEW: FRONT OFFICE */}
      {view === 'FO' && (
        <div className="dashboard">
           <div className="stats-bar">
             <span className="badge green"><i className="fa-solid fa-check"></i>Ready: {stats.vacant}</span>
             <span className="badge blue"><i className="fa-solid fa-user"></i>Occ: {stats.occupied}</span>
             <span className="badge red"><i className="fa-solid fa-broom"></i>Dirty: {stats.dirty}</span>
             <span className="badge grey"><i className="fa-solid fa-wrench"></i>Maint: {stats.maintenance}</span>
           </div>

           {[1, 2, 3].map(floorNum => {
             const floorRooms = rooms.filter(r => r.floor === floorNum).sort((a,b) => a.id - b.id);
             if (floorRooms.length === 0) return null;
             return (
               <div key={floorNum} className="floor-section">
                 <h2 className="floor-title">Level {floorNum}</h2>
                 <div className="room-grid">
                   {floorRooms.map(room => (
                      <div 
                        key={room.id}
                        className={`room-card ${getStatusColor(room.status)}`}
                        onClick={() => setSelectedRoom(room)}
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

      {/* VIEW: HOUSEKEEPING */}
      {view === 'HK' && (
        <div className="list-view">
          <h2><i className="fa-solid fa-broom"></i> Housekeeping Tasks</h2>
          {rooms.filter(r => r.status === 'dirty').length === 0 ? (
            <p style={{textAlign:'center', color:'#999'}}>All rooms clean!</p>
          ) : (
            rooms.filter(r => r.status === 'dirty').map(room => (
              <div key={room.id} className="task-card">
                <div><strong>Room {room.id}</strong> ({room.type})</div>
                <div className="actions">
                  <button onClick={() => updateRoomStatus(room.id, 'vacant')} className="btn green">
                    <i className="fa-solid fa-check"></i> Clean
                  </button>
                  <button onClick={() => reportIssue(room.id)} className="btn orange">
                    <i className="fa-solid fa-triangle-exclamation"></i> Issue
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* VIEW: MAINTENANCE (Active Tickets Only) */}
      {view === 'MAINT' && (
        <div className="list-view">
          <h2><i className="fa-solid fa-wrench"></i> Active Tickets</h2>
          {tickets.filter(t => t.status === 'open').length === 0 ? <p style={{textAlign:'center', color:'#999'}}>No issues.</p> :
            tickets.filter(t => t.status === 'open').map(ticket => (
              <div key={ticket.id} className="ticket-card open">
                <div>
                  <strong>Room {ticket.roomId}</strong><br/>
                  <small>{ticket.issue}</small>
                </div>
                <button onClick={() => resolveTicket(ticket)} className="btn blue">Fixed</button>
              </div>
            ))
          }
        </div>
      )}

      {/* VIEW: REQUESTS */}
      {view === 'REQ' && (
        <div className="list-view">
          <h2><i className="fa-solid fa-boxes-stacked"></i> Inventory Requests</h2>
          <form onSubmit={requestItem}>
            <input name="item" placeholder="Item" required style={{flex:1}} />
            <input name="qty" placeholder="Qty" type="number" required className="w-16" />
            <button type="submit" className="btn blue">Add</button>
          </form>
          
          <table>
            <thead><tr><th>Item</th><th>Qty</th><th>By</th><th>Action</th></tr></thead>
            <tbody>
              {requests.filter(r => r.status === 'pending').map(req => (
                <tr key={req.id}>
                  <td>{req.item}</td>
                  <td>{req.qty}</td>
                  <td>{req.dept}</td>
                  <td><button onClick={() => updateDoc(doc(db, "requests", req.id), {status: 'done'})} style={{background:'none', border:'none', cursor:'pointer'}}>✅</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* VIEW: ADMIN PANEL */}
      {view === 'ADMIN' && (
        <div className="dashboard">
          
          {/* 1. Staff Management */}
          <div className="floor-section">
            <h2 className="floor-title"><i className="fa-solid fa-users-gear"></i> Manage Staff</h2>
            <form onSubmit={handleCreateUser} style={{display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'20px'}}>
              <input name="userid" placeholder="User ID" required />
              <input name="name" placeholder="Full Name" required />
              <input name="password" placeholder="Password" required />
              <select name="role">
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
              <button className="btn green">Create User</button>
            </form>

            <table style={{fontSize:'0.85rem'}}>
              <thead><tr><th>ID</th><th>Name</th><th>Role</th><th>Pass</th><th>Action</th></tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>{u.userid}</td>
                    <td>{u.name}</td>
                    <td>{u.role}</td>
                    <td>****</td>
                    <td>
                      {u.userid !== 'admin' && (
                        <button onClick={() => deleteDoc(doc(db, "users", u.id))} style={{color:'red', border:'none', background:'none', cursor:'pointer'}}>
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 2. Full History */}
          <div className="grid grid-cols-2 gap-2" style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px'}}>
            <div className="list-view" style={{margin:0}}>
              <h3>Maintenance History</h3>
              <div style={{maxHeight:'300px', overflowY:'auto'}}>
                {tickets.filter(t => t.status === 'resolved').map(t => (
                  <div key={t.id} style={{borderBottom:'1px solid #eee', padding:'8px'}}>
                    <s>Room {t.roomId}: {t.issue}</s>
                  </div>
                ))}
              </div>
            </div>

            <div className="list-view" style={{margin:0}}>
              <h3>Request History</h3>
              <div style={{maxHeight:'300px', overflowY:'auto'}}>
                {requests.filter(r => r.status === 'done').map(r => (
                  <div key={r.id} style={{borderBottom:'1px solid #eee', padding:'8px'}}>
                    <s>{r.qty}x {r.item} ({r.dept})</s>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: CHANGE PASSWORD --- */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Change Password</h2>
            <p>Enter a new password for <strong>{currentUser.userid}</strong></p>
            <form onSubmit={handleChangePassword} style={{flexDirection:'column'}}>
              <input name="newPass" placeholder="New Password" required />
              <button className="btn blue" style={{width:'100%', justifyContent:'center'}}>Update</button>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: ROOM DETAILS (UPDATED WORKFLOW) --- */}
      {selectedRoom && (
        <div className="modal-overlay" onClick={() => setSelectedRoom(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Room {selectedRoom.id}</h2>
            <p>Current: <strong>{getStatusLabel(selectedRoom.status).toUpperCase()}</strong></p>
            
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}>
              {/* Reception Workflow */}
              <button 
                className="btn red" 
                onClick={() => updateRoomStatus(selectedRoom.id, 'dirty')}
                style={{justifyContent:'center', padding:'15px'}}
              >
                Needs Cleaning
              </button>

              {/* HK Workflow */}
              <button 
                className="btn green" 
                onClick={() => updateRoomStatus(selectedRoom.id, 'vacant')}
                style={{justifyContent:'center', padding:'15px'}}
              >
                Mark Ready
              </button>
              
              {/* Maintenance */}
              <button 
                className="btn grey" 
                onClick={() => reportIssue(selectedRoom.id)}
                style={{gridColumn:'span 2', justifyContent:'center', padding:'15px'}}
              >
                Report Issue
              </button>
            </div>
            
            <button style={{marginTop:'15px', background:'none', border:'none', textDecoration:'underline', cursor:'pointer'}} onClick={() => setSelectedRoom(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
