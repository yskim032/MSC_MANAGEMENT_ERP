import { db } from './firebase-config';
import {
    collection,
    addDoc,
    getDocs,
    query,
    orderBy,
    limit,
    writeBatch,
    doc,
    deleteDoc,
    where
} from 'firebase/firestore';

export const logVesselActivity = async (vesselName, status) => {
    try {
        const docRef = await addDoc(collection(db, "vessel_logs"), {
            vesselName,
            status,
            timestamp: new Date()
        });
        return { id: docRef.id, error: null };
    } catch (error) {
        return { id: null, error: error.message };
    }
};

export const getRecentLogs = async (limitNum = 10) => {
    try {
        const q = query(collection(db, "vessel_logs"), orderBy("timestamp", "desc"), limit(limitNum));
        const querySnapshot = await getDocs(q);
        const logs = [];
        querySnapshot.forEach((doc) => {
            logs.push({ id: doc.id, ...doc.data() });
        });
        return { logs, error: null };
    } catch (error) {
        return { logs: [], error: error.message };
    }
};

// ERP Master Database Operations
export const saveErpRows = async (rows) => {
    const batch = writeBatch(db);
    try {
        rows.forEach(row => {
            const { id, isNew, displayId, ...dataToSave } = row;
            // If it has an id and it's not a local temporary number/string, it's an update
            // (Assuming Firestore IDs are strings of a certain format, but here we check if it exists in the row)
            if (id && isNew !== true) {
                const docRef = doc(db, "master_database", id);
                batch.update(docRef, dataToSave);
            } else {
                const docRef = doc(collection(db, "master_database"));
                batch.set(docRef, dataToSave);
            }
        });
        await batch.commit();
        return { error: null };
    } catch (error) {
        return { error: error.message };
    }
};

export const batchUpdateErpRows = async (updates) => {
    const batch = writeBatch(db);
    try {
        updates.forEach(update => {
            const { id, ...data } = update;
            if (id) {
                const docRef = doc(db, "master_database", id.toString());
                batch.update(docRef, data);
            }
        });
        await batch.commit();
        return { error: null };
    } catch (error) {
        return { error: error.message };
    }
};

export const getAllErpRows = async () => {
    try {
        const q = query(collection(db, "master_database"), orderBy("uploadDate", "asc"));
        const querySnapshot = await getDocs(q);
        const rows = [];
        querySnapshot.forEach((doc) => {
            rows.push({ id: doc.id, ...doc.data() });
        });
        return { rows, error: null };
    } catch (error) {
        return { rows: [], error: error.message };
    }
};

export const deleteErpRows = async (ids) => {
    const batch = writeBatch(db);
    try {
        ids.forEach(id => {
            const docRef = doc(db, "master_database", id);
            batch.delete(docRef);
        });
        await batch.commit();
        return { error: null };
    } catch (error) {
        return { error: error.message };
    }
};
// Vessel Schedule Operations
export const saveVesselSchedules = async (schedules) => {
    const batch = writeBatch(db);
    try {
        schedules.forEach(schedule => {
            const docRef = doc(collection(db, "vessel_schedules"));
            batch.set(docRef, { ...schedule, createdAt: new Date() });
        });
        await batch.commit();
        return { error: null };
    } catch (error) {
        return { error: error.message };
    }
};

export const getAllVesselSchedules = async () => {
    try {
        const q = query(collection(db, "vessel_schedules"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const schedules = [];
        querySnapshot.forEach((doc) => {
            schedules.push({ id: doc.id, ...doc.data() });
        });
        return { schedules, error: null };
    } catch (error) {
        return { schedules: [], error: error.message };
    }
};

export const clearVesselSchedulesByPort = async (port) => {
    try {
        const q = query(collection(db, "vessel_schedules"), where("port", "==", port));
        const querySnapshot = await getDocs(q);
        const batch = writeBatch(db);
        querySnapshot.forEach((doc) => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        return { error: null };
    } catch (error) {
        return { error: error.message };
    }
};
