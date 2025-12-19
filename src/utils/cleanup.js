import { collection, query, where, getDocs, writeBatch, serverTimestamp } from "firebase/firestore";
import { db } from "../services/firebase";

function todayStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export async function expirePastFreeslots(trainerId) {
    const t = todayStr();

    const q = query(
        collection(db, 'timeslots'),
        where('trainerId', '==', trainerId),
        where('status', '==', 'free'),
        where('date', '<', t)
    );

    const snap = await getDocs(q);
    if (snap.empty) return 0;

    const batch = writeBatch(db);
    snap.docs.forEach((d) => {
        batch.update(d.ref, {
            status: 'expired',
            expiredAt: serverTimestamp(),
        });
    });
    
    await batch.commit();
    return snap.size;
}