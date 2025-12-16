import { cloneElement, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { signOut } from "firebase/auth";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { auth, db } from "../services/firebase";

export default function HomeScreen({ navigation }) {
    const userEmail = auth.currentUser?.email ?? '';

    const [gyms, setGyms] = useState([]);
    const [loadingGyms, setLoadingGyms] = useState(true);

    const [expandedGymIds, setExpandedGymIds] = useState(() => new Set());
    const [trainersByGym, setTrainersByGym] = useState({});
    const [loadingTrainersGymId, setLoadingTrainersGymId] = useState({});

    useEffect(() => {
        const loadGyms = async () => {
            try {
                setLoadingGyms(true);
                const q = query(
                    collection(db, "gyms"),
                    orderBy("order", "asc")
                );
                const snap = await getDocs(q);
                const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
                setGyms(list);
            }   catch (e) {
                console.log("LOAD GYMS ERROR: ", e);
            }   finally {
                setLoadingGyms(false);
            }
        };

        loadGyms();
    }, []);

    const toggleGym = async (gymId) => {
        setExpandedGymIds((prev) => {
            const next = new Set(prev);
            if (next.has(gymId)) next.delete(gymId);
            else next.add(gymId);
            return next;
        });

        if(trainersByGym[gymId]) return;

        try {
            setLoadingTrainersGymId((p) => ({ ...p, [gymId]: true }));

            const q = query(
                collection(db, 'trainers'),
                where('gymId', '==', gymId),
                orderBy('order', 'asc')
            );

            const snap = await getDocs(q);
            const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            setTrainersByGym((prev) => ({ ...prev, [gymId]: list }));
        }   catch (e) {
            console.log("LOAD TRAINERS ERROR: ", e);
        }   finally {
            setLoadingTrainersGymId((p) => ({ ...p, [gymId]: false }));
        }
    };

    const onLogout = async () => {
        await signOut(auth);
    };

    const renderTrainerRow = (trainer, gymId) => {
        return (
            <View key={trainer.id} style={styles.trainerRow}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.trainerName}>{trainer.vardas || "Treneris"}</Text>
                    <Text style={styles.trainerSpec}>{trainer.specializacija || ""}</Text>
                </View>

                <Text style={styles.price}>
                    {typeof trainer.kaina === "number" ? `${trainer.kaina}€` : "—"}
                </Text>

                <Pressable
                    style={styles.reserveBtn}
                    onPress={() =>
                        navigation.navigate("Booking", { trainerId: trainer.id, gymId })
                    }
                >
                    <Text style={styles.reserveBtnText}>Rezervuoti</Text>
                </Pressable>
            </View>
            
        );
    };

    const renderGymCard = ({ item }) => {
        const isExpanded = expandedGymIds.has(item.id);
        const trainers = trainersByGym[item.id] || [];
        const isLoadingTrainers = loadingTrainersGymId === item.id;

        return (
            <View style={styles.gymCard}>
                <Pressable onPress={() =>
                    toggleGym(item.id)}
                    style={styles.gymHeader}
                >
                    <View style={{ flex: 1 }}>
                        <Text style={styles.gymTitle}>
                            {item.pavadinimas || "Sporto salė"}
                        </Text>
                        <Text style={styles.gymMeta}>
                            Adresas: {item.adresas || ''}
                        </Text>
                    </View>

                    <Text style={styles.chevron}>{isExpanded ? '-' : '+'}</Text>
                </Pressable>

                {isExpanded && (
                    <View style={styles.trainersBox}>
                        {isLoadingTrainers ? (
                            <View style={{ paddingVertical: 10 }}>
                                <ActivityIndicator />
                            </View>
                        )   : trainers.length === 0 ? (
                            <Text style={styles.emptyText}>Šioje sporto salėje trenerių nėra.</Text>
                        )   : (
                            trainers.map((t) => renderTrainerRow(t, item.id))
                        )}
                    </View>
                )}
            </View>
        );
    };

    const collapseAll = () => {
        setExpandedGymIds(new Set());
    };

    const expandAll = async () => {
        setExpandedGymIds(new Set(gyms.map((g) => g.id)));

        const missing = gyms.filter((g) => !trainersByGym[g.id]);
    }

    return (
        <View style={styles.screen}>
            <View style={styles.topBar}>
                <Text numberOfLines={1} style={styles.userEmail}>
                    {userEmail}
                </Text>
            </View>

            <Text style={styles.pageTitle}>Sporto salės</Text>

            <View style={styles.expandRow}>
                <Pressable style={styles.outlineBtn} onPress={expandAll}>
                    <Text style={styles.outlineBtnText}>Išskleisti viską</Text>
                </Pressable>

                <Pressable style={styles.outlineBtn} onPress={collapseAll}>
                    <Text style={styles.outlineBtnText}>Suskleisti viską</Text>
                </Pressable>
            </View>

            {loadingGyms ? (
                <View style={{ paddingTop: 30 }}>
                    <ActivityIndicator />
                </View>
            )   : (
                <FlatList
                    data={gyms}
                    keyExtractor={(item) => item.id}
                    renderItem={renderGymCard}
                    contentContainerStyle={{ paddingBottom: 90 }}
                />
            )}

            <View style={styles.footer}>
                <Pressable
                        style={styles.footerBtn}
                        onPress={() =>
                            navigation.navigate("Reservations")
                        }
                    >
                        <Text style={styles.footerBtnText}>Rezervacijos</Text>
                    </Pressable>

                    <Pressable 
                        style={[styles.footerBtn, styles.logoutBtn]}
                        onPress={onLogout}
                    >
                        <Text style={styles.footerBtnText}>Atsijungti</Text>    
                    </Pressable> 
            </View>

        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: "#fff", paddingHorizontal: 16 },
    topBar: {
        paddingTop: 30,
        paddingBottom: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    userEmail: { flex: 1, color: "#6b7280", fontSize: 12 },
    topBtn: {
        borderWidth: 1,
        borderColor: "#d1d5db",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: "#f9fafb",
    },
    topBtnText: { fontSize: 12, color: "#111827", fontWeight: "600" },
    pageTitle: {
        fontSize: 22,
        fontWeight: "700",
        marginTop: 4,
        marginBottom: 12,
        color: "#111827",
    },
    gymCard: {
        borderWidth: 1,
        borderColor: "#e5e7eb",
        borderRadius: 12,
        marginBottom: 12,
        overflow: "hidden",
    },
    gymHeader: {
        padding: 12,
        flexDirection: "row",
        alignItems: "center",
    },
    gymTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
    gymMeta: { marginTop: 4, fontSize: 12, color: "#6b7280" },
    chevron: { fontSize: 18, color: "#6b7280", paddingLeft: 8 },
    trainersBox: { paddingHorizontal: 12, paddingBottom: 12 },
    trainerRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: "#f3f4f6",
    },
    trainerName: { fontSize: 14, fontWeight: "700", color: "#111827" },
    trainerSpec: { fontSize: 12, color: "#6b7280", marginTop: 2 },
    price: { width: 50, textAlign: "right", fontWeight: "700", color: "#111827" },
    reserveBtn: {
        borderWidth: 1,
        borderColor: "#d1d5db",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: "#f3f4f6",
    },
    reserveBtnText: { fontSize: 12, fontWeight: "700", color: "#111827" },
    emptyText: { paddingVertical: 10, color: "#6b7280", fontSize: 12 },
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
        borderRadius: 10,
        backgroundColor: "#f3f4f6",
        alignItems: "center",
    },
    logoutBtn: { backgroundColor: "#fee2e2" },
    footerBtnText: { fontWeight: "700" },
    expandRow: {
        flexDirection: "row",
        gap: 10,
        marginBottom: 12,
    },
    outlineBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#e5e7eb",
        backgroundColor: "#fff",
        alignItems: "center",
    },
    outlineBtnText: {
        fontSize: 12,
        fontWeight: "800",
        color: "#111827",
    },
});