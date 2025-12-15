import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
} from "react-native";
import { signOut } from "firebase/auth";
import { auth, db } from "../services/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  doc,
  updateDoc,
} from "firebase/firestore";
import { RESERVATION_STATUS_LT } from "../constants/statuses";

export default function TrainerReservationsScreen() {
    const userId = auth.currentUser?.uid;

    const [trainerId, setTrainerId] = useState(null);
    const [loadingTrainer, setLoadingTrainer] = useState(true);

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);

    useEffect(() => {
        const loadTrainer = async() => {
            if (!userId) return;
            try {
                setLoadingTrainer(true);

                const qT = query(collection(db, 'trainers'), where('userId', '==', userId));
                const snapT = await getDocs(qT);

                if (snapT.empty) {
                    setTrainerId(null);
                    Alert.alert("Klaida", "Nerastas trenerio profilis (trainers.userId");
                    return;
                }

                setTrainerId(snapT.docs[0].id);
            }   catch (e) {
                console.log("LOAD TRAINER ERROR:", e);
                Alert.alert("Klaida", "Nepavyko užkrauti trenerio profilio.");
            }   finally {
                setLoadingTrainer(false);
            }
        };

        loadTrainer();
    }, [userId]);

    const loadReservations = async (tId) => {
        if (!tId) return;
        try {
            setLoading(true);

            const qPending = query(
                collection(db, 'reservations'),
                where('trainerId', '==', tId),
                where('status', '==', 'pending'),
                orderBy("createdAt", 'desc')
            );

            const qConfirmed = query(
                collection(db, 'reservations'),
                where('trainerId', '==', tId),
                where('status', '==', 'confirmed'),
                orderBy("createdAt", 'desc')
            );

            const [snapP, snapC] = await Promise.all([getDocs(qPending), getDocs(qConfirmed)]);

            const list = [
                ...snapP.docs.map((d) => ({ id: d.id, ...d.data() })),
                ...snapC.docs.map((d) => ({ id: d.id, ...d.data() })),
            ];

            list.sort((a, b) => {
                const ta = a.createdAt?.seconds ?? 0;
                const tb = b.createdAt?.seconds ?? 0;
                return tb - ta;
            });

            setItems(list);
        }   catch (e) {
            console.log("LOAD TRAINER RESERVATIONS ERROR:", e);
            Alert.alert("Klaida", "Nepavyko užkrauti rezervacijų. Gali reikėti Firestore index.");
        }   finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (trainerId) loadReservations(trainerId);
    }, [trainerId]);

    const onLogout = async () => {
        await signOut(auth);
    };

    const confirmReservation = async (r) => {
        try {
            setProcessingId(r.id);
            await updateDoc(doc(db, 'reservations', r.id), { status: 'confirmed' });
            setItems((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: 'confirmed' } : x)));
        }   catch (e) {
            console.log("CONFIRM ERROR:", e);
            Alert.alert("Klaida", "Nepavyko patvirtinti.");
        }   finally {
            setProcessingId(null);
        }
    };

    const rejectReservation = async (r) => {
        Alert.alert("Atmesti rezervaciją?", "Laikas bus atlaisvintas.", [
            { text: "Ne", style: 'cancel' },
            {
                text: "Taip",
                style: 'destructive',
                onPress: async () => {
                    try {
                        setProcessingId(r.id);

                        await updateDoc(doc(db, 'reservations', r.id), { status: 'rejected' });

                        if (r.slotId) {
                            await updateDoc(doc(db, 'timeslots', r.slotId), { status: 'free' });
                        }

                        setItems((prev) => prev.filter((x) => x.id !== r.id));
                    }   catch (e) {
                        console.log("REJECT ERROR:", e);
                        Alert.alert("Klaida", "Nepavyko atmesti.");
                    }   finally {
                        setProcessingId(null);
                    }
                },
            },
        ]);
    };

    if (loadingTrainer) {
        return (
            <View style={[styles.screen, { paddingTop: 24 }]}>
                <ActivityIndicator />
            </View>
        );
    }

    return (
        <View style={styles.screen}>
            <View style={styles.topBar}>
                <Text numberOfLines={1} style={styles.userEmail}>
                    {auth.currentUser?.email ?? ''}
                </Text>

                <View style={styles.topActions}>
                    <Pressable 
                        style={styles.topBtn} 
                        onPress={() => loadReservations(trainerId)
                    }>
                        <Text style={styles.topBtnText}>Atnaujinti</Text>
                    </Pressable>

                    <Pressable 
                        style={styles.topBtn}
                        onPress={onLogout}
                    >
                        <Text style={styles.topBtnText}>Atsijungti</Text>
                    </Pressable>
                </View>
            </View>

            <Text style={styles.title}>Mano rezervacijos</Text>

            {loading ? (
                <View style={{ paddingTop: 24 }}>
                    <ActivityIndicator />
                </View>
            )   : (
                <FlatList
                    data={items}
                    keyExtractor={(i) => i.id}
                    contentContainerStyle={{ paddingBottom: 24 }}
                    ListEmptyComponent={
                        <Text style={styles.empty}>Rezervacijų nėra.</Text>
                    }
                    renderItem={({ item }) => {
                        const isBusy = processingId === item.id;
                        const statusLt = RESERVATION_STATUS_LT[item.status] ?? item.status;   
                    
                        return (
                            <View style={styles.card}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.time}>
                                        {item.date ?? "-"} • {item.start ?? "--:--"}–{item.end ?? "--:--"}
                                    </Text>
                                    <Text style={styles.meta}>Statusas: {statusLt}</Text>
                                </View>

                                {item.status === "pending" && (
                                    <View style={styles.actions}>
                                        <Pressable
                                            disabled={isBusy}
                                            style={[styles.btn, isBusy && { opacity: 0.6 }]}
                                            onPress={() => confirmReservation(item)}
                                        >
                                            <Text style={styles.btnText}>Patvirtinti</Text>
                                        </Pressable>

                                        <Pressable
                                            disabled={isBusy}
                                            style={[styles.btn, isBusy && { opacity: 0.6 }]}
                                            onPress={() => rejectReservation(item)}
                                        >
                                            <Text style={styles.btnText}>Atmesti</Text>
                                        </Pressable>
                                    </View>
                                )}
                            </View>
                        );
                    }}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: "#fff", paddingHorizontal: 16, paddingTop: 12 },
    topBar: { paddingTop: 8, paddingBottom: 12, flexDirection: "row", alignItems: "center", gap: 10 },
    userEmail: { flex: 1, color: "#6b7280", fontSize: 12 },
    topActions: { flexDirection: "row", gap: 8 },
    topBtn: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#f9fafb",
    },
    topBtnText: { fontSize: 12, color: "#111827", fontWeight: "800" },
    title: { fontSize: 22, fontWeight: "900", marginTop: 4, marginBottom: 12, color: "#111827" },
    card: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    },
    time: { fontWeight: "900", color: "#111827" },
    meta: { marginTop: 6, fontSize: 12, color: "#6b7280" },
    actions: { gap: 8 },
    btn: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    },
    btnText: { fontSize: 12, fontWeight: "900", color: "#111827" },
    empty: { paddingVertical: 14, color: "#6b7280" },
});
