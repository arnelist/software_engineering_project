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
import AnimatedScreen from "../components/AnimatedScreen";
import colors from "../theme/colors";
import { Modal } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { buildCheckinQrValue } from "../utils/qr";

export default function TrainerReservationsScreen({ navigation }) {
    const userId = auth.currentUser?.uid;

    const [trainerId, setTrainerId] = useState(null);
    const [loadingTrainer, setLoadingTrainer] = useState(true);

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);
    const [qrReservation, setQrReservation] = useState(null);

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
                <ActivityIndicator color={colors.accent} />
            </View>
        );
    }

    return (
        <AnimatedScreen style={styles.screen}>
            <View style={styles.topBar}>
                <Text numberOfLines={1} style={styles.userEmail}>
                    {auth.currentUser?.email ?? ''}
                </Text>
            </View>

            <Text style={styles.title}>Mano rezervacijos</Text>

            {loading ? (
                <View style={{ paddingTop: 24 }}>
                    <ActivityIndicator color={colors.accent} />
                </View>
            )   : (
                <>
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
                                        <View style={styles.statusRow}>
                                            <Text style={styles.meta}>Statusas: {statusLt}</Text>
                    
                                            {item.status === "checkedIn" && (
                                                <View style={styles.badgeSuccess}>
                                                    <Text style={[styles.badgeSuccess, { marginLeft: 10}]}>✅ Atvyko</Text>
                                                </View>
                                            )}
                                        </View>
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

                                    {item.status === "confirmed" && (
                                        <Pressable
                                            style={[styles.btn, { marginLeft: 10 }]}
                                            onPress={() => setQrReservation(item)}
                                        >
                                            <Text style={styles.btnText}>Rodyti QR</Text>
                                        </Pressable>
                                    )}
                                </View>
                            );
                        }}
                    />

                    <Modal
                        visible={!!qrReservation}
                        transparent
                        animationType="fade"
                        onRequestClose={() => setQrReservation(null)}
                        >
                        <View style={styles.modalBackdrop}>
                            <View style={styles.modalCard}>
                            <Text style={styles.modalTitle}>Check-in QR</Text>

                            {qrReservation && (
                                <View style={{ padding: 12, backgroundColor: "white", borderRadius: 12 }}>
                                <QRCode value={buildCheckinQrValue(qrReservation.id)} size={220} />
                                </View>
                            )}

                            <Text style={styles.modalHint}>
                                Klientas nuskenuoja šitą QR savo programėlėje.
                            </Text>

                            <Pressable style={[styles.footerBtn, { width: "100%", marginTop: 12 }]} onPress={() => setQrReservation(null)}>
                                <Text style={styles.footerBtnText}>Uždaryti</Text>
                            </Pressable>
                            </View>
                        </View>
                    </Modal>
                </>
            )}

            <View style={styles.footer}>
                    <Pressable 
                        style={styles.footerBtn} 
                        onPress={() => loadReservations(trainerId)
                    }>
                        <Text style={styles.footerBtnText}>Atnaujinti</Text>
                    </Pressable>

                <Pressable
                    style={styles.footerBtn}
                    onPress={() => navigation.navigate("TrainerTimeslots")}>
                        <Text style={styles.footerBtnText}>Laikai</Text>
                    </Pressable>

                    <Pressable 
                        style={[styles.footerBtn, styles.logoutBtn]}
                        onPress={onLogout}
                    >
                        <Text style={styles.footerBtnText}>Atsijungti</Text>
                    </Pressable>
                </View>
        </AnimatedScreen>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16, paddingTop: 12 },
    topBar: { paddingTop: 30, paddingBottom: 12, flexDirection: "row", alignItems: "center", gap: 10 },
    userEmail: { flex: 1, color: colors.muted, fontSize: 12 },
    topActions: { flexDirection: "row", gap: 8 },
    title: { fontSize: 22, fontWeight: "900", marginTop: 4, marginBottom: 12, color: colors.text },
    card: {
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        borderRadius: 14,
        padding: 12,
        marginBottom: 10,
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
    },
    time: { fontWeight: "900", color: colors.text },
    meta: { marginTop: 6, fontSize: 12, color: colors.muted },
    actions: { gap: 8 },
    btn: {
        borderWidth: 1,
        borderColor: colors.accent,
        backgroundColor: colors.accent,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
    },
    btnText: { fontSize: 12, fontWeight: "900", color: "#0b0c10" },
    empty: { paddingVertical: 14, color: colors.muted },
    footer: {
        position: "absolute",
        bottom: 30,
        left: 16,
        right: 16,
        flexDirection: "row",
        gap: 10,
    },
    footerBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: colors.cardElevated,
        alignItems: "center",
        borderWidth: 1,
        borderColor: colors.border,
    },
    logoutBtn: { backgroundColor: "#20141a", borderColor: "#fca5a5" },
    footerBtnText: { fontWeight: "800", color: colors.text },
    modalBackdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.6)",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
    },
    modalCard: {
        width: "100%",
        maxWidth: 420,
        backgroundColor: colors.card,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 16,
        alignItems: "center",
    },
    modalTitle: {
        color: colors.text,
        fontSize: 18,
        fontWeight: "900",
        marginBottom: 12,
    },
    modalHint: {
        color: colors.muted,
        marginTop: 10,
        textAlign: "center",
    },
    statusRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
    },
    badgeSuccess: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.cardElevated,
    },
    badgeText: {
        color: colors.text,
        fontWeight: "900",
        fontSize: 12,
    },
});