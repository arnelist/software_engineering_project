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

export default function ReservationsScreen({ navigation }) {
    const userId = auth.currentUser?.uid;

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [cancellingId, setCancellingId] = useState(null);

    const loadReservations = async () => {
        if(!userId) return;
        
        try {
            setLoading(true);

            const q = query(
                collection(db, "reservations"),
                where("userId", "==", userId),
                orderBy("createdAt", "asc"),
            );

            const snap = await getDocs(q);
            const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            setItems(list);
        }   catch (e) {
            console.log("LOAD RESERVATIONS FAILED: ", e);
            Alert.alert("Klaida", "Nepavyko užkrauti rezervacijų.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadReservations();
    }, [userId]);

    const cancelReservation = async (r) => {
        if (!r || r.status !== 'pending') return;

        Alert.alert(
            "Atšaukti rezervaciją?",
            "Laikas bus atlaisvintas, o rezervacija pažymėta kaip atšaukta.",
            [
                { text: "Ne", style: "cancel" },
                {
                    text: "Taip",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setCancellingId(r.id);

                            await updateDoc(doc(db, "reservations", r.id), {
                                status: "cancelled",
                            });

                            if (r.slotId) {
                                await updateDoc(doc(db, "reservations", r.id), {
                                    status: "free",
                                });
                            }

                            setItems((prev) => 
                                prev.map((x) => (x.id === r.id ? { ...x, status: "cancelled" } : x))
                            );

                            Alert.alert("Atšaukta", "Rezervacija atšaukta.");
                        }   catch (e) {
                            console.log("CANCEL ERROR: ", e);
                            Alert.alertt("Klaida", "Nepavyko atšaukti rezervacijos.");
                        }   finally {
                            setCancellingId(null);
                        }
                    },
                },
            ]
        );
    };

    const renderItem = ({ item }) => {
        const statusLt = RESERVATION_STATUS_LT[item.status] ?? item.status ?? '';
        const canCancel = item.status === 'pending';
        const isCancelling = cancellingId === item.id;

        return (
            <View style={styles.card}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.time}>
                        {item.date ?? '-'} • {item.start ?? "--:--"}–{item.end ?? "--:--"}
                    </Text>
                    <Text style={styles.meta}>Statusas: {statusLt}</Text>
                </View>

                {canCancel && (
                    <Pressable
                        onPress={() => cancelReservation(item)}
                        disabled={isCancelling}
                        style={[styles.cancelBtn, isCancelling && {opacity: 0.6 }]}
                    >
                        <Text style={styles.cancelText}>
                            {isCancelling ? "..." : "Atšaukti"}
                        </Text>
                    </Pressable>
                )}
            </View>
        );
    };

    return (
        <View style={styles.screen}>
            <View style={styles.headerRow}>
                <Pressable onPress={() => navigation.goBack()}>
                    <Text style={styles.back}>← Atgal</Text>
                </Pressable>
                <Text style={styles.title}>Rezervacijos</Text>
                <Pressable onPress={loadReservations}>
                    <Text styl={styles.refresh}>Atnaujinti</Text>
                </Pressable>
            </View>

            {loading ? (
                <View style={{ paddingTop: 20 }}>
                    <ActivityIndicator />
                </View>
            )  : (
                <FlatList
                    data={items}
                    keyExtractor={(i) => i.id}
                    renderItem={renderItem}
                    contentContainerStyle={{ paddingBottom: 24 }}
                    ListEmptyComponent={
                        <Text style={styles.empty}>Rezervacijų nėra.</Text>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: "#fff", paddingHorizontal: 16, paddingTop: 12 },
    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    back: { color: "#111827", fontWeight: "700" },
    title: { fontSize: 16, fontWeight: "900", color: "#111827" },
    refresh: { color: "#111827", fontWeight: "700" },
    card: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    },
    time: { fontWeight: "900", color: "#111827" },
    meta: { marginTop: 6, fontSize: 12, color: "#6b7280" },
    cancelBtn: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    },
    cancelText: { fontWeight: "900", color: "#111827", fontSize: 12 },
    empty: { paddingVertical: 14, color: "#6b7280" },
});