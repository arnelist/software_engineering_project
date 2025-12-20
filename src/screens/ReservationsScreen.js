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
import AnimatedScreen from "../components/AnimatedScreen";
import colors from "../theme/colors";

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
        <AnimatedScreen style={styles.screen}>
            <View style={styles.header}>
                <Pressable 
                    style={styles.outlineBtn}
                    onPress={() => navigation.goBack()}
                >
                    <Text style={styles.outlineBtnText}>← Atgal</Text>
                </Pressable>
                <Text style={styles.headerTitle}>Rezervacijos</Text>
                <Pressable
                    style={styles.outlineBtn} 
                    onPress={loadReservations}
                >
                    <Text style={styles.outlineBtnText}>Atnaujinti</Text>
                </Pressable>
            </View>

            {loading ? (
                <View style={{ paddingTop: 20 }}>
                    <ActivityIndicator color={colors.accent} />
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
        </AnimatedScreen>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16, paddingTop: 30 },
    header: { 
        flexDirection: "row", 
        alignItems: "center", 
        justifyContent: "space-between", 
        paddingVertical: 12,
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: "800",
        color: colors.text,
    },
    outlineBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
    },
    outlineBtnText: {
        fontSize: 12,
        fontWeight: "700",
        color: colors.accent,
    },
    title: { fontSize: 16, fontWeight: "900", color: colors.text },
    card: {
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        borderRadius: 14,
        padding: 12,
        marginBottom: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    time: { fontWeight: "900", color: colors.text },
    meta: { marginTop: 6, fontSize: 12, color: colors.muted },
    cancelBtn: {
        borderWidth: 1,
        borderColor: colors.accent,
        backgroundColor: colors.accent,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
    },
    cancelText: { fontWeight: "900", color: "#0b0c10", fontSize: 12 },
    empty: { paddingVertical: 14, color: colors.muted },
});
