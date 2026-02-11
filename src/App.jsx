import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc, serverTimestamp, query, orderBy, where, getDocs } from 'firebase/firestore';
import './App.css';

// ICONS CONFIGURATION
const ICONS = { 
  FO: { icon: "fa-solid fa-hotel", label: "Front Office" }, 
  HK: { icon: "fa-solid fa-broom", label: "Housekeeping" }, 
  MAINT: { icon: "fa-solid fa-wrench", label: "Maintenance" }, 
  REQ: { icon: "fa-solid fa-paper-plane", label: "Requests" } 
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

// DATE FORMATTER (Malaysia Time)
const formatTime = (timestamp) => {
  if (!timestamp) return '';
  // Firestore timestamp to JS Date
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleString('en-MY', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
  });
};

export default function App() {
  // --- STATE ---
  const [currentUser, setCurrentUser] = useState(null);
  const [view, setView] = useState('FO');
  
  // Data State
  const [rooms, setRooms] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [requests, setRequests] = useState([]);
  const [users, setUsers] = useState([]); // List of staff

  // UI State
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  
  // Request UI State
  const [reqReceiver, setReqReceiver] = useState('');
  const [reqContent, setReqContent] = useState('');
  const [rejectModal, setRejectModal] = useState({ show: false, reqId: null });
  const [rejectReason, setRejectReason] = useState('');

  // Login Inputs
  const [loginId, setLoginId] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');

  // --- 1. PERSIST LOGIN ---
  useEffect(() => {
    const storedUser = localStorage.getItem('hotelUser');
    if (storedUser) {
      const userObj = JSON.parse(storedUser);
      setCurrentUser(userObj);
      setView(userObj.role === 'admin' ? 'ADMIN' : 'FO');
    }
  }, []);

  // --- 2. LISTENERS ---
  useEffect(() => {
    const unsubRooms = onSnapshot(collection(db, "rooms"), (snap) => {
      setRooms(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubRooms();
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    // Listen to Tickets
    const qTickets = query(collection(db, "tickets"), orderBy("createdAt", "desc"));
    const unsubTickets = onSnapshot(qTickets, (snap) => {
      setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Listen to Requests (Order by newest)
    const qRequests = query(collection(db, "requests"), orderBy("createdAt", "desc"));
    const unsubRequests = onSnapshot(qRequests, (snap) => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Listen to Users (needed for Request Dropdown)
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubTickets(); unsubRequests(); unsubUsers(); };
  }, [currentUser]);

  // --- 3. AUTH LOGIC ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    
    const q = query(collection(db, "users"), where("userid", "==", loginId));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      setLoginError('User ID not found');
      return;
    }

    const userData = querySnapshot.docs[0].data();
    const docId = querySnapshot.docs[0].id;

    if (userData.password === loginPass) {
      const userObj = { dbId: docId, ...userData };
      setCurrentUser(userObj);
      localStorage.setItem('hotelUser', JSON.stringify(userObj));
      setView(userData.role === 'admin' ? 'ADMIN' : 'FO');
    } else {
      setLoginError('Incorrect Password');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('hotelUser');
    setCurrentUser(null);
    setLoginId('');
    setLoginPass('');
    setView('FO');
  };

  const initAdmin = async () => {
    await addDoc(collection(db, "users"), {
      userid: "admin", name: "System Admin", password: "1234", role: "admin"
    });
    alert("Admin created! ID: admin, Pass: 1234");
  };

  // --- 4. REQUESTS LOGIC (NEW) ---
  
  const handleSendRequest = async (e) => {
    e.preventDefault();
    if (!reqReceiver || !reqContent) {
      alert("Please select a receiver and enter details.");
      return;
    }

    // Find receiver name for display
    const receiverUser = users.find(u => u.dbId === reqReceiver);
    const receiverName = receiverUser ? receiverUser.name : "Unknown";

    await addDoc(collection(db, "requests"), {
      senderId: currentUser.dbId,
      senderName: currentUser.name,
      receiverId: reqReceiver,
      receiverName: receiverName,
      content: reqContent,
      status: 'pending',
      createdAt: serverTimestamp()
    });

    setReqContent('');
    setReqReceiver('');
    alert("Request Sent!");
  };

  const handleAcceptRequest = async (reqId) => {
    if(!confirm("Accept this request?")) return;
    await updateDoc(doc(db, "requests", reqId), {
      status: 'accepted',
      acceptedAt: serverTimestamp()
    });
  };

  const handleCompleteRequest = async (reqId) => {
    if(!confirm("Mark this request as complete?")) return;
    await updateDoc(doc(db, "requests", reqId), {
      status: 'completed',
      completedAt: serverTimestamp()
    });
  };

  const openRejectModal = (reqId) => {
    setRejectModal({ show: true, reqId });
    setRejectReason('');
  };

  const submitReject = async () => {
    if(!rejectReason) return alert("Please enter a reason.");
    
    await updateDoc(doc(db, "requests", rejectModal.reqId), {
      status: 'rejected',
      rejectionReason: rejectReason,
      completedAt: serverTimestamp() // Using completedAt to mark end of lifecycle
    });

    setRejectModal({ show: false, reqId: null });
  };

  // --- 5. GENERIC LOGIC ---
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
    await updateDoc(doc(db, "rooms", ticket.roomId), { status: 'dirty' });
  };

  // Stats
  const stats = {
    vacant: rooms.filter(r => r.status === 'vacant').length,
    occupied: rooms.filter(r => r.status === 'occupied').length,
    dirty: rooms.filter(r => r.status === 'dirty').length,
    maintenance: rooms.filter(r => r.status === 'maintenance').length
  };

  // --- RENDER ---
  if (!currentUser) {
    return (
      <div className="app-container">
        <div className="login-container">
          <form className="login-card" onSubmit={handleLogin}>
            <h1><i className="fa-solid fa-hotel"></i> Aladdin Dream Hotel</h1>
            <h3 style={{color:'#666', marginBottom:'20px'}}>Staff Login</h3>
            <input placeholder="User ID" value={loginId} onChange={e => setLoginId(e.target.value)} required />
            <input type="password" placeholder="Password" value={loginPass} onChange={e => setLoginPass(e.target.value)} required />
            {loginError && <p style={{color:'red'}}>{loginError}</p>}
            <button type="submit" className="btn blue" style={{justifyContent:'center', width:'100%'}}>Login</button>
            <button type="button" onClick={initAdmin} style={{marginTop:'20px', background:'none', border:'none', fontSize:'0.7rem', color:'#ccc', cursor:'pointer'}}>(Init Admin)</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-content">
          <h1>
             Aladdin Dream Hotel
             <div className="user-profile" title={`Logged in as ${currentUser.name}`}>
               <i className="fa-solid fa-circle-user" style={{color: '#ddbd88'}}></i>
               <span style={{fontSize: '0.9rem', fontWeight: 'normal', color:'#333'}}>{currentUser.name}</span>
             </div>
          </h1>
          <div className="tabs">
            {Object.keys(ICONS).map(v => (
              <button key={v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>
                <i className={ICONS[v].icon}></i> {ICONS[v].label}
              </button>
            ))}
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
                      <div key={room.id} className={`room-card ${getStatusColor(room.status)}`} onClick={() => setSelectedRoom(room)}>
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
          {rooms.filter(r => r.status === 'dirty').length === 0 ? <p style={{textAlign:'center', color:'#999'}}>All rooms clean!</p> :
            rooms.filter(r => r.status === 'dirty').map(room => (
              <div key={room.id} className="task-card">
                <div><strong>Room {room.id}</strong> ({room.type})</div>
                <div className="actions">
                  <button onClick={() => updateRoomStatus(room.id, 'vacant')} className="btn green"><i className="fa-solid fa-check"></i> Clean</button>
                  <button onClick={() => reportIssue(room.id)} className="btn orange"><i className="fa-solid fa-triangle-exclamation"></i> Issue</button>
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* VIEW: MAINTENANCE */}
      {view === 'MAINT' && (
        <div className="list-view">
          <h2><i className="fa-solid fa-wrench"></i> Active Tickets</h2>
          {tickets.filter(t => t.status === 'open').length === 0 ? <p style={{textAlign:'center', color:'#999'}}>No issues.</p> :
            tickets.filter(t => t.status === 'open').map(ticket => (
              <div key={ticket.id} className="ticket-card open">
                <div><strong>Room {ticket.roomId}</strong><br/><small>{ticket.issue}</small></div>
                <button onClick={() => resolveTicket(ticket)} className="btn blue">Fixed</button>
              </div>
            ))
          }
        </div>
      )}

      {/* VIEW: REQUESTS (UPDATED) */}
      {view === 'REQ' && (
        <div className="list-view">
          
          {/* SECTION 1: CREATE REQUEST */}
          <div className="floor-section" style={{marginBottom:'20px'}}>
            <h2 className="floor-title"><i className="fa-solid fa-plus-circle"></i> New Request</h2>
            <form onSubmit={handleSendRequest} style={{display:'flex', flexDirection:'column', gap:'10px'}}>
              <select 
                value={reqReceiver} 
                onChange={e => setReqReceiver(e.target.value)} 
                required
                style={{padding:'10px', borderRadius:'8px', border:'2px solid #eee'}}
              >
                <option value="">-- Select Recipient --</option>
                {users
                  .filter(u => u.dbId !== currentUser.dbId) // Don't show self
                  .map(u => (
                    <option key={u.dbId} value={u.dbId}>{u.name} ({u.role})</option>
                ))}
              </select>
              
              <textarea 
                placeholder="What do you need?" 
                value={reqContent}
                onChange={e => setReqContent(e.target.value)}
                required
                rows="3"
                style={{padding:'10px', borderRadius:'8px', border:'2px solid #eee', fontFamily:'inherit'}}
              />
              
              <button type="submit" className="btn blue" style={{justifyContent:'center'}}>
                <i className="fa-solid fa-paper-plane"></i> Send Request
              </button>
            </form>
          </div>

          {/* SECTION 2: INCOMING REQUESTS */}
          <h2 className="floor-title"><i className="fa-solid fa-inbox"></i> Inbox</h2>
          {requests.filter(r => r.receiverId === currentUser.dbId).length === 0 && <p style={{color:'#999', textAlign:'center', marginBottom:'30px'}}>No incoming requests.</p>}
          
          {requests.filter(r => r.receiverId === currentUser.dbId).map(req => (
            <div key={req.id} className="req-card">
              <div className="req-header">
                <span className={`req-status status-${req.status}`}>{req.status}</span>
                <span style={{fontSize:'0.8rem', color:'#666'}}>From: <b>{req.senderName}</b></span>
              </div>
              
              <p style={{margin:'10px 0', fontSize:'1rem', color:'#333'}}>{req.content}</p>

              {/* ACTION BUTTONS BASED ON STATUS */}
              {req.status === 'pending' && (
                <div style={{display:'flex', gap:'10px', marginTop:'10px'}}>
                  <button onClick={() => handleAcceptRequest(req.id)} className="btn green" style={{flex:1, justifyContent:'center'}}>
                    <i className="fa-solid fa-check"></i> Accept
                  </button>
                  <button onClick={() => openRejectModal(req.id)} className="btn red" style={{flex:1, justifyContent:'center'}}>
                    <i className="fa-solid fa-times"></i> Reject
                  </button>
                </div>
              )}

              {req.status === 'accepted' && (
                <button onClick={() => handleCompleteRequest(req.id)} className="btn blue" style={{width:'100%', justifyContent:'center', marginTop:'10px'}}>
                  <i className="fa-solid fa-check-double"></i> Mark Complete
                </button>
              )}

              {req.status === 'rejected' && (
                <div className="rejection-box">
                  <strong>Reason:</strong> {req.rejectionReason}
                </div>
              )}

              {/* TIMESTAMPS */}
              <div className="req-time-info">
                <span><i className="fa-solid fa-clock"></i> Sent: {formatTime(req.createdAt)}</span>
                {req.acceptedAt && <span><i className="fa-solid fa-check"></i> Accepted: {formatTime(req.acceptedAt)}</span>}
                {req.completedAt && <span><i className="fa-solid fa-check-double"></i> Completed: {formatTime(req.completedAt)}</span>}
              </div>
            </div>
          ))}

          {/* SECTION 3: SENT REQUESTS */}
          <h2 className="floor-title" style={{marginTop:'30px'}}><i className="fa-solid fa-paper-plane"></i> Sent History</h2>
          {requests.filter(r => r.senderId === currentUser.dbId).map(req => (
             <div key={req.id} className="req-card" style={{opacity: 0.9}}>
                <div className="req-header">
                  <span className={`req-status status-${req.status}`}>{req.status}</span>
                  <span style={{fontSize:'0.8rem', color:'#666'}}>To: <b>{req.receiverName}</b></span>
                </div>
                <p style={{margin:'5px 0', color:'#555'}}>{req.content}</p>
                
                {req.status === 'rejected' && (
                  <div className="rejection-box">Reason: {req.rejectionReason}</div>
                )}
                
                <div className="req-time-info">
                  <span>Sent: {formatTime(req.createdAt)}</span>
                </div>
             </div>
          ))}

        </div>
      )}

      {/* VIEW: ADMIN PANEL */}
      {view === 'ADMIN' && (
        <div className="dashboard">
          <div className="floor-section">
            <h2 className="floor-title"><i className="fa-solid fa-users-gear"></i> Manage Staff</h2>
            <form onSubmit={handleCreateUser} style={{display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'20px'}}>
              <input name="userid" placeholder="User ID" required />
              <input name="name" placeholder="Full Name" required />
              <input name="password" placeholder="Password" required />
              <select name="role" style={{padding:'10px', borderRadius:'8px', border:'2px solid #eee'}}>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
              <button className="btn green">Create</button>
            </form>
            <table>
              <thead><tr><th>ID</th><th>Name</th><th>Role</th><th>Action</th></tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>{u.userid}</td><td>{u.name}</td><td>{u.role}</td>
                    <td>{u.userid !== 'admin' && <button onClick={() => deleteDoc(doc(db, "users", u.id))} style={{color:'red', border:'none', background:'none', cursor:'pointer'}}><i className="fa-solid fa-trash"></i></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Admin Stats & Logs would go here */}
        </div>
      )}

      {/* MODAL: REJECT REASON */}
      {rejectModal.show && (
        <div className="modal-overlay" onClick={() => setRejectModal({show:false, reqId:null})}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 style={{color:'#dc3545'}}>Reject Request</h2>
            <p>Please provide a reason for rejecting this request.</p>
            <textarea 
              className="reject-input" 
              placeholder="Reason..." 
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              autoFocus
            />
            <div className="modal-actions">
              <button className="btn grey" onClick={() => setRejectModal({show:false, reqId:null})} style={{flex:1, justifyContent:'center'}}>Cancel</button>
              <button className="btn red" onClick={submitReject} style={{flex:1, justifyContent:'center'}}>Reject</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ROOM DETAILS */}
      {selectedRoom && (
        <div className="modal-overlay" onClick={() => setSelectedRoom(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 style={{color:'#333'}}>Room {selectedRoom.id}</h2>
            <p style={{color:'#666'}}>Current: <strong>{getStatusLabel(selectedRoom.status).toUpperCase()}</strong></p>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}>
              <button className="btn red" onClick={() => updateRoomStatus(selectedRoom.id, 'dirty')} style={{justifyContent:'center', padding:'15px', color:'white'}}>Needs Cleaning</button>
              <button className="btn green" onClick={() => updateRoomStatus(selectedRoom.id, 'vacant')} style={{justifyContent:'center', padding:'15px', color:'white'}}>Mark Ready</button>
              <button className="btn grey" onClick={() => reportIssue(selectedRoom.id)} style={{gridColumn:'span 2', justifyContent:'center', padding:'15px', color:'white'}}>Report Issue</button>
            </div>
            <button style={{marginTop:'15px', background:'none', border:'none', textDecoration:'underline', cursor:'pointer', color:'#666'}} onClick={() => setSelectedRoom(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
