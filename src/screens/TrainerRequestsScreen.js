import { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
} from "react-native";
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

export default function TrainerRequestsScreen({ navigation }) {
    const userId = auth.currentUser?.uid;

    const [trainerId, setTrainerId] = useState(null);
    const [loadingTrainer, setLoadingTrainer] = useState(true);

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    const [processingId, setProcessingId] = useState(null);

    useEffect(() => {
        const loadTrainer = async () => {
            if (!userId) return;

            try {
                setLoadingTrainer(true);

                const qT = query(
                    collection(db, "trainers"), 
                    where("userId", "==", userId),
                )
                const snapT = await getDocs(qT);

                if(snapT.empty) {
                    setTrainerId(null);
                    Alert.alert(
                        "Ne treneris",
                        "Šis naudotojas neturi trenerio profilio (trainers.userId nesutampa)."
                    );
                    return;
                }

                const trainerDoc = snapT.docs[0];
                setTrainerId(trainerId.id);
            }   catch (e) {
                console.log("LOAD TRAINER ERROR: ", e);
                Alert.alert("Klaida", "Nepavyko nustatyti trenerio profilio.");
            }   finally {
                setLoadingTrainer(false);
            }
        };

        loadTrainer();
    }, [userId]);

    const loadRequests = async (tId) => {
        if (!tId) return;

        try {
            setLoading(true);

            const qR = query(
                collection(db, 'reservations'),
                where("trainerId", "==", tId),
                where("status", "==", "pending"),
                orderBy("createdAt", "desc"),
            );

            const snap = await getDocs(qR);
            const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            setItems(list);
        }   catch (e) {
            console.log("LOAD REQUESTS ERROR:", e);
            Alert.alert("Klaida", "Nepavyko užkrauti užklausų. Gali reikėti Firestore index.");
        }   finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (trainerId) loadRequests(trainerId);
    }, [trainerId]);

    const confirmReservation = async (r) => {
        try {
            setProcessingId(r.id);

            await updateDoc(doc(db, 'reservations', r.id), {
                status: 'confirmed',
            });

            setItems((prev) => prev.filter((x) => x.id !== r.id));

            Alert.alert("Patvirtinta", "Rezervacija patvirtinta.");
        }   catch (e) {
            console.log("CONFIRM ERROR", e);
            console.log("LOAD REQUESTS ERROR:", e);
            Alert.alert("Klaida", "Nepavyko užkrauti užklausų. Gali reikėti Firestore index.");
        }   finally {
            setProcessingId(null);
        }
    };

    const rejectReservation = async (r) => {
        Alert.alert(
           "Atmesti rezervaciją?",
            "Laikas bus atlaisvintas (timeslot -> free).",  
            [
                { text: "Ne", style: "cancel"},
                {
                    text: "Taip", 
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setProcessingId(r.id);

                            await updateDoc(doc(db, 'reservations', r.id), {
                                status: 'rejected',
                            });

                            if (r.slotId) {
                                await updateDoc(doc(db, 'timeslots', r.slotId), {
                                    status: 'free',
                                });
                            }

                            setItems((prev) => prev.filter((x) => x.id !== r.id));

                            Alert.alert("Atmesta", "Rezervacija atmesta.");
                        }   catch (e) {
                            console.log("REJECT ERROR:", e);
                            Alert.alert("Klaida", "Nepavyko atmesti rezervacijos.");
                            } finally {
                            setProcessingId(null);
                        }
                    },
                },
            ]
        );
    };

    if (loadingTrainer) {
        return (
            <View style={[styles.screen, { paddingTop: 30 }]}>
                <ActivityIndicator />
            </View>
        );
    }

    return (
        <View style={styles.screen}>
            <View style={styles.headerRow}>
                <Pressable onPress={() => navigation.goBack()}>
                    <Text style={styles.back}>← Atgal</Text>
                </Pressable>
                <Text style={styles.title}>Užklausos</Text>
                <Pressable onPress={() => loadRequests(trainerId)}>
                    <Text style={styles.refresh}>Atnaujinti</Text>
                </Pressable>
            </View>

            {!trainerId ? (
                <Text style={styles.empty}>
                    Šis naudotojas neturi trenerio profilio (trainers.userId).
                </Text>
            )   : (
                <FlatList
                    data={items}
                    keyExtractor={(i) => i.id}
                    contentContainerStyle={{ paddingBottom: 24 }}
                    ListEmptyComponent={
                        <Text style={styles.empty}>Naujų užklausų nėra.</Text>
                    }
                    renderItem={({ item }) => {
                        const isBusy = processingId === item.id;

                        return (
                            <View style={styles.card}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.time}>
                                        {item.date ?? "-"} • {item.start ?? "--:--"}–{item.end ?? "--:--"}
                                    </Text>
                                    <Text style={styles.meta}>
                                        Statusas: {RESERVATION_STATUS_LT[item.status] ?? item.status}
                                    </Text>
                                    <Text style={styles.metaSmall}>
                                        userId: {item.userId}
                                    </Text>
                                </View>

                                <View style={styles.actions}>
                                    <Pressable
                                        disabled={isBusy}
                                        onPress={() => confirmReservation(item)}
                                        style={[styles.btn, isBusy && { opacity: 0.6 }]}
                                    >
                                        <Text style={styles.btnText}>Patvirtinti</Text>
                                    </Pressable>

                                    <Pressable
                                        disabled={isBusy}
                                        onPress={() => rejectReservation(item)}
                                        style={[styles.btn, isBusy && { opacity: 0.6 }]}
                                    >
                                        <Text style={styles.btnText}>Atmesti</Text>
                                    </Pressable>
                                </View>
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
    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    back: { color: "#111827", fontWeight: "800" },
    title: { fontSize: 16, fontWeight: "900", color: "#111827" },
    refresh: { color: "#111827", fontWeight: "800" },
    card: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    },
    time: { fontWeight: "900", color: "#111827" },
    meta: { marginTop: 6, fontSize: 12, color: "#6b7280" },
    metaSmall: { marginTop: 6, fontSize: 10, color: "#9ca3af" },
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