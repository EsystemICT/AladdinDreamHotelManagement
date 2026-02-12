import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc, serverTimestamp, query, orderBy, where, getDocs, limit } from 'firebase/firestore';
import './App.css';

// UPDATED ICONS & TABS
const ICONS = { 
  ROOMS: { icon: "fa-solid fa-bed", label: "Rooms" },
  TICKETS: { icon: "fa-solid fa-wrench", label: "Tickets" },
  REQ: { icon: "fa-solid fa-paper-plane", label: "Requests" },
  SHIFT: { icon: "fa-solid fa-clock", label: "My Shift" }
};

// HELPERS
const getStatusColor = (status) => {
  switch(status) {
    case 'maintenance': return 'bg-gray-800';
    default: return 'bg-green-500'; // Default is Ready
  }
};

const formatTime = (timestamp) => {
  if (!timestamp) return '-';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleString('en-MY', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
  });
};

const formatDate = (timestamp) => {
  if (!timestamp) return '-';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('en-MY');
};

export default function App() {
  // STATE
  const [currentUser, setCurrentUser] = useState(null);
  const [view, setView] = useState('ROOMS');
  
  // Real-time Clock
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Data
  const [rooms, setRooms] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [requests, setRequests] = useState([]);
  const [users, setUsers] = useState([]); 
  const [attendance, setAttendance] = useState([]);
  const [leaves, setLeaves] = useState([]);

  // UI
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [roomSearch, setRoomSearch] = useState('');
  const [staffModal, setStaffModal] = useState(null);
  
  // Requests UI
  const [reqReceiver, setReqReceiver] = useState('');
  const [reqContent, setReqContent] = useState('');
  
  // Login UI
  const [loginId, setLoginId] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');

  // Attendance UI
  const [lastClock, setLastClock] = useState(null);

  // --- 1. PERSISTENCE & CLOCK ---
  useEffect(() => {
    const storedUser = localStorage.getItem('hotelUser');
    if (storedUser) {
      const userObj = JSON.parse(storedUser);
      setCurrentUser(userObj);
      setView(userObj.role === 'admin' ? 'ADMIN' : 'ROOMS');
    }

    // Real-time clock ticker
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
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

    // Listeners for Data
    const qTickets = query(collection(db, "tickets"), orderBy("createdAt", "desc"));
    const unsubTickets = onSnapshot(qTickets, (snap) => setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    const qRequests = query(collection(db, "requests"), orderBy("createdAt", "desc"));
    const unsubRequests = onSnapshot(qRequests, (snap) => setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => setUsers(snap.docs.map(d => ({ dbId: d.id, ...d.data() }))));
    
    // Attendance
    const qAtt = query(collection(db, "attendance"), orderBy("timestamp", "desc"), limit(500));
    const unsubAtt = onSnapshot(qAtt, (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setAttendance(data);
        if(currentUser) {
            const myLogs = data.filter(a => a.userId === currentUser.userid);
            if(myLogs.length > 0) setLastClock(myLogs[0]);
        }
    });

    const qLeaves = query(collection(db, "leaves"), orderBy("createdAt", "desc"));
    const unsubLeaves = onSnapshot(qLeaves, (snap) => setLeaves(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    return () => { unsubTickets(); unsubRequests(); unsubUsers(); unsubAtt(); unsubLeaves(); };
  }, [currentUser]);

  // --- 3. AUTH ---
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
      setView(userData.role === 'admin' ? 'ADMIN' : 'ROOMS');
    } else {
      setLoginError('Incorrect Password');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('hotelUser');
    setCurrentUser(null);
    setLoginId('');
    setLoginPass('');
    setView('ROOMS');
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    const newPass = e.target.newPass.value;
    if(newPass.length < 4) return alert("Password too short");
    await updateDoc(doc(db, "users", currentUser.dbId), { password: newPass });
    setShowPasswordModal(false);
    alert("Password updated!");
  };

  // --- 4. ATTENDANCE & LEAVES ---
  const handleClock = async (type) => {
      if(!confirm(`Confirm Clock ${type.toUpperCase()}?`)) return;
      await addDoc(collection(db, "attendance"), {
          userId: currentUser.userid,
          userName: currentUser.name,
          type: type, 
          timestamp: serverTimestamp()
      });
  };

  const handleApplyLeave = async (e) => {
      e.preventDefault();
      const f = e.target;
      await addDoc(collection(db, "leaves"), {
          userId: currentUser.userid,
          userName: currentUser.name,
          type: f.leaveType.value,
          remarks: f.remarks.value,
          status: 'pending',
          createdAt: serverTimestamp()
      });
      f.reset();
      alert("Leave Application Sent!");
  };

  // --- 5. CORE LOGIC ---
  const handleSendRequest = async (e) => {
    e.preventDefault();
    if (!reqReceiver || !reqContent) { alert("Select receiver and enter details."); return; }
    const receiverUser = users.find(u => u.dbId === reqReceiver);
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
    if(!confirm("Mark this ticket as Resolved?")) return;
    await updateDoc(doc(db, "tickets", ticket.id), { 
      status: 'resolved', 
      resolvedAt: serverTimestamp(),
      resolvedBy: currentUser.name // Record WHO did it
    });
    // Auto-set room to Vacant/Ready (No dirty status)
    await updateDoc(doc(db, "rooms", ticket.roomId), { status: 'vacant' });
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    const f = e.target;
    await addDoc(collection(db, "users"), { userid: f.userid.value, name: f.name.value, password: f.password.value, role: f.role.value });
    f.reset(); alert("User Created!");
  };

  // --- FILTERED DATA ---
  const filteredRooms = rooms.filter(r => r.id.includes(roomSearch));
  const pendingLeavesCount = leaves.filter(l => l.status === 'pending').length;
  // Count Pending Requests for Current User
  const myPendingRequests = requests.filter(r => r.receiverId === currentUser?.dbId && r.status === 'pending').length;

  // --- RENDER LOGIN ---
  if (!currentUser) {
    return (
      <div className="app-container">
        <div className="login-container">
          <form className="login-card" onSubmit={handleLogin}>
            <h1><i className="fa-solid fa-hotel"></i> Aladdin Hotel</h1>
            <h3 style={{color:'#666', marginBottom:'20px'}}>Staff Login</h3>
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
               <span style={{fontWeight: 'bold'}}>{currentUser.name}</span>
             </div>
          </h1>
          <div className="tabs">
            {Object.keys(ICONS).map(v => (
              <button key={v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>
                <i className={ICONS[v].icon}></i> <span>{ICONS[v].label}</span>
                {v === 'REQ' && myPendingRequests > 0 && <span className="nav-badge">{myPendingRequests}</span>}
              </button>
            ))}
            {currentUser.role === 'admin' && (
              <button className={view === 'ADMIN' ? 'active' : ''} onClick={() => setView('ADMIN')}>
                <i className="fa-solid fa-lock"></i> <span>Admin</span>
                {pendingLeavesCount > 0 && <span className="nav-badge">{pendingLeavesCount}</span>}
              </button>
            )}
            <button onClick={handleLogout} style={{marginLeft:'5px', color: '#ef4444'}}>
              <i className="fa-solid fa-right-from-bracket"></i>
            </button>
          </div>
        </div>
      </header>

      {/* --- VIEW: ROOMS (GRID) --- */}
      {view === 'ROOMS' && (
        <div className="dashboard">
          <div className="floor-section">
            <h2 className="floor-title">
              <span><i className="fa-solid fa-bed"></i> Room Status</span>
              <input 
                className="search-bar"
                placeholder="Search Room..." 
                value={roomSearch}
                onChange={e => setRoomSearch(e.target.value)}
              />
            </h2>
            
            {[1, 2, 3].map(floorNum => {
               const floorRooms = filteredRooms.filter(r => r.floor === floorNum).sort((a,b) => a.id - b.id);
               if (floorRooms.length === 0) return null;
               return (
                 <div key={floorNum} style={{marginBottom:'20px'}}>
                   <h3 style={{fontSize:'1rem', color:'#666', borderBottom:'1px solid #eee'}}>Level {floorNum}</h3>
                   <div className="room-grid">
                     {floorRooms.map(room => (
                        <div key={room.id} className={`room-card ${getStatusColor(room.status)}`} onClick={() => setSelectedRoom(room)}>
                          <div className="room-number">{room.id}</div>
                          <div className="room-type">{room.type}</div>
                          {room.status === 'maintenance' && <div style={{fontSize:'0.6rem', marginTop:'2px'}}>MAINT</div>}
                        </div>
                     ))}
                   </div>
                 </div>
               );
             })}
          </div>
        </div>
      )}

      {/* --- VIEW: TICKETS (SEPARATED) --- */}
      {view === 'TICKETS' && (
        <div className="dashboard">
          {/* ACTIVE ISSUES */}
          <div className="list-view">
            <h2><i className="fa-solid fa-triangle-exclamation"></i> Active Issues</h2>
            {tickets.filter(t => t.status === 'open').length === 0 ? <p style={{textAlign:'center', color:'#999'}}>No active issues.</p> :
              tickets.filter(t => t.status === 'open').map(ticket => (
                <div key={ticket.id} className="ticket-card open">
                  <div>
                    <strong>Room {ticket.roomId}</strong> - <span style={{color:'#666'}}>{ticket.issue}</span>
                    <div style={{fontSize:'0.8rem', color:'#888', marginTop:'5px'}}>Reported: {formatTime(ticket.createdAt)}</div>
                  </div>
                  <button onClick={() => resolveTicket(ticket)} className="btn blue">Resolve</button>
                </div>
              ))
            }
          </div>

          {/* HISTORY */}
          <div className="list-view">
            <h2><i className="fa-solid fa-clock-rotate-left"></i> Resolved History (Recent)</h2>
            {tickets.filter(t => t.status === 'resolved').slice(0, 10).map(ticket => (
                <div key={ticket.id} className="ticket-card resolved">
                  <div>
                    <strong>Room {ticket.roomId}</strong> - {ticket.issue}
                    <div style={{fontSize:'0.8rem', color:'#666', marginTop:'5px'}}>
                        Fixed by <b>{ticket.resolvedBy || 'Unknown'}</b> on {formatTime(ticket.resolvedAt)}
                    </div>
                  </div>
                  <div style={{color:'green', fontWeight:'bold', fontSize:'0.8rem'}}>FIXED</div>
                </div>
            ))}
          </div>
        </div>
      )}

      {/* --- VIEW: REQUESTS --- */}
      {view === 'REQ' && (
        <div className="list-view">
          <div className="floor-section" style={{marginBottom:'20px', border:'1px solid #eee'}}>
            <h2 className="floor-title">New Request</h2>
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

          <h2 className="floor-title">Inbox</h2>
          {requests.filter(r => r.receiverId === currentUser.dbId).length === 0 && <p style={{color:'#999', textAlign:'center'}}>No incoming requests.</p>}
          {requests.filter(r => r.receiverId === currentUser.dbId).map(req => (
            <div key={req.id} className="req-card">
              <div style={{display:'flex', justifyContent:'space-between', marginBottom:'5px'}}>
                <span className={`req-status status-${req.status}`}>{req.status}</span>
                <span style={{fontSize:'0.8rem', color:'#666'}}>From: <b>{req.senderName}</b></span>
              </div>
              <p style={{margin:'5px 0', fontSize:'1rem'}}>{req.content}</p>
              <div style={{fontSize:'0.75rem', color:'#666', marginTop:'5px'}}>{formatTime(req.createdAt)}</div>
            </div>
          ))}
        </div>
      )}

      {/* --- VIEW: MY SHIFT (ATTENDANCE) --- */}
      {view === 'SHIFT' && (
        <div className="dashboard">
            {/* REAL TIME CLOCK */}
            <div className="clock-card">
                <div className="clock-display">
                    <div className="clock-date">{currentTime.toLocaleDateString('en-MY', {weekday:'long', day:'numeric', month:'long', year:'numeric'})}</div>
                    <div className="clock-time">{currentTime.toLocaleTimeString('en-MY', {hour12:false})}</div>
                </div>
                <div style={{display:'flex', gap:'20px', justifyContent:'center'}}>
                    <button onClick={() => handleClock('in')} className="btn green clock-btn" disabled={lastClock?.type === 'in'}>
                         Clock IN
                    </button>
                    <button onClick={() => handleClock('out')} className="btn red clock-btn" disabled={lastClock?.type !== 'in'}>
                         Clock OUT
                    </button>
                </div>
                <p style={{marginTop:'15px', color:'#666'}}>
                    Status: <strong>{lastClock?.type === 'in' ? 'Working' : 'Off Duty'}</strong>
                </p>
            </div>

            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(300px, 1fr))', gap:'20px'}}>
                {/* LEAVE APP */}
                <div className="leave-form">
                    <h3>Apply Leave / MC</h3>
                    <form onSubmit={handleApplyLeave}>
                        <select name="leaveType" required>
                            <option value="Annual Leave">Annual Leave</option>
                            <option value="Urgent Leave">Urgent Leave</option>
                            <option value="Unpaid Leave">Unpaid Leave</option>
                            <option value="MC">MC</option>
                            <option value="Others">Others</option>
                        </select>
                        <textarea name="remarks" placeholder="Reason / Remarks" required rows="3"></textarea>
                        <button className="btn purple" style={{justifyContent:'center', width:'100%'}}>Submit Application</button>
                    </form>
                </div>

                {/* MY LOGS */}
                <div className="list-view" style={{margin:0}}>
                    <h3>My Logs</h3>
                    <div style={{maxHeight:'300px', overflowY:'auto'}}>
                        {attendance.filter(a => a.userId === currentUser.userid).slice(0, 10).map(a => (
                            <div key={a.id} style={{padding:'10px', borderBottom:'1px solid #eee', display:'flex', justifyContent:'space-between'}}>
                                <span style={{fontWeight:'bold', color: a.type==='in'?'green':'red'}}>
                                    {a.type.toUpperCase()}
                                </span>
                                <span>{formatDate(a.timestamp)} {formatTime(a.timestamp)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* --- VIEW: ADMIN --- */}
      {view === 'ADMIN' && (
        <div className="dashboard">
          {/* MANAGE STAFF */}
          <div className="floor-section">
            <h2 className="floor-title"><i className="fa-solid fa-users-gear"></i> Manage Staff (Click row for history)</h2>
            <form onSubmit={handleCreateUser} style={{display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'20px'}}>
              <input name="userid" placeholder="ID" required style={{flex:1}} />
              <input name="name" placeholder="Name" required style={{flex:1}} />
              <input name="password" placeholder="Pass" required style={{width:'100px'}} />
              <select name="role" style={{width:'100px'}}><option value="staff">Staff</option><option value="admin">Admin</option></select>
              <button className="btn green">Add</button>
            </form>
            <div className="admin-table-container">
              <table>
                <thead><tr><th>ID</th><th>Name</th><th>Role</th><th>Action</th></tr></thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.dbId} className="clickable-row" onClick={() => setStaffModal(u)}>
                      <td>{u.userid}</td><td>{u.name}</td><td>{u.role}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                          {u.userid !== 'admin' && <button onClick={() => deleteDoc(doc(db, "users", u.dbId))} style={{color:'red', border:'none', background:'none'}}><i className="fa-solid fa-trash"></i></button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* LEAVE APPROVALS */}
          <div className="floor-section">
            <h2 className="floor-title">Leave Applications</h2>
            <div className="admin-table-container">
               <table>
                   <thead><tr><th>Staff</th><th>Type</th><th>Remarks</th><th>Date</th><th>Status</th></tr></thead>
                   <tbody>
                       {leaves.map(l => (
                           <tr key={l.id}>
                               <td>{l.userName}</td>
                               <td><span className="badge purple" style={{fontSize:'0.7rem', padding:'4px 8px'}}>{l.type}</span></td>
                               <td>{l.remarks}</td>
                               <td>{formatDate(l.createdAt)}</td>
                               <td>
                                   {l.status === 'pending' ? (
                                       <div style={{display:'flex', gap:'5px'}}>
                                           <button onClick={() => updateDoc(doc(db, "leaves", l.id), {status: 'approved'})} className="btn green" style={{padding:'5px'}}>✓</button>
                                           <button onClick={() => updateDoc(doc(db, "leaves", l.id), {status: 'rejected'})} className="btn red" style={{padding:'5px'}}>✕</button>
                                       </div>
                                   ) : (
                                       <span style={{fontWeight:'bold', color: l.status==='approved'?'green':'red'}}>{l.status.toUpperCase()}</span>
                                   )}
                               </td>
                           </tr>
                       ))}
                   </tbody>
               </table>
            </div>
          </div>
        </div>
      )}

      {/* --- MODALS --- */}
      
      {/* STAFF DETAIL MODAL */}
      {staffModal && (
          <div className="modal-overlay" onClick={() => setStaffModal(null)}>
              <div className="modal-content" onClick={e => e.stopPropagation()}>
                  <h2>{staffModal.name}</h2>
                  
                  <h3 style={{fontSize:'1rem', marginTop:'20px', borderBottom:'2px solid #eee'}}>Attendance History</h3>
                  <div style={{maxHeight:'200px', overflowY:'auto', marginBottom:'20px'}}>
                      <table style={{fontSize:'0.85rem'}}>
                          <thead><tr><th>Type</th><th>Time</th></tr></thead>
                          <tbody>
                              {attendance.filter(a => a.userId === staffModal.userid).map(a => (
                                  <tr key={a.id}>
                                      <td style={{color: a.type==='in'?'green':'red', fontWeight:'bold'}}>{a.type.toUpperCase()}</td>
                                      <td>{formatDate(a.timestamp)} {formatTime(a.timestamp)}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>

                  <h3 style={{fontSize:'1rem', borderBottom:'2px solid #eee'}}>Leave History</h3>
                  <div style={{maxHeight:'200px', overflowY:'auto'}}>
                      <table style={{fontSize:'0.85rem'}}>
                          <thead><tr><th>Type</th><th>Status</th></tr></thead>
                          <tbody>
                              {leaves.filter(l => l.userId === staffModal.userid).map(l => (
                                  <tr key={l.id}>
                                      <td>{l.type}</td>
                                      <td>{l.status}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
                  <button onClick={() => setStaffModal(null)} className="btn grey" style={{width:'100%', marginTop:'20px', justifyContent:'center'}}>Close</button>
              </div>
          </div>
      )}

      {/* CHANGE PASSWORD */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Change Password</h2>
            <form onSubmit={handleChangePassword} style={{display:'flex', flexDirection:'column', gap:'10px'}}>
              <input name="newPass" placeholder="New Password" required />
              <button className="btn blue" style={{justifyContent:'center'}}>Update</button>
            </form>
          </div>
        </div>
      )}

      {/* ROOM MODAL */}
      {selectedRoom && (
        <div className="modal-overlay" onClick={() => setSelectedRoom(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Room {selectedRoom.id}</h2>
            <p>Status: <strong>{selectedRoom.status.toUpperCase()}</strong></p>
            
            <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
              {/* Only 2 Actions: Maintenance OR Ready */}
              {selectedRoom.status === 'maintenance' ? (
                  <button className="btn green" onClick={() => updateRoomStatus(selectedRoom.id, 'vacant')} style={{justifyContent:'center', padding:'15px'}}>Mark Done (Ready)</button>
              ) : (
                  <button className="btn grey" onClick={() => reportIssue(selectedRoom.id)} style={{justifyContent:'center', padding:'15px'}}>Report Issue</button>
              )}
            </div>
            <button style={{marginTop:'15px', background:'none', border:'none', textDecoration:'underline', cursor:'pointer', color:'#666'}} onClick={() => setSelectedRoom(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
