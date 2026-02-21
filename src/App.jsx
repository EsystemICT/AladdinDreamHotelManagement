import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc, serverTimestamp, query, orderBy, where, getDocs, limit, writeBatch } from 'firebase/firestore';
import './App.css';

// ICONS & TABS
const ICONS = { 
  ROOMS: { icon: "fa-solid fa-bed", label: "Rooms" },
  TICKETS: { icon: "fa-solid fa-wrench", label: "Tickets" },
  ITEMS: { icon: "fa-solid fa-boxes-stacked", label: "Item Request" },
  REQ: { icon: "fa-solid fa-paper-plane", label: "Request Staff" },
  SHIFT: { icon: "fa-solid fa-clock", label: "My Shift" },
  CLAIMS: { icon: "fa-solid fa-calendar-check", label: "Claim Days" }
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
  const [claimDays, setClaimDays] = useState([]);

  // UI
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [roomSearch, setRoomSearch] = useState('');
  const [staffModal, setStaffModal] = useState(null);
  const [rejectModal, setRejectModal] = useState({ show: false, reqId: null });
  const [rejectReason, setRejectReason] = useState('');
  
  // Requests UI
  const [reqReceiver, setReqReceiver] = useState('');
  const [reqContent, setReqContent] = useState('');
  
  // Login UI
  const [loginId, setLoginId] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');

  // Forms UI
  const [lastClock, setLastClock] = useState(null);
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketSort, setTicketSort] = useState('date-desc');

  // Claim Days UI
  const [claimModal, setClaimModal] = useState(false);
  const [claimForm, setClaimForm] = useState({
    guestName: '',
    icNumber: '',
    contactNumber: '',
    bookingDate: '',
    roomType: '',
    payment: '',
    usedDates: [],
    balanceClaim: 0,
    recordedBy: ''
  });
  const [editingClaim, setEditingClaim] = useState(null);

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

    const qClaims = query(collection(db, "claimDays"), orderBy("createdAt", "desc"));
    const unsubClaims = onSnapshot(qClaims, (snap) => setClaimDays(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    return () => { unsubTickets(); unsubRequests(); unsubUsers(); unsubAtt(); unsubLeaves(); unsubInv(); unsubClaims(); };
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
    if (newPass === null) return; 
    if (newPass.length < 4) return alert("Password must be at least 4 characters long.");
    
    try {
        await updateDoc(doc(db, "users", staffDocId), { password: newPass });
        alert(`Password for ${staffName} updated successfully!`);
    } catch (error) {
        console.error("Error updating password:", error);
        alert("Failed to update password.");
    }
  };

  // --- CLAIM DAYS FUNCTIONS ---
  const handleAddClaim = async () => {
    if (!claimForm.guestName || !claimForm.icNumber || !claimForm.contactNumber) {
      alert('Please fill in guest details');
      return;
    }

    try {
      await addDoc(collection(db, "claimDays"), {
        ...claimForm,
        recordedBy: currentUser.name,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setClaimModal(false);
      resetClaimForm();
      alert('Claim day record added successfully!');
    } catch (error) {
      console.error("Error adding claim:", error);
      alert("Failed to add claim record");
    }
  };

  const handleUpdateClaim = async () => {
    if (!editingClaim) return;

    try {
      await updateDoc(doc(db, "claimDays", editingClaim), {
        ...claimForm,
        updatedAt: serverTimestamp()
      });
      setClaimModal(false);
      setEditingClaim(null);
      resetClaimForm();
      alert('Claim day record updated successfully!');
    } catch (error) {
      console.error("Error updating claim:", error);
      alert("Failed to update claim record");
    }
  };

  const handleDeleteClaim = async (claimId) => {
    if (!window.confirm('Are you sure you want to delete this claim record?')) return;
    
    try {
      await deleteDoc(doc(db, "claimDays", claimId));
      alert('Claim record deleted successfully!');
    } catch (error) {
      console.error("Error deleting claim:", error);
      alert("Failed to delete claim record");
    }
  };

  const openEditClaim = (claim) => {
    setClaimForm({
      guestName: claim.guestName,
      icNumber: claim.icNumber,
      contactNumber: claim.contactNumber,
      bookingDate: claim.bookingDate,
      roomType: claim.roomType,
      payment: claim.payment,
      usedDates: claim.usedDates || [],
      balanceClaim: claim.balanceClaim,
      recordedBy: claim.recordedBy
    });
    setEditingClaim(claim.id);
    setClaimModal(true);
  };

  const resetClaimForm = () => {
    setClaimForm({
      guestName: '',
      icNumber: '',
      contactNumber: '',
      bookingDate: '',
      roomType: '',
      payment: '',
      usedDates: [],
      balanceClaim: 0,
      recordedBy: ''
    });
    setEditingClaim(null);
  };

  const addUsedDate = () => {
    const date = prompt('Enter used date (e.g., 29/1/2026):');
    const roomType = prompt('Enter room type (e.g., deluxe, s/king):');
    const roomNumber = prompt('Enter room number (e.g., 115, 216):');
    const staff = prompt('Enter staff name (e.g., emma/alisya):');
    
    if (date && roomType && roomNumber && staff) {
      setClaimForm(prev => ({
        ...prev,
        usedDates: [...prev.usedDates, { date, roomType, roomNumber, staff }]
      }));
    }
  };

  const removeUsedDate = (index) => {
    setClaimForm(prev => ({
      ...prev,
      usedDates: prev.usedDates.filter((_, i) => i !== index)
    }));
  };

  // --- ITEM REQUEST FUNCTIONS ---
  const toggleItemCheck = async (itemId, currentChecked) => {
    try {
      await updateDoc(doc(db, "inventory", itemId), {
        checked: !currentChecked,
        checkedBy: !currentChecked ? currentUser.name : null,
        checkedAt: !currentChecked ? serverTimestamp() : null
      });
    } catch (error) {
      console.error("Error updating item:", error);
    }
  };

  // --- ADD PUBLIC ROOMS / STOREROOMS (ADMIN FUNCTION) ---
  const addPublicRooms = async () => {
    const floors = [1, 2, 3];
    const roomsPerFloor = 11;
    const batch = writeBatch(db);
    
    floors.forEach(floor => {
      for (let i = 1; i <= roomsPerFloor; i++) {
        const roomId = `${floor}${String(i).padStart(2, '0')}`;
        const roomRef = doc(db, "rooms", roomId);
        batch.set(roomRef, { 
          id: roomId, 
          status: 'vacant',
          type: 'public',
          floor: floor
        }, { merge: true });
      }
    });

    await batch.commit();
    alert("Public rooms added!");
  };

  const addStorerooms = async () => {
    const storerooms = ['SR01', 'SR02', 'SR03'];
    const batch = writeBatch(db);
    
    storerooms.forEach(sr => {
      const roomRef = doc(db, "rooms", sr);
      batch.set(roomRef, { 
        id: sr, 
        status: 'vacant',
        type: 'storeroom'
      }, { merge: true });
    });

    await batch.commit();
    alert("Storerooms added!");
  };

  // --- ROOM FUNCTIONS ---
  const updateRoomStatus = async (roomId, newStatus) => {
    await updateDoc(doc(db, "rooms", roomId), { status: newStatus });
    setSelectedRoom(null);
  };

  const reportIssue = async (roomId) => {
    const issue = prompt("Describe the maintenance issue:");
    if (!issue) return;
    
    await addDoc(collection(db, "tickets"), {
      roomId,
      issue,
      status: 'open',
      reportedBy: currentUser?.name || 'Guest',
      createdAt: serverTimestamp()
    });
    
    await updateDoc(doc(db, "rooms", roomId), { status: 'maintenance' });
    setSelectedRoom(null);
  };

  const resolveTicket = async (ticketId, roomId) => {
    await updateDoc(doc(db, "tickets", ticketId), {
      status: 'resolved',
      resolvedAt: serverTimestamp(),
      resolvedBy: currentUser.name
    });
    
    const openTickets = tickets.filter(t => t.roomId === roomId && t.status === 'open' && t.id !== ticketId);
    if (openTickets.length === 0) {
      await updateDoc(doc(db, "rooms", roomId), { status: 'vacant' });
    }
  };

  // --- REQUEST FUNCTIONS ---
  const sendRequest = async () => {
    if(!reqReceiver || !reqContent) { alert("Fill all fields"); return; }
    const receiver = users.find(u => u.name === reqReceiver);
    if(!receiver) { alert("Invalid receiver"); return; }
    
    await addDoc(collection(db, "requests"), {
      senderId: currentUser.userid,
      senderName: currentUser.name,
      receiverId: receiver.userid,
      receiverName: receiver.name,
      content: reqContent,
      status: 'pending',
      createdAt: serverTimestamp()
    });
    
    setReqReceiver('');
    setReqContent('');
    alert("Request sent!");
  };

  const acceptRequest = async (reqId) => {
    await updateDoc(doc(db, "requests", reqId), {
      status: 'accepted',
      respondedAt: serverTimestamp()
    });
  };

  const openRejectModal = (reqId) => {
    setRejectModal({ show: true, reqId });
    setRejectReason('');
  };

  const submitReject = async () => {
    if (!rejectReason.trim()) {
      alert("Please provide a reason");
      return;
    }

    await updateDoc(doc(db, "requests", rejectModal.reqId), {
      status: 'rejected',
      rejectReason: rejectReason,
      respondedAt: serverTimestamp()
    });

    setRejectModal({ show: false, reqId: null });
    setRejectReason('');
  };

  // --- SHIFT FUNCTIONS ---
  const clockIn = async () => {
    await addDoc(collection(db, "attendance"), {
      userId: currentUser.userid,
      userName: currentUser.name,
      type: 'in',
      timestamp: serverTimestamp()
    });
  };

  const clockOut = async () => {
    await addDoc(collection(db, "attendance"), {
      userId: currentUser.userid,
      userName: currentUser.name,
      type: 'out',
      timestamp: serverTimestamp()
    });
  };

  const applyLeave = async () => {
    const leaveType = prompt("Enter leave type (e.g., Sick, Annual, Emergency):");
    if(!leaveType) return;
    
    await addDoc(collection(db, "leaves"), {
      userId: currentUser.userid,
      userName: currentUser.name,
      type: leaveType,
      status: 'pending',
      createdAt: serverTimestamp()
    });
    
    alert("Leave application submitted!");
  };

  const handleLeave = async (leaveId, newStatus) => {
    await updateDoc(doc(db, "leaves", leaveId), {
      status: newStatus,
      reviewedAt: serverTimestamp()
    });
  };

  // --- INVENTORY FUNCTIONS ---
  const addInventoryItem = async () => {
    const itemName = prompt("Enter item name:");
    if (!itemName) return;
    
    const quantity = prompt("Enter quantity:");
    if (!quantity) return;

    await addDoc(collection(db, "inventory"), {
      name: itemName,
      quantity: parseInt(quantity),
      checked: false,
      checkedBy: null,
      checkedAt: null,
      addedBy: currentUser.name,
      createdAt: serverTimestamp()
    });
    
    alert("Item added to inventory!");
  };

  const deleteInventoryItem = async (itemId) => {
    if (window.confirm("Delete this item?")) {
      await deleteDoc(doc(db, "inventory", itemId));
    }
  };

  const updateInventoryQuantity = async (itemId, currentQty) => {
    const newQty = prompt("Enter new quantity:", currentQty);
    if (newQty === null) return;
    
    await updateDoc(doc(db, "inventory", itemId), {
      quantity: parseInt(newQty),
      updatedBy: currentUser.name,
      updatedAt: serverTimestamp()
    });
  };

  // --- FILTERING & SORTING ---
  const publicRooms = rooms.filter(r => r.type === 'public').sort((a, b) => {
    const aNum = parseInt(a.id);
    const bNum = parseInt(b.id);
    return aNum - bNum;
  });

  const storerooms = rooms.filter(r => r.type === 'storeroom').sort((a, b) => a.id.localeCompare(b.id));

  const openTickets = tickets.filter(t => t.status === 'open');

  const myRequests = requests.filter(r => r.receiverId === currentUser?.userid && r.status === 'pending');

  const filteredRooms = publicRooms.filter(r => r.id.includes(roomSearch));

  const processedTickets = tickets
    .filter(t => t.roomId?.toLowerCase().includes(ticketSearch.toLowerCase()))
    .sort((a, b) => {
      switch(ticketSort) {
        case 'date-asc': return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
        case 'date-desc': return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
        case 'room-asc': return (a.roomId || '').localeCompare(b.roomId || '');
        case 'room-desc': return (b.roomId || '').localeCompare(a.roomId || '');
        default: return 0;
      }
    });

  // --- LOGIN SCREEN ---
  if (!currentUser) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <i className="fa-solid fa-hotel"></i>
            <h1>Aladdin Dream Hotel</h1>
            <p>Staff Portal</p>
          </div>
          <form onSubmit={handleLogin}>
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
            {loginError && <p className="error-msg">{loginError}</p>}
            <button className="btn blue" style={{width:'100%', justifyContent:'center'}}>Login</button>
          </form>
        </div>
      </div>
    );
  }

  // --- MAIN APP ---
  return (
    <div className="app">
      {/* --- HEADER --- */}
      <div className="header">
        <div className="header-left">
          <i className="fa-solid fa-hotel"></i>
          <h1>Aladdin Dream</h1>
        </div>
        <div className="header-center">
          <div className="time-display">{currentTime.toLocaleTimeString('en-MY', {hour: '2-digit', minute: '2-digit', second: '2-digit'})}</div>
          <div className="date-display">{currentTime.toLocaleDateString('en-MY', {weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'})}</div>
        </div>
        <div className="header-right">
          <span className="user-name">{currentUser.name}</span>
          <button className="btn grey" onClick={() => setShowPasswordModal(true)}><i className="fa-solid fa-key"></i></button>
          <button className="btn red" onClick={handleLogout}><i className="fa-solid fa-right-from-bracket"></i></button>
        </div>
      </div>

      {/* --- NAVBAR --- */}
      <div className="navbar">
        {Object.entries(ICONS).map(([key, { icon, label }]) => {
          if (key === 'CLAIMS' && currentUser.role !== 'admin') return null;
          return (
            <button
              key={key}
              className={`nav-item ${view === key ? 'active' : ''}`}
              onClick={() => setView(key)}
            >
              <i className={icon}></i>
              <span>{label}</span>
              {key === 'TICKETS' && openTickets.length > 0 && <span className="badge">{openTickets.length}</span>}
              {key === 'REQ' && myRequests.length > 0 && <span className="badge">{myRequests.length}</span>}
            </button>
          );
        })}
        {currentUser.role === 'admin' && (
          <button className={`nav-item ${view === 'ADMIN' ? 'active' : ''}`} onClick={() => setView('ADMIN')}>
            <i className="fa-solid fa-user-shield"></i>
            <span>Admin</span>
          </button>
        )}
      </div>

      {/* --- ROOMS VIEW --- */}
      {view === 'ROOMS' && (
        <div className="content">
          <div className="floor-section">
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px'}}>
              <h2 className="floor-title"><i className="fa-solid fa-bed"></i> Guest Rooms</h2>
              <input
                className="search-input"
                placeholder="Search room..."
                value={roomSearch}
                onChange={e => setRoomSearch(e.target.value)}
              />
            </div>
            {[1, 2, 3].map(floor => (
              <div key={floor}>
                <h3 style={{fontSize:'1rem', color:'#666', marginTop:'20px', marginBottom:'10px'}}>Floor {floor}</h3>
                <div className="room-grid">
                  {filteredRooms.filter(r => r.floor === floor).map(room => (
                    <div
                      key={room.id}
                      className={`room-card ${getStatusColor(room.status)}`}
                      onClick={() => setSelectedRoom(room)}
                    >
                      <div className="room-number">{room.id}</div>
                      <div className="room-status">{room.status}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="floor-section">
            <h2 className="floor-title"><i className="fa-solid fa-warehouse"></i> Storerooms</h2>
            <div className="room-grid">
              {storerooms.map(room => (
                <div
                  key={room.id}
                  className={`room-card ${getStatusColor(room.status)}`}
                  onClick={() => setSelectedRoom(room)}
                >
                  <div className="room-number">{room.id}</div>
                  <div className="room-status">{room.status}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- TICKETS VIEW --- */}
      {view === 'TICKETS' && (
        <div className="content">
          <div className="floor-section">
            <h2 className="floor-title"><i className="fa-solid fa-wrench"></i> Open Tickets ({openTickets.length})</h2>
            {openTickets.length === 0 ? (
              <p style={{textAlign:'center', color:'#999', padding:'40px'}}>No open tickets</p>
            ) : (
              <div className="ticket-list">
                {openTickets.map(ticket => (
                  <div key={ticket.id} className="ticket-card">
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'start'}}>
                      <div>
                        <h3>Room {ticket.roomId}</h3>
                        <p>{ticket.issue}</p>
                        <small>Reported by {ticket.reportedBy} on {formatDate(ticket.createdAt)}</small>
                      </div>
                      <button
                        className="btn green"
                        onClick={() => resolveTicket(ticket.id, ticket.roomId)}
                      >
                        <i className="fa-solid fa-check"></i> Resolve
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- ITEM REQUEST VIEW --- */}
      {view === 'ITEMS' && (
        <div className="content">
          <div className="floor-section">
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px'}}>
              <h2 className="floor-title"><i className="fa-solid fa-boxes-stacked"></i> Item Requests</h2>
              {currentUser.role === 'admin' && (
                <button className="btn blue" onClick={addInventoryItem}>
                  <i className="fa-solid fa-plus"></i> Add Item
                </button>
              )}
            </div>
            <div className="inventory-grid">
              {inventory.map(item => (
                <div key={item.id} className="inventory-card">
                  <div className="inventory-header">
                    <div>
                      <h3>{item.name}</h3>
                      <p className="inventory-qty">Quantity: {item.quantity}</p>
                    </div>
                    <div style={{display:'flex', gap:'5px', alignItems:'center'}}>
                      <input
                        type="checkbox"
                        checked={item.checked || false}
                        onChange={() => toggleItemCheck(item.id, item.checked)}
                        style={{width:'20px', height:'20px', cursor:'pointer'}}
                      />
                    </div>
                  </div>
                  {item.checked && item.checkedBy && (
                    <div style={{fontSize:'0.75rem', color:'#10b981', marginTop:'5px'}}>
                      ✓ Checked by {item.checkedBy}
                      {item.checkedAt && ` on ${formatDate(item.checkedAt)}`}
                    </div>
                  )}
                  <div style={{fontSize:'0.7rem', color:'#999', marginTop:'8px'}}>
                    Added by {item.addedBy || 'Unknown'}
                  </div>
                  {currentUser.role === 'admin' && (
                    <div style={{display:'flex', gap:'5px', marginTop:'10px'}}>
                      <button 
                        className="btn grey" 
                        style={{flex:1, fontSize:'0.75rem', padding:'5px'}}
                        onClick={() => updateInventoryQuantity(item.id, item.quantity)}
                      >
                        <i className="fa-solid fa-edit"></i> Edit Qty
                      </button>
                      <button 
                        className="btn red" 
                        style={{flex:1, fontSize:'0.75rem', padding:'5px'}}
                        onClick={() => deleteInventoryItem(item.id)}
                      >
                        <i className="fa-solid fa-trash"></i> Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- REQUEST STAFF VIEW --- */}
      {view === 'REQ' && (
        <div className="content">
          <div className="floor-section">
            <h2 className="floor-title"><i className="fa-solid fa-paper-plane"></i> Send Request</h2>
            <div className="request-form">
              <select value={reqReceiver} onChange={e => setReqReceiver(e.target.value)}>
                <option value="">Select Staff</option>
                {users.filter(u => u.userid !== currentUser.userid).map(u => (
                  <option key={u.userid} value={u.name}>{u.name}</option>
                ))}
              </select>
              <textarea
                placeholder="Write your request..."
                value={reqContent}
                onChange={e => setReqContent(e.target.value)}
                rows="4"
              />
              <button className="btn blue" onClick={sendRequest} style={{justifyContent:'center'}}>
                <i className="fa-solid fa-paper-plane"></i> Send Request
              </button>
            </div>
          </div>

          <div className="floor-section">
            <h2 className="floor-title"><i className="fa-solid fa-inbox"></i> Incoming Requests ({myRequests.length})</h2>
            {myRequests.length === 0 ? (
              <p style={{textAlign:'center', color:'#999', padding:'40px'}}>No pending requests</p>
            ) : (
              <div className="request-list">
                {myRequests.map(req => (
                  <div key={req.id} className="request-card">
                    <div style={{marginBottom:'10px'}}>
                      <strong>{req.senderName}</strong>
                      <small style={{marginLeft:'10px', color:'#999'}}>{formatTime(req.createdAt)}</small>
                    </div>
                    <p style={{marginBottom:'15px'}}>{req.content}</p>
                    <div style={{display:'flex', gap:'10px'}}>
                      <button className="btn green" onClick={() => acceptRequest(req.id)} style={{flex:1, justifyContent:'center'}}>
                        <i className="fa-solid fa-check"></i> Accept
                      </button>
                      <button className="btn red" onClick={() => openRejectModal(req.id)} style={{flex:1, justifyContent:'center'}}>
                        <i className="fa-solid fa-times"></i> Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="floor-section">
            <h2 className="floor-title"><i className="fa-solid fa-clock-rotate-left"></i> My Sent Requests</h2>
            <div className="request-list">
              {requests.filter(r => r.senderId === currentUser.userid).map(req => (
                <div key={req.id} className="request-card">
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'start', marginBottom:'10px'}}>
                    <div>
                      <strong>To: {req.receiverName}</strong>
                      <small style={{marginLeft:'10px', color:'#999'}}>{formatTime(req.createdAt)}</small>
                    </div>
                    <span className={`req-status status-${req.status}`}>{req.status}</span>
                  </div>
                  <p>{req.content}</p>
                  {req.status === 'rejected' && req.rejectReason && (
                    <p style={{marginTop:'10px', padding:'10px', background:'#fee', borderLeft:'3px solid #dc3545', fontSize:'0.85rem'}}>
                      <strong>Reason:</strong> {req.rejectReason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- MY SHIFT VIEW --- */}
      {view === 'SHIFT' && (
        <div className="content">
          <div className="floor-section">
            <h2 className="floor-title"><i className="fa-solid fa-clock"></i> My Attendance</h2>
            <div className="shift-controls">
              {!lastClock || lastClock.type === 'out' ? (
                <button className="btn green" onClick={clockIn} style={{justifyContent:'center', fontSize:'1.2rem', padding:'20px'}}>
                  <i className="fa-solid fa-arrow-right-to-bracket"></i> Clock In
                </button>
              ) : (
                <button className="btn red" onClick={clockOut} style={{justifyContent:'center', fontSize:'1.2rem', padding:'20px'}}>
                  <i className="fa-solid fa-arrow-right-from-bracket"></i> Clock Out
                </button>
              )}
              <button className="btn blue" onClick={applyLeave} style={{justifyContent:'center', fontSize:'1.2rem', padding:'20px'}}>
                <i className="fa-solid fa-calendar-days"></i> Apply Leave
              </button>
            </div>

            <h3 style={{fontSize:'1rem', marginTop:'30px', marginBottom:'10px'}}>My Attendance History</h3>
            <div className="attendance-list">
              {attendance.filter(a => a.userId === currentUser.userid).map(a => (
                <div key={a.id} className="attendance-record">
                  <span className={`attendance-type ${a.type}`}>{a.type.toUpperCase()}</span>
                  <span>{formatDate(a.timestamp)} {formatTime(a.timestamp)}</span>
                </div>
              ))}
            </div>

            <h3 style={{fontSize:'1rem', marginTop:'30px', marginBottom:'10px'}}>My Leave Applications</h3>
            <div className="leave-list">
              {leaves.filter(l => l.userId === currentUser.userid).map(l => (
                <div key={l.id} className="leave-record">
                  <div>
                    <strong>{l.type}</strong>
                    <small style={{marginLeft:'10px', color:'#999'}}>{formatDate(l.createdAt)}</small>
                  </div>
                  <span className={`req-status status-${l.status}`}>{l.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- CLAIM DAYS VIEW (ADMIN ONLY) --- */}
      {view === 'CLAIMS' && currentUser.role === 'admin' && (
        <div className="content">
          <div className="floor-section">
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px'}}>
              <h2 className="floor-title"><i className="fa-solid fa-calendar-check"></i> Guest Claim Days</h2>
              <button className="btn blue" onClick={() => { resetClaimForm(); setClaimModal(true); }}>
                <i className="fa-solid fa-plus"></i> Add Claim Record
              </button>
            </div>
            
            <div className="claims-grid">
              {claimDays.map(claim => (
                <div key={claim.id} className="claim-card">
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'start', marginBottom:'10px'}}>
                    <div>
                      <h3>{claim.guestName}</h3>
                      <p style={{fontSize:'0.85rem', color:'#666'}}>IC: {claim.icNumber}</p>
                      <p style={{fontSize:'0.85rem', color:'#666'}}>Contact: {claim.contactNumber}</p>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:'1.2rem', fontWeight:'bold', color: claim.balanceClaim === 0 ? '#10b981' : '#ef4444'}}>
                        Balance: {claim.balanceClaim} days
                      </div>
                    </div>
                  </div>
                  
                  <div style={{background:'#f8f9fa', padding:'10px', borderRadius:'5px', marginBottom:'10px'}}>
                    <p style={{fontSize:'0.85rem'}}><strong>Booking Date:</strong> {claim.bookingDate}</p>
                    <p style={{fontSize:'0.85rem'}}><strong>Room Type:</strong> {claim.roomType}</p>
                    <p style={{fontSize:'0.85rem'}}><strong>Payment:</strong> RM{claim.payment}</p>
                  </div>

                  {claim.usedDates && claim.usedDates.length > 0 && (
                    <div style={{marginBottom:'10px'}}>
                      <strong style={{fontSize:'0.85rem'}}>Used Dates:</strong>
                      {claim.usedDates.map((used, idx) => (
                        <div key={idx} style={{fontSize:'0.8rem', padding:'5px 0', borderBottom:'1px dashed #eee'}}>
                          {used.date} - {used.roomType} {used.roomNumber} ({used.staff})
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{fontSize:'0.7rem', color:'#999', marginTop:'10px', paddingTop:'10px', borderTop:'1px solid #eee'}}>
                    Recorded by {claim.recordedBy} on {formatDate(claim.createdAt)}
                  </div>

                  <div style={{display:'flex', gap:'5px', marginTop:'10px'}}>
                    <button 
                      className="btn blue" 
                      style={{flex:1, fontSize:'0.8rem', padding:'8px'}}
                      onClick={() => openEditClaim(claim)}
                    >
                      <i className="fa-solid fa-edit"></i> Edit
                    </button>
                    <button 
                      className="btn red" 
                      style={{flex:1, fontSize:'0.8rem', padding:'8px'}}
                      onClick={() => handleDeleteClaim(claim.id)}
                    >
                      <i className="fa-solid fa-trash"></i> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- ADMIN VIEW --- */}
      {view === 'ADMIN' && currentUser.role === 'admin' && (
        <div className="content">
          <div className="floor-section">
            <h2 className="floor-title"><i className="fa-solid fa-user-shield"></i> Admin Controls</h2>
            <div style={{display:'flex', gap:'10px', flexWrap:'wrap'}}>
              <button className="btn blue" onClick={addPublicRooms}>Add All Public Rooms</button>
              <button className="btn blue" onClick={addStorerooms}>Add Storerooms</button>
            </div>
          </div>

          <div className="floor-section">
            <h2 className="floor-title"><i className="fa-solid fa-users"></i> Staff Management</h2>
            <div className="admin-table-container">
              <table>
                <thead>
                  <tr><th>Name</th><th>User ID</th><th>Role</th><th>Last Clock</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {users.map(u => {
                      const lastAtt = attendance.find(a => a.userId === u.userid);
                      return (
                          <tr key={u.userid}>
                              <td><strong>{u.name}</strong></td>
                              <td>{u.userid}</td>
                              <td><span style={{padding:'3px 8px', background: u.role==='admin'?'#3b82f6':'#10b981', color:'white', borderRadius:'4px', fontSize:'0.75rem'}}>{u.role}</span></td>
                              <td>{lastAtt ? <><span style={{color: lastAtt.type==='in'?'green':'red', fontWeight:'bold'}}>{lastAtt.type.toUpperCase()}</span> {formatTime(lastAtt.timestamp)}</> : '-'}</td>
                              <td><button className="btn grey" onClick={() => setStaffModal(u)}>View</button></td>
                          </tr>
                      );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="floor-section">
            <h2 className="floor-title"><i className="fa-solid fa-calendar-days"></i> Leave Applications</h2>
            <div className="admin-table-container">
               <table>
                   <thead>
                       <tr><th>Staff</th><th>Type</th><th>Date</th><th>Status</th><th>Actions</th></tr>
                   </thead>
                   <tbody>
                       {leaves.map(l => (
                           <tr key={l.id}>
                               <td><strong>{l.userName}</strong></td>
                               <td>{l.type}</td>
                               <td>{formatDate(l.createdAt)}</td>
                               <td><span className={`req-status status-${l.status}`}>{l.status}</span></td>
                               <td>
                                   {l.status === 'pending' && (
                                       <div style={{display:'flex', gap:'5px'}}>
                                           <button className="btn green" onClick={() => handleLeave(l.id, 'approved')}>Approve</button>
                                           <button className="btn red" onClick={() => handleLeave(l.id, 'rejected')}>Reject</button>
                                       </div>
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
                  <tr><th>Room</th><th>Issue</th><th>Status</th><th>Reported By</th><th>Reported</th><th>Resolved</th><th>Resolved By</th></tr>
                </thead>
                <tbody>
                  {processedTickets.map(t => (
                    <tr key={t.id}>
                      <td><strong>{t.roomId}</strong></td>
                      <td>{t.issue}</td>
                      <td><span style={{fontWeight:'bold', color: t.status === 'open' ? '#ef4444' : '#10b981'}}>{t.status.toUpperCase()}</span></td>
                      <td>{t.reportedBy || '-'}</td>
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

      {/* --- CLAIM DAYS MODAL --- */}
      {claimModal && (
        <div className="modal-overlay" onClick={() => { setClaimModal(false); resetClaimForm(); }}>
          <div className="modal-content large-modal" onClick={e => e.stopPropagation()}>
            <h2>{editingClaim ? 'Edit' : 'Add'} Claim Day Record</h2>
            
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginTop:'15px'}}>
              <div>
                <label style={{fontSize:'0.85rem', color:'#666'}}>Guest Name</label>
                <input
                  value={claimForm.guestName}
                  onChange={e => setClaimForm({...claimForm, guestName: e.target.value})}
                  placeholder="Full Name"
                />
              </div>
              <div>
                <label style={{fontSize:'0.85rem', color:'#666'}}>IC Number</label>
                <input
                  value={claimForm.icNumber}
                  onChange={e => setClaimForm({...claimForm, icNumber: e.target.value})}
                  placeholder="IC/Passport No"
                />
              </div>
              <div>
                <label style={{fontSize:'0.85rem', color:'#666'}}>Contact Number</label>
                <input
                  value={claimForm.contactNumber}
                  onChange={e => setClaimForm({...claimForm, contactNumber: e.target.value})}
                  placeholder="Phone Number"
                />
              </div>
              <div>
                <label style={{fontSize:'0.85rem', color:'#666'}}>Booking Date</label>
                <input
                  value={claimForm.bookingDate}
                  onChange={e => setClaimForm({...claimForm, bookingDate: e.target.value})}
                  placeholder="Walk-in Date"
                />
              </div>
              <div>
                <label style={{fontSize:'0.85rem', color:'#666'}}>Room Type</label>
                <input
                  value={claimForm.roomType}
                  onChange={e => setClaimForm({...claimForm, roomType: e.target.value})}
                  placeholder="e.g., Deluxe, Suite"
                />
              </div>
              <div>
                <label style={{fontSize:'0.85rem', color:'#666'}}>Payment (RM)</label>
                <input
                  type="number"
                  value={claimForm.payment}
                  onChange={e => setClaimForm({...claimForm, payment: e.target.value})}
                  placeholder="550"
                />
              </div>
              <div>
                <label style={{fontSize:'0.85rem', color:'#666'}}>Balance Claim (Days)</label>
                <input
                  type="number"
                  value={claimForm.balanceClaim}
                  onChange={e => setClaimForm({...claimForm, balanceClaim: parseInt(e.target.value) || 0})}
                  placeholder="0"
                />
              </div>
            </div>

            <div style={{marginTop:'20px'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px'}}>
                <label style={{fontSize:'0.85rem', color:'#666', fontWeight:'bold'}}>Used Dates</label>
                <button className="btn blue" style={{fontSize:'0.75rem', padding:'5px 10px'}} onClick={addUsedDate}>
                  <i className="fa-solid fa-plus"></i> Add Date
                </button>
              </div>
              {claimForm.usedDates.length === 0 ? (
                <p style={{color:'#999', fontSize:'0.85rem', textAlign:'center', padding:'20px'}}>No dates added yet</p>
              ) : (
                <div style={{maxHeight:'200px', overflowY:'auto', border:'1px solid #eee', borderRadius:'5px', padding:'10px'}}>
                  {claimForm.usedDates.map((used, idx) => (
                    <div key={idx} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px', background:'#f8f9fa', marginBottom:'5px', borderRadius:'3px'}}>
                      <span style={{fontSize:'0.85rem'}}>
                        {used.date} - {used.roomType} {used.roomNumber} ({used.staff})
                      </span>
                      <button 
                        className="btn red" 
                        style={{fontSize:'0.7rem', padding:'3px 8px'}}
                        onClick={() => removeUsedDate(idx)}
                      >
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{display:'flex', gap:'10px', marginTop:'20px'}}>
              <button 
                className="btn grey" 
                style={{flex:1, justifyContent:'center'}} 
                onClick={() => { setClaimModal(false); resetClaimForm(); }}
              >
                Cancel
              </button>
              <button 
                className="btn blue" 
                style={{flex:1, justifyContent:'center'}} 
                onClick={editingClaim ? handleUpdateClaim : handleAddClaim}
              >
                {editingClaim ? 'Update' : 'Add'} Record
              </button>
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

                  <button onClick={() => setStaffModal(null)} className="btn grey" style={{width:'100%', marginTop:'10px', justifyContent:'center'}}>Close</button>
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
                                Reported by <b>{t.reportedBy || 'Unknown'}</b> on {formatDate(t.createdAt)}<br/>
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
