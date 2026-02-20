import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc, serverTimestamp, query, orderBy, where, getDocs, limit, writeBatch } from 'firebase/firestore';
import './App.css';

// ICONS & TABS
const ICONS = { 
  ROOMS: { icon: "fa-solid fa-bed", label: "Rooms" },
  TICKETS: { icon: "fa-solid fa-wrench", label: "Tickets" },
  ITEMS: { icon: "fa-solid fa-boxes-stacked", label: "Item Request" },
  REQ: { icon: "fa-solid fa-paper-plane", label: "Msg Staff" },
  SHIFT: { icon: "fa-solid fa-clock", label: "My Shift" }
};

// HELPERS
const getStatusColor = (status) => {
  switch(status) {
    case 'maintenance': return 'bg-gray-800';
    default: return 'bg-green-500'; 
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
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Data
  const [rooms, setRooms] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [requests, setRequests] = useState([]);
  const [users, setUsers] = useState([]); 
  const [attendance, setAttendance] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [inventory, setInventory] = useState([]); 

  // UI
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [roomSearch, setRoomSearch] = useState('');
  const [staffModal, setStaffModal] = useState(null);
  
  // Login UI
  const [loginId, setLoginId] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');

  // Forms UI
  const [lastClock, setLastClock] = useState(null);
  const [reqReceiver, setReqReceiver] = useState('');
  const [reqContent, setReqContent] = useState('');
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketSort, setTicketSort] = useState('date-desc');

  // --- 1. PERSISTENCE & CLOCK ---
  useEffect(() => {
    const storedUser = localStorage.getItem('hotelUser');
    if (storedUser) {
      const userObj = JSON.parse(storedUser);
      setCurrentUser(userObj);
      setView(userObj.role === 'admin' ? 'ADMIN' : 'ROOMS');
    }
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

    const qTickets = query(collection(db, "tickets"), orderBy("createdAt", "desc"));
    const unsubTickets = onSnapshot(qTickets, (snap) => setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    const qRequests = query(collection(db, "requests"), orderBy("createdAt", "desc"));
    const unsubRequests = onSnapshot(qRequests, (snap) => setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => setUsers(snap.docs.map(d => ({ dbId: d.id, ...d.data() }))));
    
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

    const qInv = query(collection(db, "inventory"), orderBy("createdAt", "asc"));
    const unsubInv = onSnapshot(qInv, (snap) => setInventory(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    return () => { unsubTickets(); unsubRequests(); unsubUsers(); unsubAtt(); unsubLeaves(); unsubInv(); };
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

  const handleAdminChangePassword = async (staffDocId, staffName) => {
      const newPass = prompt(`Enter new password for ${staffName}:`);
      if (newPass === null) return; // User clicked Cancel
      if (newPass.length < 4) return alert("Password must be at least 4 characters long.");
      
      try {
          await updateDoc(doc(db, "users", staffDocId), { password: newPass });
          alert(`Password for ${staffName} updated successfully!`);
      } catch (error) {
          console.error("Error updating password:", error);
          alert("Failed to update password.");
      }
  };

  // --- 4. ATTENDANCE, LEAVES & ITEMS ---
  const handleClock = async (type) => {
      if(!confirm(`Confirm Clock ${type.toUpperCase()}?`)) return;
      await addDoc(collection(db, "attendance"), {
          userId: currentUser.userid, userName: currentUser.name, type: type, timestamp: serverTimestamp()
      });
  };

  const handleApplyLeave = async (e) => {
      e.preventDefault();
      const f = e.target;
      await addDoc(collection(db, "leaves"), {
          userId: currentUser.userid, userName: currentUser.name, type: f.leaveType.value, remarks: f.remarks.value, status: 'pending', createdAt: serverTimestamp()
      });
      f.reset(); alert("Leave Application Sent!");
  };

  const handleItemRequest = async (e) => {
    e.preventDefault();
    const f = e.target;
    await addDoc(collection(db, "inventory"), {
        department: f.department.value,
        item: f.item.value,
        qty: f.qty.value || '',
        remark: f.remark.value || '',
        bought: false,
        buyRemark: '',
        requestedBy: currentUser.name,
        createdAt: serverTimestamp()
    });
    f.reset();
  };

  const toggleItemBought = async (invItem) => {
    if (!invItem.bought) {
        const remark = prompt("Optional complete remark (e.g., 'datin done buy'):");
        if (remark === null) return; 
        await updateDoc(doc(db, "inventory", invItem.id), { bought: true, buyRemark: remark });
    } else {
        if(confirm("Unmark this item as bought?")) {
            await updateDoc(doc(db, "inventory", invItem.id), { bought: false, buyRemark: '' });
        }
    }
  };

  // --- 5. CORE LOGIC ---
  const handleSendRequest = async (e) => {
    e.preventDefault();
    if (!reqReceiver || !reqContent) { alert("Select receiver and enter details."); return; }
    const receiverUser = users.find(u => u.dbId === reqReceiver);
    await addDoc(collection(db, "requests"), {
      senderId: currentUser.dbId, senderName: currentUser.name, receiverId: reqReceiver, receiverName: receiverUser.name, content: reqContent, status: 'pending', createdAt: serverTimestamp()
    });
    setReqContent(''); setReqReceiver(''); alert("Message Sent!");
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
    await updateDoc(doc(db, "tickets", ticket.id), { status: 'resolved', resolvedAt: serverTimestamp(), resolvedBy: currentUser.name });
    await updateDoc(doc(db, "rooms", ticket.roomId), { status: 'vacant' });
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    const f = e.target;
    await addDoc(collection(db, "users"), { userid: f.userid.value, name: f.name.value, password: f.password.value, role: f.role.value });
    f.reset(); alert("User Created!");
  };

  // --- ADD NEW ROOMS TO DATABASE ---
  const addPublicRooms = async () => {
    const newRooms = [
      { id: "1A", type: "STORE", floor: 1, status: "vacant" },
      { id: "1B", type: "STORE", floor: 1, status: "vacant" },
      { id: "2A", type: "STORE", floor: 2, status: "vacant" },
      { id: "2B", type: "STORE", floor: 2, status: "vacant" },
      { id: "3A", type: "STORE", floor: 3, status: "vacant" },
      { id: "3B", type: "STORE", floor: 3, status: "vacant" },
      { id: "Reception", type: "LOBBY", floor: "Public", status: "vacant" },
      { id: "Pantry", type: "LOBBY", floor: "Public", status: "vacant" },
      { id: "Lobby Toilet", type: "LOBBY", floor: "Public", status: "vacant" },
      { id: "Comfort Area", type: "LEVEL 1", floor: "Public", status: "vacant" }
    ];

    const batch = writeBatch(db);
    newRooms.forEach(r => {
       const ref = doc(db, "rooms", r.id);
       batch.set(ref, r);
    });
    await batch.commit();
    alert("New rooms and facilities added to Database!");
  };

  // --- PROCESS DATA ---
  const filteredRooms = rooms.filter(r => r.id.includes(roomSearch));
  const pendingLeavesCount = leaves.filter(l => l.status === 'pending').length;
  const myPendingRequests = requests.filter(r => r.receiverId === currentUser?.dbId && r.status === 'pending').length;

  const getProcessedTickets = () => {
    let processed = [...tickets];
    if (ticketSearch) processed = processed.filter(t => t.roomId.toString().includes(ticketSearch));
    processed.sort((a, b) => {
      const dateA = a.createdAt ? a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt) : new Date(0);
      const dateB = b.createdAt ? b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt) : new Date(0);
      const roomA = parseInt(a.roomId) || 0;
      const roomB = parseInt(b.roomId) || 0;
      switch (ticketSort) {
        case 'date-desc': return dateB - dateA;
        case 'date-asc': return dateA - dateB;
        case 'room-asc': return roomA - roomB;
        case 'room-desc': return roomB - roomA;
        default: return 0;
      }
    });
    return processed;
  };
  const processedTickets = getProcessedTickets();

  // Inventory logic
  const currentMonthName = currentTime.toLocaleString('en-MY', { month: 'long', year: 'numeric' }).toUpperCase();
  const currentMonthIndex = currentTime.getMonth();
  const currentYear = currentTime.getFullYear();
  
  const currentMonthInventory = inventory.filter(inv => {
      const d = inv.createdAt ? (inv.createdAt.toDate ? inv.createdAt.toDate() : new Date(inv.createdAt)) : new Date();
      return d.getMonth() === currentMonthIndex && d.getFullYear() === currentYear;
  });

  // NEW: Today's Clock In & Out Logic
  const todayDateString = currentTime.toLocaleDateString('en-MY');
  const todaysAttendanceMap = {};
  
  // Group attendance by user for the current day
  attendance.forEach(a => {
      const d = a.timestamp ? (a.timestamp.toDate ? a.timestamp.toDate() : new Date(a.timestamp)) : new Date();
      if (d.toLocaleDateString('en-MY') === todayDateString) {
          if (!todaysAttendanceMap[a.userId]) {
              todaysAttendanceMap[a.userId] = { userName: a.userName, inTime: null, outTime: null, inRaw: 0, outRaw: 0 };
          }
          const timeMs = d.getTime();
          if (a.type === 'in') {
              if (!todaysAttendanceMap[a.userId].inRaw || timeMs < todaysAttendanceMap[a.userId].inRaw) {
                  todaysAttendanceMap[a.userId].inRaw = timeMs;
                  todaysAttendanceMap[a.userId].inTime = formatTime(a.timestamp);
              }
          } else if (a.type === 'out') {
              if (!todaysAttendanceMap[a.userId].outRaw || timeMs > todaysAttendanceMap[a.userId].outRaw) {
                  todaysAttendanceMap[a.userId].outRaw = timeMs;
                  todaysAttendanceMap[a.userId].outTime = formatTime(a.timestamp);
              }
          }
      }
  });
  const todaysAttendanceData = Object.values(todaysAttendanceMap);

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
            
            {/* ADDED 'Store' TO THE MAP ARRAY */}
            {[1, 2, 3, 'Public', 'Store'].map(floorNum => {
               
               let floorRooms = [];

               // 1. If it's the "Store" section, grab ALL rooms with type "STORE"
               if (floorNum === 'Store') {
                   floorRooms = filteredRooms
                       .filter(r => r.type === 'STORE')
                       .sort((a,b) => String(a.id).localeCompare(String(b.id), undefined, {numeric: true}));
               } 
               // 2. If it's the "Public" section, grab rooms where floor is "Public"
               else if (floorNum === 'Public') {
                   floorRooms = filteredRooms
                       .filter(r => r.floor === 'Public')
                       .sort((a,b) => String(a.id).localeCompare(String(b.id), undefined, {numeric: true}));
               } 
               // 3. Normal floors (1, 2, 3) - but EXCLUDE the "STORE" rooms so they don't show up twice
               else {
                   floorRooms = filteredRooms
                       .filter(r => r.floor === floorNum && r.type !== 'STORE')
                       .sort((a,b) => String(a.id).localeCompare(String(b.id), undefined, {numeric: true}));
               }
               
               if (floorRooms.length === 0) return null;

               // Set the section titles
               let sectionTitle = `Level ${floorNum}`;
               if (floorNum === 'Public') sectionTitle = 'Public Areas & Facilities';
               if (floorNum === 'Store') sectionTitle = 'Storerooms';
               
               return (
                 <div key={floorNum} style={{marginBottom:'20px'}}>
                   <h3 style={{fontSize:'1rem', color:'#666', borderBottom:'1px solid #eee'}}>
                     {sectionTitle}
                   </h3>
                   <div className="room-grid">
                     {floorRooms.map(room => (
                        <div key={room.id} className={`room-card ${getStatusColor(room.status)}`} onClick={() => setSelectedRoom(room)}>
                          {/* DYNAMIC FONT SIZE FOR LONG TEXT */}
                          <div className="room-number" style={{fontSize: room.id.length > 5 ? '1rem' : '1.4rem'}}>{room.id}</div>
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

      {/* --- VIEW: TICKETS (SEPARATED WITH SCROLLPANES) --- */}
      {view === 'TICKETS' && (
        <div className="dashboard">
          <div className="list-view">
            <h2><i className="fa-solid fa-triangle-exclamation"></i> Active Issues</h2>
            <div className="scroll-pane scroll-pane-tall">
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
          </div>

          <div className="list-view">
            <h2><i className="fa-solid fa-clock-rotate-left"></i> Resolved History</h2>
            <div className="scroll-pane scroll-pane-tall">
              {tickets.filter(t => t.status === 'resolved').map(ticket => (
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
        </div>
      )}

      {/* --- VIEW: ITEMS INVENTORY --- */}
      {view === 'ITEMS' && (
        <div className="dashboard">
          <div className="floor-section">
            <h2 className="floor-title"><i className="fa-solid fa-cart-plus"></i> Request New Item</h2>
            <form onSubmit={handleItemRequest} style={{display:'flex', gap:'10px', flexWrap:'wrap'}}>
              <select name="department" required style={{flex:'1', minWidth:'150px'}}>
                <option value="">-- Department --</option>
                <option value="Frontdesk">Frontdesk</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Housekeeping">Housekeeping</option>
              </select>
              <input name="item" placeholder="Item Name" required style={{flex:'2', minWidth:'200px'}} />
              <input name="qty" placeholder="Qty (Opt)" style={{flex:'1', minWidth:'100px'}} />
              <input name="remark" placeholder="Remark (Opt)" style={{flex:'2', minWidth:'150px'}} />
              <button type="submit" className="btn blue">Add List</button>
            </form>
          </div>

          <div className="list-view">
            <h2 style={{textAlign: 'center', marginBottom: '25px'}}>REQUEST ITEM {currentMonthName}</h2>
            <div className="scroll-pane scroll-pane-tall" style={{paddingRight: '15px'}}>
                
                {['Frontdesk', 'Maintenance', 'Housekeeping'].map(dept => {
                    const deptItems = currentMonthInventory.filter(i => i.department === dept);
                    if(deptItems.length === 0) return null;
                    
                    return (
                        <div key={dept} className="inv-group">
                            <div className="inv-dept-title">{dept}</div>
                            {deptItems.map((item, idx) => (
                                <div key={item.id} className="inv-item">
                                    <span style={{color:'#888', width:'25px'}}>{idx + 1})</span>
                                    <div className="inv-content">
                                        <span className={item.bought ? "inv-bought" : ""}>
                                            {item.item} {item.qty && ` - ${item.qty}`}
                                        </span>
                                        {item.remark && <span className="inv-note">Note: {item.remark}</span>}
                                        {item.bought && item.buyRemark && <span className="inv-remark">- {item.buyRemark} ✅</span>}
                                        {item.bought && !item.buyRemark && <span className="inv-remark">✅</span>}
                                    </div>
                                    <input 
                                        type="checkbox" 
                                        className="inv-checkbox"
                                        checked={item.bought}
                                        onChange={() => toggleItemBought(item)}
                                    />
                                </div>
                            ))}
                        </div>
                    );
                })}

                {currentMonthInventory.length === 0 && <p style={{textAlign:'center', color:'#999'}}>No items requested this month.</p>}

            </div>
          </div>
        </div>
      )}

      {/* --- VIEW: MESSAGES/REQUESTS --- */}
      {view === 'REQ' && (
        <div className="list-view">
          <div className="floor-section" style={{marginBottom:'20px', border:'1px solid #eee'}}>
            <h2 className="floor-title"><i className="fa-solid fa-paper-plane"></i> Message Staff</h2>
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
          <div className="scroll-pane">
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
        </div>
      )}

      {/* --- VIEW: MY SHIFT (ATTENDANCE) --- */}
      {view === 'SHIFT' && (
        <div className="dashboard">
            <div className="clock-card">
                <div className="clock-display">
                    <div className="clock-date">{currentTime.toLocaleDateString('en-MY', {weekday:'long', day:'numeric', month:'long', year:'numeric'})}</div>
                    <div className="clock-time">{currentTime.toLocaleTimeString('en-MY', {hour12:false})}</div>
                </div>
                <div style={{display:'flex', gap:'20px', justifyContent:'center'}}>
                    <button onClick={() => handleClock('in')} className="btn green clock-btn" disabled={lastClock?.type === 'in'}>Clock IN</button>
                    <button onClick={() => handleClock('out')} className="btn red clock-btn" disabled={lastClock?.type !== 'in'}>Clock OUT</button>
                </div>
                <p style={{marginTop:'15px', color:'#666'}}>
                    Status: <strong>{lastClock?.type === 'in' ? 'Working' : 'Off Duty'}</strong>
                </p>
            </div>

            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(300px, 1fr))', gap:'20px'}}>
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

                <div className="list-view" style={{margin:0}}>
                    <h3>My Logs</h3>
                    <div className="scroll-pane">
                        {attendance.filter(a => a.userId === currentUser.userid).map(a => (
                            <div key={a.id} style={{padding:'10px', borderBottom:'1px solid #eee', display:'flex', justifyContent:'space-between'}}>
                                <span style={{fontWeight:'bold', color: a.type==='in'?'green':'red'}}>{a.type.toUpperCase()}</span>
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
            <div className="admin-table-container scroll-pane scroll-pane-tall">
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

          {/* TODAY'S ATTENDANCE - Moved underneath Manage Staff */}
          <div className="floor-section">
            <h2 className="floor-title"><i className="fa-solid fa-clock"></i> Today's Attendance</h2>
            <div className="admin-table-container scroll-pane">
              <table>
                <thead><tr><th>Staff Name</th><th>Clock In</th><th>Clock Out</th></tr></thead>
                <tbody>
                  {todaysAttendanceData.length === 0 ? (
                      <tr><td colSpan="3" style={{textAlign:'center', color:'#999'}}>No staff clocked in today.</td></tr>
                  ) : (
                      todaysAttendanceData.map((a, idx) => (
                        <tr key={idx}>
                          <td><strong>{a.userName}</strong></td>
                          <td>{a.inTime ? a.inTime : <span style={{color: '#999'}}>-</span>}</td>
                          <td>
                            {a.outTime ? (
                                a.outTime
                            ) : (
                                <span style={{
                                    backgroundColor: '#fee2e2', color: '#dc2626', 
                                    padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold'
                                }}>
                                    Still Working
                                </span>
                            )}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="floor-section" style={{marginTop: '20px'}}>
            <h2 className="floor-title">Leave Applications</h2>
            <div className="admin-table-container scroll-pane">
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

          <div className="floor-section">
            <h2 className="floor-title"><i className="fa-solid fa-wrench"></i> Maintenance Tickets History</h2>
            <div className="filter-bar">
                <input placeholder="Search Room No..." value={ticketSearch} onChange={e => setTicketSearch(e.target.value)} />
                <select value={ticketSort} onChange={e => setTicketSort(e.target.value)}>
                    <option value="date-desc">Date (Newest)</option>
                    <option value="date-asc">Date (Oldest)</option>
                    <option value="room-asc">Room (Asc)</option>
                    <option value="room-desc">Room (Desc)</option>
                </select>
            </div>
            <div className="admin-table-container scroll-pane scroll-pane-tall">
              <table>
                <thead>
                  <tr><th>Room</th><th>Issue</th><th>Status</th><th>Reported</th><th>Resolved</th><th>Resolved By</th></tr>
                </thead>
                <tbody>
                  {processedTickets.map(t => (
                    <tr key={t.id}>
                      <td><strong>{t.roomId}</strong></td>
                      <td>{t.issue}</td>
                      <td><span style={{fontWeight:'bold', color: t.status === 'open' ? '#ef4444' : '#10b981'}}>{t.status.toUpperCase()}</span></td>
                      <td>{formatDate(t.createdAt)}</td>
                      <td>{t.resolvedAt ? formatDate(t.resolvedAt) : '-'}</td>
                      <td>{t.resolvedBy || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="floor-section">
            <h2 className="floor-title"><i className="fa-solid fa-paper-plane"></i> All Staff Messages</h2>
            <div className="admin-table-container scroll-pane scroll-pane-tall">
              <table>
                <thead><tr><th>From</th><th>To</th><th>Content</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>
                  {requests.map(r => (
                    <tr key={r.id}>
                      <td><strong>{r.senderName}</strong></td>
                      <td>{r.receiverName}</td>
                      <td style={{maxWidth:'300px'}}>{r.content}</td>
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
      
      {staffModal && (
          <div className="modal-overlay" onClick={() => setStaffModal(null)}>
              <div className="modal-content" onClick={e => e.stopPropagation()}>
                  <h2>{staffModal.name}</h2>
                  
                  <h3 style={{fontSize:'1rem', marginTop:'20px', borderBottom:'2px solid #eee'}}>Attendance History</h3>
                  <div className="scroll-pane scroll-pane-modal" style={{marginBottom:'20px'}}>
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
                  <div className="scroll-pane scroll-pane-modal">
                      <table style={{fontSize:'0.85rem'}}>
                          <thead><tr><th>Type</th><th>Status</th></tr></thead>
                          <tbody>
                              {leaves.filter(l => l.userId === staffModal.userid).map(l => (
                                  <tr key={l.id}><td>{l.type}</td><td>{l.status}</td></tr>
                              ))}
                          </tbody>
                      </table>
                  </div>

                  <button 
                      onClick={() => handleAdminChangePassword(staffModal.dbId, staffModal.name)} 
                      className="btn blue" 
                      style={{width:'100%', marginTop:'20px', justifyContent:'center'}}
                  >
                      <i className="fa-solid fa-key"></i> Change Staff Password
                  </button>
                
                  <button onClick={() => setStaffModal(null)} className="btn grey" style={{width:'100%', marginTop:'20px', justifyContent:'center'}}>Close</button>
              </div>
          </div>
      )}

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

      {/* ROOM MODAL WITH HISTORY */}
      {selectedRoom && (
        <div className="modal-overlay" onClick={() => setSelectedRoom(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Room {selectedRoom.id}</h2>
            <p>Status: <strong>{selectedRoom.status.toUpperCase()}</strong></p>
            
            <div style={{display:'flex', flexDirection:'column', gap:'10px', marginBottom: '20px'}}>
              {/* Only 2 Actions: Maintenance OR Ready */}
              {selectedRoom.status === 'maintenance' ? (
                  <button className="btn green" onClick={() => updateRoomStatus(selectedRoom.id, 'vacant')} style={{justifyContent:'center', padding:'15px'}}>Mark Done (Ready)</button>
              ) : (
                  <button className="btn grey" onClick={() => reportIssue(selectedRoom.id)} style={{justifyContent:'center', padding:'15px'}}>Report Issue</button>
              )}
            </div>

            <h3 style={{fontSize:'1rem', borderBottom:'2px solid #eee', paddingBottom:'5px'}}>Maintenance History</h3>
            <div className="scroll-pane scroll-pane-modal" style={{textAlign: 'left'}}>
                {tickets.filter(t => t.roomId === selectedRoom.id).length === 0 ? (
                    <p style={{color: '#999', fontSize: '0.85rem'}}>No history recorded.</p>
                ) : (
                    tickets.filter(t => t.roomId === selectedRoom.id).map(t => (
                        <div key={t.id} style={{padding: '10px 0', borderBottom: '1px dashed #eee'}}>
                            <div style={{display: 'flex', justifyContent: 'space-between'}}>
                                <strong>{t.issue}</strong>
                                <span style={{fontSize: '0.7rem', color: t.status === 'open' ? 'red' : 'green', fontWeight: 'bold'}}>{t.status.toUpperCase()}</span>
                            </div>
                            <div style={{fontSize: '0.8rem', color: '#666', marginTop: '5px'}}>
                                Reported: {formatDate(t.createdAt)}<br/>
                                {t.resolvedAt && <>Resolved: {formatDate(t.resolvedAt)} by {t.resolvedBy || 'Unknown'}</>}
                            </div>
                        </div>
                    ))
                )}
            </div>

            <button style={{marginTop:'15px', background:'none', border:'none', textDecoration:'underline', cursor:'pointer', color:'#666', width: '100%'}} onClick={() => setSelectedRoom(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
