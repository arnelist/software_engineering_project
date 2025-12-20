import { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { signOut } from "firebase/auth";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { auth, db } from "../services/firebase";
import AnimatedScreen from "../components/AnimatedScreen";
import colors from "../theme/colors";

export default function HomeScreen({ navigation }) {
    const userEmail = auth.currentUser?.email ?? '';

    const [gyms, setGyms] = useState([]);
    const [loadingGyms, setLoadingGyms] = useState(true);

    const [expandedGymIds, setExpandedGymIds] = useState(() => new Set());
    const [trainersByGym, setTrainersByGym] = useState({});
    const [loadingTrainersGymId, setLoadingTrainersGymId] = useState({});

    useEffect(() => {
        if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
            UIManager.setLayoutAnimationEnabledExperimental(true);
        }
    }, []);

    const animateLayout = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    };

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
        animateLayout();
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
        const isLoadingTrainers = !!loadingTrainersGymId[item.id];

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
                                <ActivityIndicator color={colors.accent} />
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
        animateLayout();
        setExpandedGymIds(new Set());
    };

    const expandAll = async () => {
        animateLayout();
        setExpandedGymIds(new Set(gyms.map((g) => g.id)));

        const missing = gyms.filter((g) => !trainersByGym[g.id]);
    }

    return (
        <AnimatedScreen style={styles.screen}>
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
                    <ActivityIndicator color={colors.accent} />
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

        </AnimatedScreen>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16, paddingTop: 30 },
    topBar: {
        paddingTop: 30,
        paddingBottom: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    userEmail: { flex: 1, color: colors.muted, fontSize: 12 },
    topBtn: {
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: colors.card,
    },
    topBtnText: { fontSize: 12, color: colors.text, fontWeight: "600" },
    pageTitle: {
        fontSize: 22,
        fontWeight: "800",
        marginTop: 4,
        marginBottom: 12,
        color: colors.text,
    },
    gymCard: {
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        borderRadius: 14,
        marginBottom: 12,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOpacity: 0.35,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 8 },
    },
    gymHeader: {
        padding: 14,
        flexDirection: "row",
        alignItems: "center",
    },
    gymTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
    gymMeta: { marginTop: 4, fontSize: 12, color: colors.muted },
    chevron: { fontSize: 18, color: colors.accent, paddingLeft: 8, fontWeight: "800" },
    trainersBox: { paddingHorizontal: 14, paddingBottom: 14, backgroundColor: colors.cardElevated },
    trainerRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    trainerName: { fontSize: 14, fontWeight: "800", color: colors.text },
    trainerSpec: { fontSize: 12, color: colors.muted, marginTop: 2 },
    price: { width: 50, textAlign: "right", fontWeight: "800", color: colors.accent },
    reserveBtn: {
        borderWidth: 1,
        borderColor: colors.accent,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: colors.accent,
    },
    reserveBtnText: { fontSize: 12, fontWeight: "800", color: "#0b0c10" },
    emptyText: { paddingVertical: 10, color: colors.muted, fontSize: 12 },
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
    expandRow: {
        flexDirection: "row",
        gap: 10,
        marginBottom: 12,
    },
    outlineBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        alignItems: "center",
    },
    outlineBtnText: {
        fontSize: 12,
        fontWeight: "800",
        color: colors.accent,
    },
});
