import { writeBatch, doc } from "firebase/firestore"; 
import { db } from "./firebase";

export const seedDatabase = async () => {
  const batch = writeBatch(db);
  
  // Define your rooms exactly as per your image
  const rooms = [
    // LEVEL 1 (14 Rooms)
    { id: "101", type: "DLXR", floor: 1 }, { id: "102", type: "SUIT", floor: 1 },
    { id: "103", type: "DLXR", floor: 1 }, { id: "105", type: "STDT", floor: 1 },
    { id: "108", type: "SUIT", floor: 1 }, { id: "109", type: "MAINT", floor: 1 }, // Permanent Maintenance?
    { id: "110", type: "DLXR", floor: 1 }, { id: "111", type: "DLXR", floor: 1 },
    { id: "112", type: "SUIT", floor: 1 }, { id: "113", type: "STDT", floor: 1 },
    { id: "115", type: "DLXR", floor: 1 }, { id: "116", type: "DLXR", floor: 1 },
    { id: "118", type: "DLXR", floor: 1 },

    // LEVEL 2 (16 Rooms)
    { id: "201", type: "SUIT", floor: 2 }, { id: "202", type: "SUIT", floor: 2 },
    { id: "203", type: "STDT", floor: 2 }, { id: "205", type: "SUIT", floor: 2 },
    { id: "206", type: "STDT", floor: 2 }, { id: "208", type: "STDT", floor: 2 },
    { id: "209", type: "SUIT", floor: 2 }, { id: "210", type: "SUIT", floor: 2 },
    { id: "211", type: "SUIT", floor: 2 }, { id: "212", type: "DLXM", floor: 2 },
    { id: "213", type: "DLXR", floor: 2 }, { id: "215", type: "SUIT", floor: 2 },
    { id: "216", type: "SUPK", floor: 2 }, { id: "218", type: "STDS", floor: 2 },
    { id: "219", type: "DLXR", floor: 2 }, { id: "220", type: "DLXR", floor: 2 },

    // LEVEL 3 (16 Rooms)
    { id: "301", type: "SUIT", floor: 3 }, { id: "302", type: "SUIT", floor: 3 },
    { id: "303", type: "STDT", floor: 3 }, { id: "305", type: "SUIT", floor: 3 },
    { id: "306", type: "STDT", floor: 3 }, { id: "308", type: "SUIT", floor: 3 },
    { id: "309", type: "SUIT", floor: 3 }, { id: "310", type: "SUIT", floor: 3 },
    { id: "311", type: "SUIT", floor: 3 }, { id: "312", type: "DLXR", floor: 3 },
    { id: "313", type: "DLXR", floor: 3 }, { id: "315", type: "SUIT", floor: 3 },
    { id: "316", type: "STDT", floor: 3 }, { id: "318", type: "DLXR", floor: 3 },
    { id: "319", type: "DLXR", floor: 3 }, { id: "320", type: "DLXR", floor: 3 },
  ];

  rooms.forEach((room) => {
    // Set default status to 'vacant' (Green)
    const docRef = doc(db, "rooms", room.id);
    batch.set(docRef, { ...room, status: 'vacant' }); 
  });

  await batch.commit();
  alert("Database Seeded with 46 Rooms!");
};