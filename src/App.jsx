import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc, serverTimestamp, query, orderBy, where, getDocs } from 'firebase/firestore';
import './App.css';

// ICONS - Removed HK
const ICONS = { 
  FO: { icon: "fa-solid fa-hotel", label: "Front Office" }, 
  // HK Removed
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

const formatTime = (timestamp) => {
  if (!timestamp) return '-';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleString('en-MY', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
  });
};

export default function App() {
  // STATE
  const [currentUser, setCurrentUser] = useState(null);
  const [view, setView] = useState('FO');
  
  // Data
  const [rooms, setRooms] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [requests, setRequests] = useState([]);
  const [users, setUsers] = useState([]); 

  // UI
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  
  // Requests
  const [reqReceiver, setReqReceiver] = useState('');
  const [reqContent, setReqContent] = useState('');
  const [rejectModal, setRejectModal] = useState({ show: false, reqId: null });
  const [rejectReason, setRejectReason] = useState('');

  // Login
  const [loginId, setLoginId] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');

  // --- 1. LOGIN PERSISTENCE ---
  useEffect(() => {
    const storedUser = localStorage.getItem('hotelUser');
    if (storedUser) {
      const userObj = JSON.parse(storedUser);
      setCurrentUser(userObj);
      setView(userObj.role === 'admin' ? 'ADMIN' : 'FO');
    }
  }, []);

  // --- 2. DATA LISTENERS ---
  useEffect(() => {
    const unsubRooms = onSnapshot(collection(db, "rooms"), (snap) => {
      setRooms(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubRooms();
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const qTickets = query(collection(db, "tickets"), orderBy("createdAt", "desc"));
    const unsubTickets = onSnapshot(qTickets, (snap) => {
      setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const qRequests = query(collection(db, "requests"), orderBy("createdAt", "desc"));
    const unsubRequests = onSnapshot(qRequests, (snap) => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      setUsers(snap.docs.map(d => ({ dbId: d.id, ...d.data() })));
    });

    return () => { unsubTickets(); unsubRequests(); unsubUsers(); };
  }, [currentUser]);

  // --- 3. AUTH FUNCTIONS ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    const q = query(collection(db, "users"), where("userid", "==", loginId));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) { setLoginError('User ID not found'); return; }

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

  const handleChangePassword = async (e) => {
    e.preventDefault();
    const newPass = e.target.newPass.value;
    if(newPass.length < 4) return alert("Password too short");
    await updateDoc(doc(db, "users", currentUser.dbId), { password: newPass });
    setShowPasswordModal(false);
    alert("Password updated!");
  };

  // --- 4. REQUESTS SYSTEM ---
  const handleSendRequest = async (e) => {
    e.preventDefault();
    if (!reqReceiver || !reqContent) { alert("Please select a receiver and enter details."); return; }
    const receiverUser = users.find(u => u.dbId === reqReceiver);
    if (!receiverUser) { alert("Receiver not found!"); return; }

    await addDoc(collection(db, "requests"), {
      senderId: currentUser.dbId,
      senderName: currentUser.name,
      receiverId: reqReceiver, 
      receiverName: receiverUser.name, 
      content: reqContent,
      status: 'pending',
      createdAt: serverTimestamp()
    });
    setReqContent(''); setReqReceiver(''); alert("Request Sent!");
  };

  const handleAcceptRequest = async (reqId) => {
    if(!confirm("Accept this request?")) return;
    await updateDoc(doc(db, "requests", reqId), { status: 'accepted', acceptedAt: serverTimestamp() });
  };

  const handleCompleteRequest = async (reqId) => {
    if(!confirm("Mark as complete?")) return;
    await updateDoc(doc(db, "requests", reqId), { status: 'completed', completedAt: serverTimestamp() });
  };

  const submitReject = async () => {
    if(!rejectReason) return alert("Please enter reason.");
    await updateDoc(doc(db, "requests", rejectModal.reqId), { status: 'rejected', rejectionReason: rejectReason, completedAt: serverTimestamp() });
    setRejectModal({ show: false, reqId: null });
  };

  // --- 5. OPERATIONS LOGIC ---
  const updateRoomStatus = async (roomId, newStatus) => {
    await updateDoc(doc(db, "rooms", roomId), { status: newStatus });
    setSelectedRoom(null);
  };

  const reportIssue = async (roomId) => {
    const issue = prompt(`Issue description for Room ${roomId}?`);
    if (!issue) return;
    await addDoc(collection(db, "tickets"), { roomId, issue, status: 'open', createdAt: serverTimestamp() });
    await updateRoomStatus(roomId, 'maintenance');
  };

  const resolveTicket = async (ticket) => {
    await updateDoc(doc(db, "tickets", ticket.id), { status: 'resolved', resolvedAt: serverTimestamp() });
    await updateDoc(doc(db, "rooms", ticket.roomId), { status: 'dirty' });
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    const f = e.target;
    await addDoc(collection(db, "users"), { userid: f.userid.value, name: f.name.value, password: f.password.value, role: f.role.value });
    f.reset(); alert("User Created!");
  };

  // REMOVED 'dirty' stat from display based on "remove traces of housekeeping"
  const stats = {
    vacant: rooms.filter(r => r.status === 'vacant').length,
    occupied: rooms.filter(r => r.status === 'occupied').length,
    maintenance: rooms.filter(r => r.status === 'maintenance').length
  };

  // --- RENDER LOGIN ---
  if (!currentUser) {
    return (
      <div className="app-container">
        <div className="login-container">
          <form className="login-card" onSubmit={handleLogin}>
            <h1><i className="fa-solid fa-hotel"></i> Aladdin Hotel</h1>
            <h3 style={{color:'#666', marginBottom:'20px'}}>System Login</h3>
            <input placeholder="User ID" value={loginId} onChange={e => setLoginId(e.target.value)} required />
            <input type="password" placeholder="Password" value={loginPass} onChange={e => setLoginPass(e.target.value)} required />
            {loginError && <p style={{color:'red'}}>{loginError}</p>}
            <button type="submit" className="btn blue" style={{justifyContent:'center', width:'100%'}}>Login</button>
          </form>
        </div>
      </div>
    );
  }

  // --- RENDER APP ---
  return (
    <div className="app-container">
      <header className="header">
        <div className="header-content">
          <h1>
             Aladdin Hotel
             <div className="user-profile" onClick={() => setShowPasswordModal(true)}>
               <i className="fa-solid fa-circle-user" style={{color: '#ddbd88'}}></i>
               <span style={{fontSize: '0.9rem', fontWeight: 'bold'}}>{currentUser.name}</span>
             </div>
          </h1>
          <div className="tabs">
            {Object.keys(ICONS).map(v => (
              <button key={v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>
                <i className={ICONS[v].icon}></i> <span>{ICONS[v].label}</span>
              </button>
            ))}
            {currentUser.role === 'admin' && (
              <button className={view === 'ADMIN' ? 'active' : ''} onClick={() => setView('ADMIN')}>
                <i className="fa-solid fa-lock"></i> <span>Admin</span>
              </button>
            )}
            <button onClick={handleLogout} style={{marginLeft:'5px', color: '#ef4444'}}>
              <i className="fa-solid fa-right-from-bracket"></i>
            </button>
          </div>
        </div>
      </header>

      {/* --- VIEW: FRONT OFFICE --- */}
      {view === 'FO' && (
        <div className="dashboard">
           <div className="stats-bar">
             <span className="badge green"><i className="fa-solid fa-check"></i>Ready: {stats.vacant}</span>
             <span className="badge blue"><i className="fa-solid fa-user"></i>Occ: {stats.occupied}</span>
             {/* Removed 'Dirty' Stat to comply with 'Remove Housekeeping' visual clutter, 
                 but rooms can still be marked dirty if needed for internal logic */}
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

      {/* --- HOUSEKEEPING VIEW REMOVED --- */}

      {/* --- VIEW: MAINTENANCE --- */}
      {view === 'MAINT' && (
        <div className="list-view">
          <h2><i className="fa-solid fa-wrench"></i> Active Tickets</h2>
          {tickets.filter(t => t.status === 'open').length === 0 ? <p style={{textAlign:'center', color:'#999'}}>No active issues.</p> :
            tickets.filter(t => t.status === 'open').map(ticket => (
              <div key={ticket.id} className="ticket-card open">
                <div><strong>Room {ticket.roomId}</strong><br/><small>{ticket.issue}</small></div>
                <button onClick={() => resolveTicket(ticket)} className="btn blue">Fixed</button>
              </div>
            ))
          }
        </div>
      )}

      {/* --- VIEW: REQUESTS --- */}
      {view === 'REQ' && (
        <div className="list-view">
          <div className="floor-section" style={{marginBottom:'20px', border:'1px solid #eee'}}>
            <h2 className="floor-title"><i className="fa-solid fa-plus-circle"></i> New Request</h2>
            <form onSubmit={handleSendRequest} style={{display:'flex', flexDirection:'column', gap:'10px'}}>
              <select value={reqReceiver} onChange={e => setReqReceiver(e.target.value)} required>
                <option value="">-- Select Recipient --</option>
                {users.filter(u => u.dbId !== currentUser.dbId).map(u => (
                    <option key={u.dbId} value={u.dbId}>{u.name} ({u.role})</option>
                ))}
              </select>
              <textarea placeholder="Message..." value={reqContent} onChange={e => setReqContent(e.target.value)} required rows="2" />
              <button type="submit" className="btn blue" style={{justifyContent:'center'}}>Send</button>
            </form>
          </div>

          <h2 className="floor-title"><i className="fa-solid fa-inbox"></i> Inbox</h2>
          {requests.filter(r => r.receiverId === currentUser.dbId).length === 0 && <p style={{color:'#999', textAlign:'center'}}>No incoming requests.</p>}
          {requests.filter(r => r.receiverId === currentUser.dbId).map(req => (
            <div key={req.id} className="req-card">
              <div style={{display:'flex', justifyContent:'space-between', marginBottom:'5px'}}>
                <span className={`req-status status-${req.status}`}>{req.status}</span>
                <span style={{fontSize:'0.8rem', color:'#666'}}>From: <b>{req.senderName}</b></span>
              </div>
              <p style={{margin:'5px 0', fontSize:'1rem'}}>{req.content}</p>

              {req.status === 'pending' && (
                <div style={{display:'flex', gap:'10px', marginTop:'10px'}}>
                  <button onClick={() => handleAcceptRequest(req.id)} className="btn green" style={{flex:1, justifyContent:'center'}}>Accept</button>
                  <button onClick={() => { setRejectModal({show:true, reqId:req.id}); setRejectReason(''); }} className="btn red" style={{flex:1, justifyContent:'center'}}>Reject</button>
                </div>
              )}
              {req.status === 'accepted' && (
                <button onClick={() => handleCompleteRequest(req.id)} className="btn blue" style={{width:'100%', justifyContent:'center', marginTop:'10px'}}>Mark Complete</button>
              )}
              {req.status === 'rejected' && <div style={{background:'#fff', borderLeft:'3px solid red', padding:'5px', marginTop:'5px', fontSize:'0.9rem'}}>Reason: {req.rejectionReason}</div>}
              
              <div style={{marginTop:'10px', paddingTop:'5px', borderTop:'1px solid #eee', fontSize:'0.75rem', color:'#666'}}>
                Sent: {formatTime(req.createdAt)}
              </div>
            </div>
          ))}

          <h2 className="floor-title" style={{marginTop:'30px'}}><i className="fa-solid fa-paper-plane"></i> Sent</h2>
          {requests.filter(r => r.senderId === currentUser.dbId).map(req => (
             <div key={req.id} className="req-card" style={{opacity:0.9}}>
                <div style={{display:'flex', justifyContent:'space-between'}}>
                  <span className={`req-status status-${req.status}`}>{req.status}</span>
                  <span style={{fontSize:'0.8rem', color:'#666'}}>To: <b>{req.receiverName}</b></span>
                </div>
                <p style={{margin:'5px 0', color:'#555'}}>{req.content}</p>
                {req.status === 'rejected' && <div style={{color:'red', fontSize:'0.85rem'}}>Rejected: {req.rejectionReason}</div>}
                <div style={{fontSize:'0.75rem', color:'#888', marginTop:'5px'}}>Sent: {formatTime(req.createdAt)}</div>
             </div>
          ))}
        </div>
      )}

      {/* --- VIEW: ADMIN --- */}
      {view === 'ADMIN' && (
        <div className="dashboard">
          <div className="floor-section">
            <h2 className="floor-title"><i className="fa-solid fa-users-gear"></i> Manage Staff</h2>
            <form onSubmit={handleCreateUser} style={{display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'20px'}}>
              <input name="userid" placeholder="User ID" required style={{flex:1, minWidth:'120px'}} />
              <input name="name" placeholder="Name" required style={{flex:1, minWidth:'120px'}} />
              <input name="password" placeholder="Pass" required style={{width:'100px'}} />
              <select name="role" style={{width:'100px'}}>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
              <button className="btn green">Add</button>
            </form>
            <div className="admin-table-container">
              <table>
                <thead><tr><th>ID</th><th>Name</th><th>Role</th><th>Action</th></tr></thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.dbId}>
                      <td>{u.userid}</td><td>{u.name}</td><td>{u.role}</td>
                      <td>{u.userid !== 'admin' && <button onClick={() => deleteDoc(doc(db, "users", u.dbId))} style={{color:'red', border:'none', background:'none'}}><i className="fa-solid fa-trash"></i></button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="floor-section">
            <h2 className="floor-title"><i className="fa-solid fa-wrench"></i> All Tickets</h2>
            <div className="admin-table-container">
              <table>
                <thead><tr><th>Room</th><th>Issue</th><th>Status</th><th>Reported</th><th>Resolved</th></tr></thead>
                <tbody>
                  {tickets.map(t => (
                    <tr key={t.id}>
                      <td>{t.roomId}</td>
                      <td>{t.issue}</td>
                      <td><span className={`badge ${t.status === 'open' ? 'red' : 'green'}`} style={{padding:'4px 8px', fontSize:'0.7rem'}}>{t.status}</span></td>
                      <td>{formatTime(t.createdAt)}</td>
                      <td>{t.resolvedAt ? formatTime(t.resolvedAt) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="floor-section">
            <h2 className="floor-title"><i className="fa-solid fa-paper-plane"></i> All Requests</h2>
            <div className="admin-table-container">
              <table>
                <thead><tr><th>From</th><th>To</th><th>Content</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>
                  {requests.map(r => (
                    <tr key={r.id}>
                      <td>{r.senderName}</td>
                      <td>{r.receiverName}</td>
                      <td>{r.content}</td>
                      <td><span className={`req-status status-${r.status}`}>{r.status}</span></td>
                      <td>{formatTime(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- MODALS --- */}
      {rejectModal.show && (
        <div className="modal-overlay" onClick={() => setRejectModal({show:false, reqId:null})}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 style={{color:'#dc3545'}}>Reject Request</h2>
            <textarea placeholder="Reason..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows="3" autoFocus />
            <div style={{display:'flex', gap:'10px', marginTop:'15px'}}>
              <button className="btn grey" style={{flex:1, justifyContent:'center'}} onClick={() => setRejectModal({show:false, reqId:null})}>Cancel</button>
              <button className="btn red" style={{flex:1, justifyContent:'center'}} onClick={submitReject}>Reject</button>
            </div>
          </div>
        </div>
      )}

      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Change Password</h2>
            <p>For user: <strong>{currentUser.userid}</strong></p>
            <form onSubmit={handleChangePassword} style={{display:'flex', flexDirection:'column', gap:'10px'}}>
              <input name="newPass" placeholder="New Password" required />
              <button className="btn blue" style={{justifyContent:'center'}}>Update</button>
            </form>
          </div>
        </div>
      )}

      {selectedRoom && (
        <div className="modal-overlay" onClick={() => setSelectedRoom(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Room {selectedRoom.id}</h2>
            <p style={{marginBottom:'20px'}}>Current: <strong>{getStatusLabel(selectedRoom.status).toUpperCase()}</strong></p>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}>
              <button className="btn red" onClick={() => updateRoomStatus(selectedRoom.id, 'dirty')} style={{justifyContent:'center', padding:'15px'}}>Mark Dirty</button>
              <button className="btn green" onClick={() => updateRoomStatus(selectedRoom.id, 'vacant')} style={{justifyContent:'center', padding:'15px'}}>Mark Ready</button>
              <button className="btn grey" onClick={() => reportIssue(selectedRoom.id)} style={{gridColumn:'span 2', justifyContent:'center', padding:'15px'}}>Report Issue</button>
            </div>
            <button style={{marginTop:'15px', background:'none', border:'none', textDecoration:'underline', cursor:'pointer', color:'#666'}} onClick={() => setSelectedRoom(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
